-- ============================================================================
-- DIAGNOSTIC V1 — Détail : QUI sont les 19 users qui plantent
-- ============================================================================
-- Croise le résultat JWT-simulé avec les rôles effectifs pour comprendre
-- POURQUOI chacun plante. Dump dans king_notifications + RAISE NOTICE.
-- ============================================================================

DO $$
DECLARE
  fn record;
  v_real_scope boolean;
  v_global_roles text;
  v_tenant_roles text;
  v_has_perm boolean;
  v_results jsonb := '[]'::jsonb;
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
    -- Simule le JWT
    PERFORM set_config(
      'request.jwt.claims',
      jsonb_build_object('sub', fn.user_id::text, 'role', 'authenticated')::text,
      true
    );

    BEGIN
      v_real_scope := public.user_has_global_client_scope(fn.tenant_id);
    EXCEPTION WHEN OTHERS THEN
      v_real_scope := NULL;
    END;

    -- Récupère les rôles
    SELECT COALESCE(string_agg(ur.role::text, ','), '')
    INTO v_global_roles
    FROM public.user_roles ur
    WHERE ur.user_id = fn.user_id;

    SELECT COALESCE(string_agg(tr.name, ','), '')
    INTO v_tenant_roles
    FROM public.user_tenant_roles utr
    JOIN public.tenant_roles tr ON tr.id = utr.role_id
    WHERE utr.user_id = fn.user_id
      AND utr.tenant_id = fn.tenant_id
      AND tr.is_active = true;

    SELECT EXISTS (
      SELECT 1
      FROM public.user_tenant_roles utr
      JOIN public.tenant_roles tr ON tr.id = utr.role_id
      JOIN public.tenant_role_permissions trp ON trp.role_id = tr.id
      WHERE utr.user_id = fn.user_id
        AND utr.tenant_id = fn.tenant_id
        AND tr.is_active = true
        AND trp.module = 'clients'::public.permission_module
        AND trp.action = 'view'::public.permission_action
        AND trp.allowed = true
    ) INTO v_has_perm;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'email', fn.email,
      'tenant', fn.tenant,
      'scope_ok', v_real_scope,
      'global_roles', v_global_roles,
      'tenant_roles', v_tenant_roles,
      'has_clients_view_perm', v_has_perm
    ));
  END LOOP;

  PERFORM set_config('request.jwt.claims', NULL, true);

  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'V1 — DÉTAIL PAR USER';
  RAISE NOTICE '════════════════════════════════════════════════════════════';

  DECLARE r jsonb;
  BEGIN
    FOR r IN SELECT value FROM jsonb_array_elements(v_results) LOOP
      RAISE NOTICE '  [%] % (tenant=%) | global=[%] tenant=[%] perm=% scope=%',
        CASE WHEN (r ->> 'scope_ok')::boolean THEN 'OK' ELSE 'FAIL' END,
        r ->> 'email',
        r ->> 'tenant',
        r ->> 'global_roles',
        r ->> 'tenant_roles',
        r ->> 'has_clients_view_perm',
        r ->> 'scope_ok';
    END LOOP;
  END;

  RAISE NOTICE '════════════════════════════════════════════════════════════';

  INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
  VALUES (
    '🎯 V1 — détail par user (qui passe, qui plante, pourquoi)',
    'Dump complet : email + tenant + roles globaux + tenant_roles + permission. À lire pour identifier le pattern des 19 qui plantent.',
    'system_info',
    'high',
    jsonb_build_object('lint_targeted', 'V1_who_fails_detail', 'results', v_results)
  );
END $$;
