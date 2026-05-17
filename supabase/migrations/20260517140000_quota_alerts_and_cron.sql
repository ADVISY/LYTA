-- ============================================================================
-- Alertes quota (80% / 100% / 150%) + tracking + cron mensuel overage
-- ============================================================================

-- 1. Table de tracking des alertes envoyées (anti-spam : 1 envoi par seuil/mois)
CREATE TABLE IF NOT EXISTS public.tenant_quota_alerts (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('ai_docs', 'sms', 'email')),
  period_year INT NOT NULL,
  period_month INT NOT NULL,
  threshold_pct INT NOT NULL CHECK (threshold_pct IN (80, 100, 150)),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, resource_type, period_year, period_month, threshold_pct)
);
CREATE INDEX IF NOT EXISTS idx_tqa_period ON public.tenant_quota_alerts(period_year, period_month);

ALTER TABLE public.tenant_quota_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tqa_king_read ON public.tenant_quota_alerts;
CREATE POLICY tqa_king_read ON public.tenant_quota_alerts
  FOR SELECT TO authenticated USING (public.is_king());
GRANT SELECT ON public.tenant_quota_alerts TO authenticated;
GRANT ALL ON public.tenant_quota_alerts TO service_role;

-- 2. Trigger : à chaque update tenant_consumption, check si on franchit un seuil
-- Si oui : insert king_notifications + log dans tenant_quota_alerts (idempotent)
CREATE OR REPLACE FUNCTION public.check_quota_thresholds_on_consumption()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD;
  v_tenant_name TEXT;
  v_limit INT;
  v_used INT;
  v_pct NUMERIC;
  v_year INT := EXTRACT(YEAR FROM now())::INT;
  v_month INT := EXTRACT(MONTH FROM now())::INT;
  v_resource TEXT;
  v_thresholds INT[] := ARRAY[80, 100, 150];
  v_threshold INT;
  v_label TEXT;
  v_resource_label TEXT;
BEGIN
  SELECT name INTO v_tenant_name FROM public.tenants WHERE id = NEW.tenant_id;

  FOREACH v_resource IN ARRAY ARRAY['ai_docs', 'sms', 'email'] LOOP
    EXECUTE format('SELECT %I FROM public.tenant_limits WHERE tenant_id = $1', v_resource || '_limit_monthly')
      INTO v_limit USING NEW.tenant_id;
    EXECUTE format('SELECT %I FROM public.tenant_consumption WHERE tenant_id = $1', v_resource || '_used')
      INTO v_used USING NEW.tenant_id;
    IF COALESCE(v_limit, 0) <= 0 OR COALESCE(v_used, 0) <= 0 THEN CONTINUE; END IF;

    v_pct := (v_used::NUMERIC / v_limit) * 100;
    v_resource_label := CASE v_resource
      WHEN 'ai_docs' THEN 'Scans Smartflow'
      WHEN 'sms' THEN 'SMS campagnes'
      WHEN 'email' THEN 'Emails marketing'
    END;

    FOREACH v_threshold IN ARRAY v_thresholds LOOP
      IF v_pct >= v_threshold THEN
        -- Insert idempotent (UNIQUE constraint empêche les doublons)
        BEGIN
          INSERT INTO public.tenant_quota_alerts (tenant_id, resource_type, period_year, period_month, threshold_pct)
          VALUES (NEW.tenant_id, v_resource, v_year, v_month, v_threshold);

          -- Premier passage → on insère la notif king
          v_label := CASE v_threshold
            WHEN 80 THEN '⚠️ 80% quota atteint'
            WHEN 100 THEN '🔥 100% quota atteint'
            WHEN 150 THEN '🚨 150% quota — overage important'
          END;

          INSERT INTO public.king_notifications (
            title, message, kind, priority, tenant_id, tenant_name,
            action_url, action_label, metadata
          ) VALUES (
            v_label || ' (' || v_resource_label || ')',
            v_tenant_name || ' a consommé ' || v_used || '/' || v_limit || ' ' || v_resource_label || ' ce mois (' || ROUND(v_pct, 1) || '%)',
            'quota_threshold', CASE WHEN v_threshold >= 100 THEN 'high' ELSE 'normal' END,
            NEW.tenant_id, v_tenant_name,
            '/king/tenants/' || NEW.tenant_id, 'Voir le tenant',
            jsonb_build_object('resource_type', v_resource, 'used', v_used, 'limit', v_limit, 'pct', v_pct, 'threshold', v_threshold)
          );
        EXCEPTION WHEN unique_violation THEN
          -- déjà envoyé ce mois pour ce seuil → skip
          NULL;
        END;
      END IF;
    END LOOP;
  END LOOP;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_check_quota_thresholds ON public.tenant_consumption;
CREATE TRIGGER trg_check_quota_thresholds
  AFTER UPDATE OF sms_used, email_used, ai_docs_used ON public.tenant_consumption
  FOR EACH ROW EXECUTE FUNCTION public.check_quota_thresholds_on_consumption();

-- 3. RPC get_tenant_quota_usage (utilisée par le widget tenant)
CREATE OR REPLACE FUNCTION public.get_tenant_quota_usage(p_tenant_id UUID DEFAULT NULL)
RETURNS TABLE (
  resource_type TEXT,
  used INT,
  monthly_limit INT,
  pct NUMERIC,
  overage_units INT,
  auto_overage_enabled BOOLEAN
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tenant UUID := COALESCE(p_tenant_id, public.get_user_tenant_id());
  v_auto BOOLEAN;
BEGIN
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'tenant required'; END IF;

  SELECT auto_overage_enabled INTO v_auto FROM public.tenants WHERE id = v_tenant;

  RETURN QUERY
  SELECT
    'ai_docs'::TEXT,
    COALESCE(c.ai_docs_used, 0)::INT,
    COALESCE(l.ai_docs_limit_monthly, 0)::INT,
    CASE WHEN COALESCE(l.ai_docs_limit_monthly, 0) > 0
      THEN ROUND((c.ai_docs_used::NUMERIC / l.ai_docs_limit_monthly) * 100, 1)
      ELSE 0 END,
    GREATEST(0, COALESCE(c.ai_docs_used, 0) - COALESCE(l.ai_docs_limit_monthly, 0))::INT,
    v_auto
  FROM public.tenant_limits l
  LEFT JOIN public.tenant_consumption c ON c.tenant_id = l.tenant_id
  WHERE l.tenant_id = v_tenant

  UNION ALL
  SELECT 'sms'::TEXT, COALESCE(c.sms_used, 0)::INT, COALESCE(l.sms_limit_monthly, 0)::INT,
    CASE WHEN COALESCE(l.sms_limit_monthly, 0) > 0
      THEN ROUND((c.sms_used::NUMERIC / l.sms_limit_monthly) * 100, 1) ELSE 0 END,
    GREATEST(0, COALESCE(c.sms_used, 0) - COALESCE(l.sms_limit_monthly, 0))::INT,
    v_auto
  FROM public.tenant_limits l
  LEFT JOIN public.tenant_consumption c ON c.tenant_id = l.tenant_id
  WHERE l.tenant_id = v_tenant

  UNION ALL
  SELECT 'email'::TEXT, COALESCE(c.email_used, 0)::INT, COALESCE(l.email_limit_monthly, 0)::INT,
    CASE WHEN COALESCE(l.email_limit_monthly, 0) > 0
      THEN ROUND((c.email_used::NUMERIC / l.email_limit_monthly) * 100, 1) ELSE 0 END,
    GREATEST(0, COALESCE(c.email_used, 0) - COALESCE(l.email_limit_monthly, 0))::INT,
    v_auto
  FROM public.tenant_limits l
  LEFT JOIN public.tenant_consumption c ON c.tenant_id = l.tenant_id
  WHERE l.tenant_id = v_tenant;
END $$;

GRANT EXECUTE ON FUNCTION public.get_tenant_quota_usage(UUID) TO authenticated;

-- 4. Cron pg_cron mensuel : 1er du mois à 02:00 UTC, appelle apply-monthly-overage
-- Note : nécessite pg_cron extension installée + pg_net pour l'appel HTTP
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN

    -- Unschedule previous version
    PERFORM cron.unschedule('apply-monthly-overage-1st') WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'apply-monthly-overage-1st'
    );

    PERFORM cron.schedule(
      'apply-monthly-overage-1st',
      '0 2 1 * *',  -- minute hour day month dow → 1er du mois à 02:00 UTC
      format($cron$
        SELECT net.http_post(
          url := '%s/functions/v1/apply-monthly-overage',
          headers := jsonb_build_object('Authorization', 'Bearer %s', 'Content-Type', 'application/json'),
          body := jsonb_build_object('source', 'pg_cron')
        );
      $cron$,
        current_setting('app.supabase_url', true),
        current_setting('app.supabase_service_role_key', true)
      )
    );
    RAISE NOTICE 'Cron pg_cron scheduled : apply-monthly-overage le 1er du mois à 02:00 UTC';
  ELSE
    RAISE NOTICE 'pg_cron / pg_net pas installés → cron mensuel à déclencher manuellement depuis King → Coûts';
  END IF;
END $$;
