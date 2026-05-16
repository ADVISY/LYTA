-- READ-ONLY : vérifie que les 4 plans ont leur stripe_price_id rempli
-- (pré-requis pour create-checkout-session)
DO $$
DECLARE
  r RECORD;
  v_ok INT := 0;
  v_missing INT := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== PLATFORM_PLANS — état Stripe ===';
  FOR r IN
    SELECT id, display_name, monthly_price, stripe_product_id, stripe_price_id, is_active
    FROM public.platform_plans
    ORDER BY sort_order, id
  LOOP
    IF r.stripe_price_id IS NULL OR r.stripe_price_id = '' THEN
      v_missing := v_missing + 1;
      RAISE NOTICE '  ❌ % (% CHF/mois, active=%) — stripe_price_id MANQUANT (product_id=%)',
        r.id, r.monthly_price, r.is_active, COALESCE(r.stripe_product_id, '∅');
    ELSE
      v_ok := v_ok + 1;
      RAISE NOTICE '  ✅ % (% CHF/mois, active=%) — price=%',
        r.id, r.monthly_price, r.is_active, r.stripe_price_id;
    END IF;
  END LOOP;
  RAISE NOTICE '';
  RAISE NOTICE '→ % OK, % à corriger', v_ok, v_missing;
  RAISE NOTICE '';
  IF v_missing > 0 THEN
    RAISE NOTICE 'ACTION : remplir les stripe_price_id manquants dans la table platform_plans';
    RAISE NOTICE '         (depuis le dashboard Stripe : Products → ton produit → Pricing → API ID, format "price_xxx")';
  END IF;
END;
$$;
