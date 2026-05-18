-- ============================================================================
-- Renewal + Follow-up email auto : colonnes idempotence + pg_cron
-- ============================================================================

-- 1. Colonnes idempotence
ALTER TABLE public.policies
  ADD COLUMN IF NOT EXISTS last_renewal_email_sent_at TIMESTAMPTZ;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS last_follow_up_email_sent_at TIMESTAMPTZ;

-- 2. RPC trigger renewal_reminders (07:30 UTC quotidien — décalé après birthday)
CREATE OR REPLACE FUNCTION public.trigger_renewal_reminders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  SELECT decrypted_secret INTO v_supabase_url FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL' LIMIT 1;
  IF v_supabase_url IS NULL THEN v_supabase_url := 'https://shxbcszukoegvvejcpsn.supabase.co'; END IF;
  SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets WHERE name = 'SERVICE_ROLE_KEY' LIMIT 1;

  IF v_service_key IS NULL THEN
    INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
    SELECT '⚠️ Renewal cron désactivé',
           'SERVICE_ROLE_KEY manquante dans vault — cron renewal désactivé.',
           'system_warning', 'high',
           jsonb_build_object('cron', 'trigger_renewal_reminders')
    WHERE NOT EXISTS (
      SELECT 1 FROM public.king_notifications
       WHERE kind = 'system_warning'
         AND metadata @> jsonb_build_object('cron', 'trigger_renewal_reminders')
         AND created_at > NOW() - INTERVAL '24 hours'
    );
    RETURN jsonb_build_object('ok', false, 'reason', 'service_key_unavailable');
  END IF;

  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/send-renewal-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key,
      'apikey', v_service_key
    ),
    body := '{}'::jsonb
  );
  RETURN jsonb_build_object('ok', true, 'triggered_at', NOW());
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_renewal_reminders() FROM PUBLIC;

-- 3. RPC trigger follow_up_reminders (08:00 UTC quotidien)
CREATE OR REPLACE FUNCTION public.trigger_follow_up_reminders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  SELECT decrypted_secret INTO v_supabase_url FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL' LIMIT 1;
  IF v_supabase_url IS NULL THEN v_supabase_url := 'https://shxbcszukoegvvejcpsn.supabase.co'; END IF;
  SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets WHERE name = 'SERVICE_ROLE_KEY' LIMIT 1;

  IF v_service_key IS NULL THEN
    INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
    SELECT '⚠️ Follow-up cron désactivé',
           'SERVICE_ROLE_KEY manquante dans vault — cron follow-up désactivé.',
           'system_warning', 'high',
           jsonb_build_object('cron', 'trigger_follow_up_reminders')
    WHERE NOT EXISTS (
      SELECT 1 FROM public.king_notifications
       WHERE kind = 'system_warning'
         AND metadata @> jsonb_build_object('cron', 'trigger_follow_up_reminders')
         AND created_at > NOW() - INTERVAL '24 hours'
    );
    RETURN jsonb_build_object('ok', false, 'reason', 'service_key_unavailable');
  END IF;

  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/send-follow-up-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key,
      'apikey', v_service_key
    ),
    body := '{}'::jsonb
  );
  RETURN jsonb_build_object('ok', true, 'triggered_at', NOW());
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_follow_up_reminders() FROM PUBLIC;

-- 4. Schedule pg_cron
DO $$
BEGIN
  PERFORM cron.unschedule('trigger-renewal-reminders')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'trigger-renewal-reminders');
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'pg_cron unschedule skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'trigger-renewal-reminders',
    '30 7 * * *',  -- 07:30 UTC quotidien
    $cron$ SELECT public.trigger_renewal_reminders(); $cron$
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'pg_cron schedule skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('trigger-follow-up-reminders')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'trigger-follow-up-reminders');
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'pg_cron unschedule skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'trigger-follow-up-reminders',
    '0 8 * * *',  -- 08:00 UTC quotidien
    $cron$ SELECT public.trigger_follow_up_reminders(); $cron$
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'pg_cron schedule skipped: %', SQLERRM;
END $$;
