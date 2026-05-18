-- ============================================================================
-- Auto-activation tenants en fin de trial (filet de sécurité du webhook)
-- ============================================================================
-- Normalement le webhook stripe-webhook bascule le tenant en 'active' quand
-- Stripe confirme la transition trial → active. MAIS si le webhook a échoué
-- (signature mismatch passé, function down, etc.) → tenant resté en 'test'
-- alors qu'il paye déjà.
--
-- Ce cron tourne toutes les heures, cherche les tenants avec trial_ends_at
-- dans le passé ET payment_status='paid' (Stripe a déjà encaissé) ET
-- status != 'active' → corrige en passant 'active'.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_activate_expired_trials()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activated INT := 0;
  v_suspended INT := 0;
  v_tenant RECORD;
BEGIN
  -- 1) Tenants en fin de trial avec paiement OK → passe actif
  FOR v_tenant IN
    SELECT id, name, slug, mrr_amount, plan
    FROM public.tenants
    WHERE trial_ends_at IS NOT NULL
      AND trial_ends_at < NOW()
      AND payment_status = 'paid'
      AND status != 'active'
      AND tenant_status != 'cancelled'
    LIMIT 100
  LOOP
    UPDATE public.tenants
       SET status = 'active',
           tenant_status = 'active',
           updated_at = NOW()
     WHERE id = v_tenant.id;

    INSERT INTO public.king_notifications (title, message, kind, priority, tenant_id, tenant_name, action_url, action_label, metadata)
    VALUES (
      '🎉 Cabinet auto-activé (cron)',
      v_tenant.name || ' était en trial mais déjà payé — cron a corrigé.',
      'tenant_activated', 'normal',
      v_tenant.id, v_tenant.name,
      '/king/tenants/' || v_tenant.id, 'Voir le tenant',
      jsonb_build_object('plan', v_tenant.plan, 'mrr', v_tenant.mrr_amount, 'source', 'cron')
    );
    v_activated := v_activated + 1;
  END LOOP;

  -- 2) Tenants en fin de trial SANS paiement → suspendre (sauf si déjà géré)
  FOR v_tenant IN
    SELECT id, name, slug
    FROM public.tenants
    WHERE trial_ends_at IS NOT NULL
      AND trial_ends_at < NOW() - INTERVAL '24 hours'
      AND payment_status IN ('trialing', 'unpaid')
      AND status NOT IN ('suspended', 'cancelled')
    LIMIT 100
  LOOP
    UPDATE public.tenants
       SET status = 'suspended',
           suspended_at = NOW(),
           suspension_reason = 'Trial expiré sans paiement (auto-suspension cron)',
           updated_at = NOW()
     WHERE id = v_tenant.id;

    INSERT INTO public.king_notifications (title, message, kind, priority, tenant_id, tenant_name, action_url, action_label, metadata)
    VALUES (
      '⚠️ Trial expiré sans paiement',
      v_tenant.name || ' suspendu — 7 jours dépassés et aucun paiement confirmé.',
      'tenant_suspended', 'high',
      v_tenant.id, v_tenant.name,
      '/king/tenants/' || v_tenant.id, 'Diagnostiquer',
      jsonb_build_object('source', 'cron_trial_expired')
    );
    v_suspended := v_suspended + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'activated', v_activated,
    'suspended', v_suspended,
    'ran_at', NOW()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.auto_activate_expired_trials() FROM PUBLIC;

-- Schedule pg_cron toutes les heures
DO $$
BEGIN
  PERFORM cron.unschedule('auto-activate-expired-trials')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-activate-expired-trials');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron unschedule skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'auto-activate-expired-trials',
    '15 * * * *',  -- toutes les heures à HH:15
    $cron$ SELECT public.auto_activate_expired_trials(); $cron$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron schedule skipped: %', SQLERRM;
END $$;

COMMENT ON FUNCTION public.auto_activate_expired_trials() IS
  'Cron 1h — bascule tenants test→active si trial fini + paiement OK, ou test→suspended si trial fini sans paiement. Filet de sécurité du webhook Stripe.';
