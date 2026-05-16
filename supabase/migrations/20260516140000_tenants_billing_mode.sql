-- ============================================================================
-- tenants.billing_mode — séparer les vrais payants des internes/tests
-- ============================================================================
-- Le dashboard MRR/ARR comptait les tenants internes (Advisy, Demo) et les
-- tenants test, ce qui faussait les chiffres. On distingue maintenant :
--   - paying : a une subscription Stripe active (auto-promu via sync-tenant-stripe)
--   - internal : tenant interne LYTA (Advisy, Demo) — pas dans MRR
--   - test : pas de Stripe, à promouvoir ou supprimer (défaut)
--   - free : tenant sans abonnement permanent (gratuit explicite)
-- ============================================================================

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS billing_mode TEXT NOT NULL DEFAULT 'test'
    CHECK (billing_mode IN ('paying','internal','test','free'));

CREATE INDEX IF NOT EXISTS idx_tenants_billing_mode
  ON public.tenants(billing_mode);

COMMENT ON COLUMN public.tenants.billing_mode IS
  'Catégorie facturation : paying (Stripe actif, comptabilisé MRR), internal (tenant LYTA interne), test (à promouvoir ou supprimer), free (gratuit explicite).';

-- Migration : Advisy + Demo en internal (décidé par Habib)
UPDATE public.tenants SET billing_mode = 'internal'
WHERE slug IN ('advisy', 'demo');

-- Tenants avec stripe_subscription_id déjà rempli (JCG actuellement) → paying
UPDATE public.tenants SET billing_mode = 'paying'
WHERE stripe_subscription_id IS NOT NULL AND stripe_subscription_id <> '';

-- Tous les autres restent en 'test' (default)
-- Ils seront promus à 'paying' automatiquement par sync-tenant-stripe quand
-- une subscription Stripe sera trouvée à leur email.

DO $$
DECLARE
  v_paying INT; v_internal INT; v_test INT; v_free INT;
BEGIN
  SELECT
    count(*) FILTER (WHERE billing_mode = 'paying'),
    count(*) FILTER (WHERE billing_mode = 'internal'),
    count(*) FILTER (WHERE billing_mode = 'test'),
    count(*) FILTER (WHERE billing_mode = 'free')
  INTO v_paying, v_internal, v_test, v_free
  FROM public.tenants;
  RAISE NOTICE '';
  RAISE NOTICE '=== RÉPARTITION billing_mode ===';
  RAISE NOTICE '  paying   : %', v_paying;
  RAISE NOTICE '  internal : % (Advisy + Demo)', v_internal;
  RAISE NOTICE '  test     : % (à promouvoir/supprimer)', v_test;
  RAISE NOTICE '  free     : %', v_free;
END $$;
