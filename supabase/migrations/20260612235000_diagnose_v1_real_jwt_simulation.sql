-- ============================================================================
-- DIAGNOSTIC V1 (correction) — simulation JWT réelle par user UTA
-- ============================================================================
-- Le diag précédent (20260612233000) était biaisé : `auth.uid()` retourne
-- NULL dans le contexte d'une migration `DO $$`, donc TOUS les checks
-- internes de `user_has_global_client_scope()` retournaient false.
--
-- Cette migration corrige en simulant explicitement le JWT de chaque user
-- via `set_config('request.jwt.claims', jsonb)` AVANT d'appeler la fonction.
-- Résultat : le vrai verdict que PostgREST verrait en runtime.
-- ============================================================================

DO $$
DECLARE
  fn record;
  v_real_scope boolean;
  v_results jsonb := '[]'::jsonb;
  v_will_fail int := 0;
  v_will_succeed int := 0;
BEGIN
  FOR fn IN
    SELECT DISTINCT
      uta.user_id,
      uta.tenant_id,
      au.email,
      t.slug AS tenant
    FROM public.user_tenant_assignments uta
    JOIN public.tenants t ON t.id = uta.tenant_id
    LEFT JOIN auth.users au ON au.id = uta.user_id
    WHERE t.status = 'active'
    ORDER BY t.slug, au.email
  LOOP
    -- Simule le JWT de ce user spécifique
    PERFORM set_config(
      'request.jwt.claims',
      jsonb_build_object(
        'sub', fn.user_id::text,
        'role', 'authenticated'
      )::text,
      true  -- LOCAL
    );

    -- Maintenant auth.uid() retournera fn.user_id
    BEGIN
      v_real_scope := public.user_has_global_client_scope(fn.tenant_id);
    EXCEPTION WHEN OTHERS THEN
      v_real_scope := NULL;  -- erreur dans la fonction
    END;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'email', fn.email,
      'tenant', fn.tenant,
      'real_global_scope', v_real_scope
    ));

    IF v_real_scope IS NOT TRUE THEN
      v_will_fail := v_will_fail + 1;
    ELSE
      v_will_succeed := v_will_succeed + 1;
    END IF;
  END LOOP;

  -- Reset le JWT simulé
  PERFORM set_config('request.jwt.claims', NULL, true);

  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'V1 — VRAIS VERDICTS RUNTIME (JWT simulé par user)';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '  Users qui SORTENT TRUE de scope global  : % ✅', v_will_succeed;
  RAISE NOTICE '  Users qui SORTENT FALSE (vrais 42501)   : % 🔴', v_will_fail;
  RAISE NOTICE '════════════════════════════════════════════════════════════';

  INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
  VALUES (
    '🎯 V1 — vrais verdicts runtime (JWT simulé)',
    format(
      'Diagnostic corrigé avec simulation JWT par user. %s users passent (scope global OK), %s users plantent (vrais candidats 42501). Detail dans metadata.results.',
      v_will_succeed, v_will_fail
    ),
    'system_info',
    'high',
    jsonb_build_object(
      'lint_targeted', 'V1_rls_42501_real_runtime',
      'real_will_succeed', v_will_succeed,
      'real_will_fail', v_will_fail,
      'results', v_results
    )
  );
END $$;
