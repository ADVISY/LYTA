-- ============================================================================
-- DIAGNOSTIC V1 (suite) — Quel est le rôle effectif de chaque user UTA ?
-- ============================================================================
-- Migration NON DESTRUCTIVE. Aucune modification. Dump dans king_notifications.
--
-- Constat précédent : 29/29 users UTA des tenants actifs sortent FALSE de
-- user_has_global_client_scope() → 42501 garanti au RETURNING.
--
-- Cette migration creuse : pour chacun de ces 29 users, où est leur rôle ?
--
--   • user_roles.role (app_role global : king/admin/manager/agent/…)
--   • user_tenant_roles → tenant_roles (rôle spécifique tenant)
--   • tenant_role_permissions (clients.view allowed ?)
--
-- Verdict : si ces 3 sources sont vides ou mal câblées, c'est confirmé que
-- le bug est dans le PROVISIONNING des rôles, pas dans les policies RLS.
-- ============================================================================

DO $$
DECLARE
  v_dump jsonb;
BEGIN
  WITH uta_users AS (
    SELECT DISTINCT uta.user_id, uta.tenant_id
    FROM public.user_tenant_assignments uta
    JOIN public.tenants t ON t.id = uta.tenant_id
    WHERE t.status = 'active'
  ),
  details AS (
    SELECT
      u.user_id,
      u.tenant_id,
      t.slug AS tenant,
      au.email,

      -- Rôles globaux app_role (peut y en avoir plusieurs)
      (
        SELECT COALESCE(jsonb_agg(ur.role::text ORDER BY ur.role::text), '[]'::jsonb)
        FROM public.user_roles ur
        WHERE ur.user_id = u.user_id
      ) AS global_app_roles,

      -- Rôles tenant via user_tenant_roles → tenant_roles
      (
        SELECT COALESCE(
          jsonb_agg(jsonb_build_object(
            'tenant_role_name', tr.name,
            'dashboard_scope', tr.dashboard_scope::text,
            'is_active', tr.is_active
          ) ORDER BY tr.name),
          '[]'::jsonb
        )
        FROM public.user_tenant_roles utr
        JOIN public.tenant_roles tr ON tr.id = utr.role_id
        WHERE utr.user_id = u.user_id
          AND utr.tenant_id = u.tenant_id
      ) AS tenant_roles_assigned,

      -- A-t-il quelque part la perm clients.view activée ?
      EXISTS (
        SELECT 1
        FROM public.user_tenant_roles utr
        JOIN public.tenant_roles tr ON tr.id = utr.role_id
        JOIN public.tenant_role_permissions trp ON trp.role_id = tr.id
        WHERE utr.user_id = u.user_id
          AND utr.tenant_id = u.tenant_id
          AND tr.is_active = true
          AND trp.module = 'clients'::public.permission_module
          AND trp.action = 'view'::public.permission_action
          AND trp.allowed = true
      ) AS has_clients_view_anywhere,

      (
        SELECT uta.is_platform_admin
        FROM public.user_tenant_assignments uta
        WHERE uta.user_id = u.user_id
          AND uta.tenant_id = u.tenant_id
        LIMIT 1
      ) AS is_platform_admin
    FROM uta_users u
    JOIN public.tenants t ON t.id = u.tenant_id
    LEFT JOIN auth.users au ON au.id = u.user_id
  )
  SELECT jsonb_agg(jsonb_build_object(
    'email', email,
    'tenant', tenant,
    'is_platform_admin', is_platform_admin,
    'global_app_roles', global_app_roles,
    'tenant_roles_assigned', tenant_roles_assigned,
    'has_clients_view_anywhere', has_clients_view_anywhere,
    'verdict', CASE
      WHEN is_platform_admin THEN 'PLATFORM_ADMIN_OK'
      WHEN jsonb_array_length(global_app_roles) = 0
       AND jsonb_array_length(tenant_roles_assigned) = 0 THEN 'AUCUN_ROLE_NULLE_PART'
      WHEN jsonb_array_length(tenant_roles_assigned) = 0 THEN 'ROLE_GLOBAL_SEUL_PAS_DE_TENANT_ROLE'
      WHEN NOT has_clients_view_anywhere THEN 'TENANT_ROLE_SANS_PERM_CLIENTS_VIEW'
      ELSE 'AUTRE'
    END
  ) ORDER BY tenant, email)
  INTO v_dump
  FROM details;

  INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
  VALUES (
    '🔍 V1 diagnostic suite — rôles effectifs des 29 users UTA',
    'Pour chaque user UTA, dump des rôles globaux + tenant_roles + permission clients.view. Cherche `verdict` dans metadata : AUCUN_ROLE_NULLE_PART, ROLE_GLOBAL_SEUL_PAS_DE_TENANT_ROLE, TENANT_ROLE_SANS_PERM_CLIENTS_VIEW. Ces patterns indiquent où la chaîne casse et donc quel fix est nécessaire.',
    'system_info',
    'high',
    jsonb_build_object(
      'lint_targeted', 'V1_rls_42501_root_cause_roles_detail',
      'users_detail', COALESCE(v_dump, '[]'::jsonb),
      'date_diagnostic', now()
    )
  );

  RAISE NOTICE 'Diagnostic rôles dumpé. Cf. king_notifications metadata.users_detail.verdict pour comprendre où la chaîne casse';
END $$;
