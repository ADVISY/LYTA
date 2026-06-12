-- ============================================================================
-- DIAGNOSTIC V1 — Pourquoi has_global_scope_v2() retourne false pour
-- les Admin Cabinet → cause réelle du 42501 au RETURNING
-- ============================================================================
-- Migration NON DESTRUCTIVE. Aucune policy modifiée. Aucune donnée touchée.
-- Lit l'état des rôles, permissions et UTA des Admin Cabinet, dump dans
-- king_notifications.
--
-- Question à laquelle on répond : pour chaque Admin Cabinet d'un tenant
-- actif, est-ce que `user_has_global_client_scope(tenant_id)` retourne
-- bien `true` ? Si non, on identifie quels users tombent dans la branche
-- "personal scope" de la policy SELECT et provoquent le 42501.
--
-- Hypothèse à confirmer : les Admin Cabinet créés via `tenant-onboarding`
-- n'ont PAS systématiquement un `tenant_role` avec :
--   - `dashboard_scope = 'global'`
--   - `tenant_role_permissions` { module='clients', action='view', allowed=true }
-- → has_global_scope_v2() = false pour eux
-- → branche 3 de la policy SELECT clients ne passe pas
-- → RETURNING fail au INSERT → 42501.
-- ============================================================================

DO $$
DECLARE
  v_admins jsonb;
  v_orphan_admins int := 0;
  v_total_active_admins int := 0;
BEGIN
  -- Liste tous les couples (user, tenant) qui ont AU MOINS un signe d'être
  -- Admin Cabinet : présent dans UTA, ou avec un tenant_role.is_active
  -- nommé Admin/Administrator/Admin Cabinet (heuristique nom).
  WITH candidates AS (
    SELECT DISTINCT uta.user_id, uta.tenant_id
    FROM public.user_tenant_assignments uta
  ),
  evaluation AS (
    SELECT
      c.user_id,
      c.tenant_id,
      t.slug AS tenant_slug,
      u.email,

      -- Si is_platform_admin (toi) → bypass déjà géré
      EXISTS (
        SELECT 1 FROM public.user_tenant_assignments uta
        WHERE uta.user_id = c.user_id
          AND uta.tenant_id = c.tenant_id
          AND uta.is_platform_admin = true
      ) AS is_platform_admin,

      -- Role global 'admin' (rare en prod)
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = c.user_id
          AND ur.role = 'admin'::public.app_role
      ) AS has_global_admin_role,

      -- A-t-il un tenant_role avec dashboard_scope='global' ?
      EXISTS (
        SELECT 1
        FROM public.user_tenant_roles utr
        JOIN public.tenant_roles tr ON tr.id = utr.role_id
        WHERE utr.user_id = c.user_id
          AND utr.tenant_id = c.tenant_id
          AND tr.tenant_id = c.tenant_id
          AND tr.is_active = true
          AND tr.dashboard_scope = 'global'::public.dashboard_scope
      ) AS has_tenant_role_global,

      -- A-t-il la perm clients.view via tenant_role + tenant_role_permissions ?
      EXISTS (
        SELECT 1
        FROM public.user_tenant_roles utr
        JOIN public.tenant_roles tr ON tr.id = utr.role_id
        JOIN public.tenant_role_permissions trp ON trp.role_id = tr.id
        WHERE utr.user_id = c.user_id
          AND utr.tenant_id = c.tenant_id
          AND tr.tenant_id = c.tenant_id
          AND tr.is_active = true
          AND tr.dashboard_scope = 'global'::public.dashboard_scope
          AND trp.module = 'clients'::public.permission_module
          AND trp.action = 'view'::public.permission_action
          AND trp.allowed = true
      ) AS has_clients_view_global,

      -- Et le verdict final via la fonction réelle utilisée par la policy
      public.user_has_global_client_scope(c.tenant_id) AS has_global_scope_v2_result
    FROM candidates c
    JOIN public.tenants t ON t.id = c.tenant_id
    LEFT JOIN auth.users u ON u.id = c.user_id
    WHERE t.is_active = true
  )
  SELECT
    jsonb_agg(jsonb_build_object(
      'email', email,
      'tenant', tenant_slug,
      'is_platform_admin', is_platform_admin,
      'has_global_admin_role', has_global_admin_role,
      'has_tenant_role_global', has_tenant_role_global,
      'has_clients_view_global', has_clients_view_global,
      'has_global_scope_v2_result', has_global_scope_v2_result,
      'will_fail_returning', NOT (
        is_platform_admin
        OR has_global_admin_role
        OR has_clients_view_global
      )
    ) ORDER BY tenant_slug, email)
  INTO v_admins
  FROM evaluation
  WHERE NOT has_global_scope_v2_result;  -- on ne dump que ceux qui FAILLENT

  -- Compteurs
  v_orphan_admins := COALESCE(jsonb_array_length(v_admins), 0);

  SELECT COUNT(*) INTO v_total_active_admins
  FROM public.user_tenant_assignments uta
  JOIN public.tenants t ON t.id = uta.tenant_id
  WHERE t.is_active = true;

  -- Dump dans king_notifications
  INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
  VALUES (
    '🔍 V1 diagnostic ciblé — users sans has_global_scope_v2()',
    format(
      '%s/%s membres UTA tenants actifs sortent FALSE de user_has_global_client_scope() → ils déclenchent le 42501 au INSERT clients RETURNING. Cf. metadata pour la liste détaillée. Si > 0, c''est notre vraie root cause V1 (tenant-onboarding ne provisionne pas le tenant_role+perms).',
      v_orphan_admins, v_total_active_admins
    ),
    'system_info',
    'high',
    jsonb_build_object(
      'lint_targeted', 'V1_rls_42501_root_cause_scopes',
      'orphan_users_count', v_orphan_admins,
      'total_uta_active_tenants', v_total_active_admins,
      'orphan_users_detail', COALESCE(v_admins, '[]'::jsonb),
      'date_diagnostic', now()
    )
  );

  RAISE NOTICE 'Diagnostic V1 scopes : %/% users UTA tenants actifs n''ont PAS de scope global → bug 42501 attendu pour eux',
    v_orphan_admins, v_total_active_admins;
END $$;
