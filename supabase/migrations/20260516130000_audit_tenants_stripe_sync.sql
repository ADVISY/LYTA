-- READ-ONLY : état réel de la sync Stripe ↔ tenants
DO $$
DECLARE
  r RECORD;
  v_total INT;
  v_with_customer INT;
  v_with_sub INT;
  v_with_mrr INT;
  v_total_mrr NUMERIC;
BEGIN
  SELECT
    count(*) FILTER (WHERE true),
    count(*) FILTER (WHERE stripe_customer_id IS NOT NULL AND stripe_customer_id <> ''),
    count(*) FILTER (WHERE stripe_subscription_id IS NOT NULL AND stripe_subscription_id <> ''),
    count(*) FILTER (WHERE COALESCE(mrr_amount, 0) > 0),
    COALESCE(SUM(mrr_amount), 0)
  INTO v_total, v_with_customer, v_with_sub, v_with_mrr, v_total_mrr
  FROM public.tenants
  WHERE COALESCE(tenant_status, status) NOT IN ('cancelled', 'suspended');

  RAISE NOTICE '';
  RAISE NOTICE '=== ÉTAT SYNC STRIPE ↔ TENANTS ===';
  RAISE NOTICE '  Tenants actifs/test/pending : %', v_total;
  RAISE NOTICE '  Avec stripe_customer_id     : % (%%%)', v_with_customer, ROUND(100.0*v_with_customer/NULLIF(v_total,0), 1);
  RAISE NOTICE '  Avec stripe_subscription_id : % (%%%)', v_with_sub, ROUND(100.0*v_with_sub/NULLIF(v_total,0), 1);
  RAISE NOTICE '  Avec mrr_amount > 0         : % (%%%)', v_with_mrr, ROUND(100.0*v_with_mrr/NULLIF(v_total,0), 1);
  RAISE NOTICE '  MRR total calculé           : % CHF', v_total_mrr;
  RAISE NOTICE '';

  RAISE NOTICE '=== TENANTS SANS sync Stripe (= bloquent le dashboard) ===';
  FOR r IN
    SELECT id, name, slug, plan, status, tenant_status, payment_status,
           stripe_customer_id, stripe_subscription_id, mrr_amount, signup_source, created_at
    FROM public.tenants
    WHERE COALESCE(tenant_status, status) NOT IN ('cancelled', 'suspended')
      AND (stripe_customer_id IS NULL OR stripe_customer_id = ''
           OR stripe_subscription_id IS NULL OR stripe_subscription_id = ''
           OR COALESCE(mrr_amount, 0) = 0)
    ORDER BY created_at DESC
    LIMIT 30
  LOOP
    RAISE NOTICE '  % | "%" plan=% status=%/% pay=% cust=% sub=% mrr=% source=%',
      r.id, r.name,
      COALESCE(r.plan::text, '∅'),
      COALESCE(r.status, '∅'), COALESCE(r.tenant_status, '∅'),
      COALESCE(r.payment_status, '∅'),
      COALESCE(r.stripe_customer_id, '∅'),
      COALESCE(r.stripe_subscription_id, '∅'),
      COALESCE(r.mrr_amount, 0),
      COALESCE(r.signup_source, '∅');
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '=== TENANTS BIEN sync (sanity check) ===';
  FOR r IN
    SELECT id, name, slug, plan, mrr_amount, stripe_subscription_id
    FROM public.tenants
    WHERE stripe_subscription_id IS NOT NULL AND stripe_subscription_id <> ''
      AND COALESCE(mrr_amount, 0) > 0
    ORDER BY mrr_amount DESC
    LIMIT 10
  LOOP
    RAISE NOTICE '  ✅ % | "%" plan=% mrr=% sub=%',
      r.id, r.name, r.plan::text, r.mrr_amount, r.stripe_subscription_id;
  END LOOP;
END $$;
