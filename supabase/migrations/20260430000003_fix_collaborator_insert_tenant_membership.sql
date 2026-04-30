-- Keep client/collaborator INSERT RLS aligned with the hybrid legacy
-- user_roles + tenant_roles authorization model. Some historical tenant
-- admins have a tenant role or legacy global admin role but no row in
-- user_tenant_assignments for the tenant they administer.

CREATE OR REPLACE FUNCTION public.user_can_insert_in_tenant(_tenant_id uuid)
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
        AND uta.tenant_id = _tenant_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_tenant_roles utr
      JOIN public.tenant_roles tr ON tr.id = utr.role_id
      WHERE utr.user_id = auth.uid()
        AND utr.tenant_id = _tenant_id
        AND tr.tenant_id = _tenant_id
        AND tr.is_active = true
    )
$$;

GRANT EXECUTE ON FUNCTION public.user_can_insert_in_tenant(uuid) TO authenticated;

DROP POLICY IF EXISTS "Tenant staff can create clients" ON public.clients;

CREATE POLICY "Tenant staff can create clients"
ON public.clients
FOR INSERT
WITH CHECK (
  public.user_can_insert_in_tenant(tenant_id)
  AND (
    public.user_has_global_client_scope(tenant_id)
    OR public.has_tenant_permission_for_tenant(tenant_id, 'clients'::public.permission_module, 'create'::public.permission_action)
    OR (
      type_adresse = 'collaborateur'
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
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
