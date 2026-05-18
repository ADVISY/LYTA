-- ============================================================================
-- Fix : la fonction retry_tenant_onboarding spamait une notif toutes les 5 min
-- ============================================================================
-- Bug : si SERVICE_ROLE_KEY absente du vault, la fonction insérait une
-- notification king '⚠️ Cron retry désactivé' à CHAQUE run (toutes les 5 min)
-- → 288 notifs/jour. Insupportable.
--
-- Fix : on dédoublonne — on n'insère la notif que si on n'en a pas déjà
-- créé une dans les dernières 24h.
-- ============================================================================

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
  v_recent_warning_count INT;
BEGIN
  SELECT decrypted_secret INTO v_supabase_url
    FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL' LIMIT 1;
  IF v_supabase_url IS NULL THEN
    v_supabase_url := 'https://shxbcszukoegvvejcpsn.supabase.co';
  END IF;

  SELECT decrypted_secret INTO v_service_key
    FROM vault.decrypted_secrets WHERE name = 'SERVICE_ROLE_KEY' LIMIT 1;

  IF v_service_key IS NULL THEN
    -- Dedup : on ne notifie qu'une fois par 24h (au lieu d'une fois toutes les 5 min)
    SELECT COUNT(*) INTO v_recent_warning_count
      FROM public.king_notifications
     WHERE kind = 'system_warning'
       AND metadata @> jsonb_build_object('cron', 'retry_tenant_onboarding')
       AND created_at > NOW() - INTERVAL '24 hours';

    IF v_recent_warning_count = 0 THEN
      INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
      VALUES (
        '⚠️ Cron retry désactivé',
        'SERVICE_ROLE_KEY introuvable dans vault.decrypted_secrets — impossible de relancer tenant-onboarding automatiquement. Procédure : exécuter SELECT vault.create_secret(''<ta_service_role_key>'', ''SERVICE_ROLE_KEY'') puis SELECT vault.create_secret(''https://shxbcszukoegvvejcpsn.supabase.co'', ''PROJECT_URL'') dans Supabase SQL Editor.',
        'system_warning', 'high',
        jsonb_build_object('cron', 'retry_tenant_onboarding', 'last_dedup', NOW())
      );
    END IF;

    RETURN jsonb_build_object('ok', false, 'reason', 'service_key_unavailable', 'notified', v_recent_warning_count = 0);
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
      AND created_at > NOW() - INTERVAL '24 hours'
    LIMIT 10
  LOOP
    UPDATE public.tenants
       SET onboarding_retry_count = coalesce(onboarding_retry_count, 0) + 1,
           onboarding_last_attempt_at = NOW()
     WHERE id = v_tenant.id;

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

-- Nettoie le spam déjà accumulé (notifs system_warning vault des dernières 24h)
-- On garde la plus récente, on supprime le reste.
DELETE FROM public.king_notifications
 WHERE kind = 'system_warning'
   AND metadata @> jsonb_build_object('cron', 'retry_tenant_onboarding')
   AND id NOT IN (
     SELECT id FROM public.king_notifications
      WHERE kind = 'system_warning'
        AND metadata @> jsonb_build_object('cron', 'retry_tenant_onboarding')
      ORDER BY created_at DESC
      LIMIT 1
   );
