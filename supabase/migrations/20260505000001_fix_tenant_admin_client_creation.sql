-- Tenant admins must be allowed to create clients even when historical tenant
-- role permission rows are incomplete. The frontend treats active admin roles
-- as all-access, so RLS needs the same target-tenant check.

CREATE OR REPLACE FUNCTION public.is_tenant_admin_for_tenant(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_king()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.user_tenant_assignments uta
      WHERE uta.user_id = auth.uid()
        AND uta.tenant_id = p_tenant_id
        AND uta.is_platform_admin = true
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_tenant_roles utr
      JOIN public.tenant_roles tr ON tr.id = utr.role_id
      WHERE utr.user_id = auth.uid()
        AND utr.tenant_id = p_tenant_id
        AND tr.tenant_id = p_tenant_id
        AND tr.is_active = true
        AND (
          tr.name ILIKE '%admin%'
          OR tr.name ILIKE '%administrateur%'
        )
    )
    OR public.has_tenant_permission_for_tenant(
      p_tenant_id,
      'settings'::public.permission_module,
      'update'::public.permission_action
    )
$$;

GRANT EXECUTE ON FUNCTION public.is_tenant_admin_for_tenant(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.user_has_global_client_scope(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_tenant_admin_for_tenant(p_tenant_id)
    OR EXISTS (
      SELECT 1
      FROM public.user_tenant_assignments uta
      WHERE uta.user_id = auth.uid()
        AND uta.tenant_id = p_tenant_id
        AND uta.is_platform_admin = true
    )
    OR (
      EXISTS (
        SELECT 1
        FROM public.user_tenant_assignments uta
        WHERE uta.user_id = auth.uid()
          AND uta.tenant_id = p_tenant_id
      )
      AND (
        public.has_role(auth.uid(), 'backoffice'::public.app_role)
        OR public.has_role(auth.uid(), 'compta'::public.app_role)
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_tenant_roles utr
      JOIN public.tenant_roles tr ON tr.id = utr.role_id
      JOIN public.tenant_role_permissions trp ON trp.role_id = tr.id
      WHERE utr.user_id = auth.uid()
        AND utr.tenant_id = p_tenant_id
        AND tr.tenant_id = p_tenant_id
        AND tr.is_active = true
        AND tr.dashboard_scope = 'global'::public.dashboard_scope
        AND trp.module = 'clients'::public.permission_module
        AND trp.action = 'view'::public.permission_action
        AND trp.allowed = true
    )
$$;

DROP POLICY IF EXISTS "Tenant staff can create clients" ON public.clients;

CREATE POLICY "Tenant staff can create clients"
ON public.clients
FOR INSERT
WITH CHECK (
  public.user_can_insert_in_tenant(tenant_id)
  AND (
    public.user_has_global_client_scope(tenant_id)
    OR public.is_tenant_admin_for_tenant(tenant_id)
    OR public.has_tenant_permission_for_tenant(tenant_id, 'clients'::public.permission_module, 'create'::public.permission_action)
    OR (
      type_adresse = 'collaborateur'
      AND (
        public.is_tenant_admin_for_tenant(tenant_id)
        OR public.has_tenant_permission_for_tenant(tenant_id, 'collaborators'::public.permission_module, 'create'::public.permission_action)
        OR public.has_tenant_permission_for_tenant(tenant_id, 'settings'::public.permission_module, 'update'::public.permission_action)
      )
    )
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
    OR public.has_role(auth.uid(), 'agent'::public.app_role)
    OR public.has_role(auth.uid(), 'partner'::public.app_role)
    OR public.has_role(auth.uid(), 'backoffice'::public.app_role)
  )
);
