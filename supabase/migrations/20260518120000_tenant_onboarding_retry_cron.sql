-- ============================================================================
-- pg_cron : retry auto tenant-onboarding pour les tenants coincés
-- ============================================================================
-- Le bug du jour : un tenant créé via self-signup peut se retrouver avec un
-- sous-domaine cassé si l'appel tenant-onboarding échoue (Cloudflare rate
-- limit, timeout, etc.). On veut zéro tolérance : un cron tente jusqu'à
-- 5 fois sur 25 min, puis raise une alerte critique king si toujours raté.
-- ============================================================================

-- 1. Colonnes de tracking sur tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS onboarding_retry_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS onboarding_last_error TEXT;

CREATE INDEX IF NOT EXISTS idx_tenants_onboarding_pending
  ON public.tenants (onboarding_completed, onboarding_last_attempt_at)
  WHERE onboarding_completed = FALSE;

-- 2. Fonction qui retry tenant-onboarding pour 1 tenant via pg_net
CREATE OR REPLACE FUNCTION public.retry_tenant_onboarding()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant RECORD;
  v_count INT := 0;
  v_alerted INT := 0;
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  -- Récupère URL + service key (stockés dans vault.secrets via Supabase)
  -- Fallback hardcoded pour le project_ref si vault non utilisé.
  SELECT decrypted_secret INTO v_supabase_url
    FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL' LIMIT 1;
  IF v_supabase_url IS NULL THEN
    v_supabase_url := 'https://shxbcszukoegvvejcpsn.supabase.co';
  END IF;

  SELECT decrypted_secret INTO v_service_key
    FROM vault.decrypted_secrets WHERE name = 'SERVICE_ROLE_KEY' LIMIT 1;

  IF v_service_key IS NULL THEN
    -- Pas de service key dispo → on ne peut pas appeler la fonction.
    -- On log seulement.
    INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
    VALUES (
      '⚠️ Cron retry désactivé',
      'SERVICE_ROLE_KEY introuvable dans vault.decrypted_secrets — impossible de relancer tenant-onboarding automatiquement.',
      'system_warning', 'high',
      jsonb_build_object('cron', 'retry_tenant_onboarding')
    );
    RETURN jsonb_build_object('ok', false, 'reason', 'service_key_unavailable');
  END IF;

  -- Pour chaque tenant pas terminé, < 5 tentatives, dernière > 5 min
  FOR v_tenant IN
    SELECT id, slug, name, onboarding_retry_count
    FROM public.tenants
    WHERE onboarding_completed = FALSE
      AND coalesce(onboarding_retry_count, 0) < 5
      AND (onboarding_last_attempt_at IS NULL
           OR onboarding_last_attempt_at < NOW() - INTERVAL '5 minutes')
      AND signup_source = 'self_signup'
      AND created_at > NOW() - INTERVAL '24 hours'  -- on n'éternise pas
    LIMIT 10
  LOOP
    -- Incrémente immédiatement (évite double-trigger si cron overlap)
    UPDATE public.tenants
       SET onboarding_retry_count = coalesce(onboarding_retry_count, 0) + 1,
           onboarding_last_attempt_at = NOW()
     WHERE id = v_tenant.id;

    -- Appel async pg_net (le résultat sera traité par tenant-onboarding qui
    -- met à jour onboarding_completed = TRUE lui-même via metadata column)
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/tenant-onboarding',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key,
        'apikey', v_service_key
      ),
      body := jsonb_build_object(
        'tenant_id', v_tenant.id,
        'slug', v_tenant.slug,
        'tenant_name', v_tenant.name,
        'step', 'full'
      )
    );

    v_count := v_count + 1;

    -- Alerte critique si on atteint 5 tentatives (= dernière chance)
    IF v_tenant.onboarding_retry_count + 1 >= 5 THEN
      INSERT INTO public.king_notifications (title, message, kind, priority, tenant_id, tenant_name, action_url, action_label, metadata)
      VALUES (
        '🚨 Tenant onboarding échoué 5 fois',
        v_tenant.slug || '.lyta.ch n''a pas pu être provisionné après 5 retries. Action manuelle requise.',
        'tenant_onboarding_critical', 'critical',
        v_tenant.id, v_tenant.name,
        '/king/tenants/' || v_tenant.id,
        'Diagnostiquer',
        jsonb_build_object('retries', 5, 'slug', v_tenant.slug)
      );
      v_alerted := v_alerted + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'retried', v_count,
    'critical_alerts', v_alerted,
    'ran_at', NOW()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.retry_tenant_onboarding() FROM PUBLIC;

-- 3. Schedule pg_cron toutes les 5 minutes
DO $$
BEGIN
  -- Désinstalle l'ancienne version si déjà schedulée
  PERFORM cron.unschedule('retry-tenant-onboarding')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'retry-tenant-onboarding');
EXCEPTION WHEN OTHERS THEN
  -- pg_cron pas dispo ou autre erreur — on ignore (la fonction reste callable manuellement)
  RAISE NOTICE 'pg_cron unschedule skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'retry-tenant-onboarding',
    '*/5 * * * *',
    $cron$ SELECT public.retry_tenant_onboarding(); $cron$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron schedule skipped: %', SQLERRM;
END $$;

COMMENT ON FUNCTION public.retry_tenant_onboarding() IS
  'Cron 5min — retente tenant-onboarding pour les self-signup pas finalisés. Max 5 tentatives sur 25 min, puis alerte critique king.';
