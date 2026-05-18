-- ============================================================================
-- Email anniversaire automatique : colonne idempotence + cron quotidien
-- ============================================================================
-- Pour chaque tenant avec tenant_email_automation.enable_birthday_email=true,
-- envoyer un email branded aux clients dont c'est l'anniversaire aujourd'hui.
-- Cron tourne à 07:00 UTC (09:00 Europe/Zurich été / 08:00 hiver) — assez tôt
-- pour que les clients reçoivent leur email le matin.
-- ============================================================================

-- 1. Colonne idempotence sur clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS last_birthday_email_sent_at TIMESTAMPTZ;

-- Note : pas d'index sur to_char(birthdate, 'MM-DD') car to_char n'est pas
-- IMMUTABLE (selon le format/timezone). Le filter tenant_id + scan en mémoire
-- est OK tant qu'on a < 100k clients/tenant.

-- 2. Fonction RPC qui appelle l'edge function via pg_net
CREATE OR REPLACE FUNCTION public.trigger_birthday_emails()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  SELECT decrypted_secret INTO v_supabase_url
    FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL' LIMIT 1;
  IF v_supabase_url IS NULL THEN
    v_supabase_url := 'https://shxbcszukoegvvejcpsn.supabase.co';
  END IF;

  SELECT decrypted_secret INTO v_service_key
    FROM vault.decrypted_secrets WHERE name = 'SERVICE_ROLE_KEY' LIMIT 1;

  IF v_service_key IS NULL THEN
    -- Dedup notif déjà géré dans la migration précédente (1x/24h)
    INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
    SELECT
      '⚠️ Birthday emails désactivés',
      'SERVICE_ROLE_KEY manquante dans vault → cron birthday ne peut pas appeler l''edge function.',
      'system_warning', 'high',
      jsonb_build_object('cron', 'trigger_birthday_emails')
    WHERE NOT EXISTS (
      SELECT 1 FROM public.king_notifications
       WHERE kind = 'system_warning'
         AND metadata @> jsonb_build_object('cron', 'trigger_birthday_emails')
         AND created_at > NOW() - INTERVAL '24 hours'
    );
    RETURN jsonb_build_object('ok', false, 'reason', 'service_key_unavailable');
  END IF;

  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/send-birthday-emails',
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

REVOKE ALL ON FUNCTION public.trigger_birthday_emails() FROM PUBLIC;

-- 3. Schedule pg_cron quotidien à 07:00 UTC (09:00 été / 08:00 hiver Suisse)
DO $$
BEGIN
  PERFORM cron.unschedule('trigger-birthday-emails')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'trigger-birthday-emails');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron unschedule skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'trigger-birthday-emails',
    '0 7 * * *',  -- 07:00 UTC quotidien
    $cron$ SELECT public.trigger_birthday_emails(); $cron$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron schedule skipped: %', SQLERRM;
END $$;

COMMENT ON FUNCTION public.trigger_birthday_emails() IS
  'Cron 07:00 UTC quotidien — appelle send-birthday-emails edge function pour envoyer 1 email branded à chaque client dont c''est l''anniversaire dans les tenants avec enable_birthday_email=true.';

COMMENT ON COLUMN public.clients.last_birthday_email_sent_at IS
  'Timestamp du dernier envoi auto d''email anniversaire (évite double envoi si cron retry le même jour).';
