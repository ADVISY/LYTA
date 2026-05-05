-- Centralize client INSERT authorization and recognize historical tenant
-- admins even when older backfills missed tenant_role_permissions or
-- user_tenant_roles. This keeps the check scoped to the target tenant.

CREATE OR REPLACE FUNCTION public.user_is_linked_to_tenant(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_king()
    OR EXISTS (
      SELECT 1
      FROM public.user_tenant_assignments uta
      WHERE uta.user_id = auth.uid()
        AND uta.tenant_id = p_tenant_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_tenant_roles utr
      JOIN public.tenant_roles tr ON tr.id = utr.role_id
      WHERE utr.user_id = auth.uid()
        AND tr.tenant_id = p_tenant_id
        AND tr.is_active = true
        AND (
          utr.tenant_id = p_tenant_id
          OR utr.tenant_id IS NULL
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.user_id = auth.uid()
        AND c.tenant_id = p_tenant_id
        AND c.type_adresse = 'collaborateur'
    )
$$;

GRANT EXECUTE ON FUNCTION public.user_is_linked_to_tenant(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_tenant_admin_for_tenant(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_king()
    OR EXISTS (
      SELECT 1
      FROM public.user_tenant_assignments uta
      WHERE uta.user_id = auth.uid()
        AND uta.tenant_id = p_tenant_id
        AND uta.is_platform_admin = true
    )
    OR (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      AND public.user_is_linked_to_tenant(p_tenant_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_tenant_roles utr
      JOIN public.tenant_roles tr ON tr.id = utr.role_id
      WHERE utr.user_id = auth.uid()
        AND tr.tenant_id = p_tenant_id
        AND tr.is_active = true
        AND (
          utr.tenant_id = p_tenant_id
          OR utr.tenant_id IS NULL
        )
        AND (
          tr.name ILIKE '%admin%'
          OR tr.name ILIKE '%administrateur%'
          OR tr.name ILIKE '%owner%'
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.user_id = auth.uid()
        AND c.tenant_id = p_tenant_id
        AND c.type_adresse = 'collaborateur'
        AND lower(COALESCE(c.profession, '')) IN ('admin', 'administrateur', 'direction')
    )
    OR public.has_tenant_permission_for_tenant(
      p_tenant_id,
      'settings'::public.permission_module,
      'update'::public.permission_action
    )
$$;

GRANT EXECUTE ON FUNCTION public.is_tenant_admin_for_tenant(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_create_client_in_tenant(
  p_tenant_id uuid,
  p_type_adresse text DEFAULT 'client'
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_tenant_id IS NOT NULL
    AND auth.uid() IS NOT NULL
    AND (
      public.is_tenant_admin_for_tenant(p_tenant_id)
      OR (
        public.user_is_linked_to_tenant(p_tenant_id)
        AND (
          public.has_tenant_permission_for_tenant(
            p_tenant_id,
            'clients'::public.permission_module,
            'create'::public.permission_action
          )
          OR public.has_role(auth.uid(), 'manager'::public.app_role)
          OR public.has_role(auth.uid(), 'agent'::public.app_role)
          OR public.has_role(auth.uid(), 'partner'::public.app_role)
          OR public.has_role(auth.uid(), 'backoffice'::public.app_role)
          OR (
            p_type_adresse = 'collaborateur'
            AND (
              public.has_tenant_permission_for_tenant(
                p_tenant_id,
                'collaborators'::public.permission_module,
                'create'::public.permission_action
              )
              OR public.has_tenant_permission_for_tenant(
                p_tenant_id,
                'settings'::public.permission_module,
                'update'::public.permission_action
              )
            )
          )
        )
      )
    )
$$;

GRANT EXECUTE ON FUNCTION public.can_create_client_in_tenant(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.user_has_global_client_scope(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_tenant_admin_for_tenant(p_tenant_id)
    OR (
      public.user_is_linked_to_tenant(p_tenant_id)
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
        AND tr.tenant_id = p_tenant_id
        AND tr.is_active = true
        AND (
          utr.tenant_id = p_tenant_id
          OR utr.tenant_id IS NULL
        )
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
  public.can_create_client_in_tenant(tenant_id, type_adresse)
);
