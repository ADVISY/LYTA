-- Scope collaborator permission writes to the current tenant and allow tenant
-- role admins to manage them. The original policy only accepted the legacy
-- global admin role, so tenant admins were blocked by RLS on insert.

UPDATE public.collaborator_permissions cp
SET tenant_id = c.tenant_id
FROM public.clients c
WHERE c.id = cp.collaborator_id
  AND c.tenant_id IS NOT NULL
  AND cp.tenant_id IS DISTINCT FROM c.tenant_id;

DROP POLICY IF EXISTS "Admins can manage all permissions" ON public.collaborator_permissions;
DROP POLICY IF EXISTS "Staff can view permissions" ON public.collaborator_permissions;
DROP POLICY IF EXISTS "Tenant users can view collaborator permissions" ON public.collaborator_permissions;
DROP POLICY IF EXISTS "Tenant admins can insert collaborator permissions" ON public.collaborator_permissions;
DROP POLICY IF EXISTS "Tenant admins can update collaborator permissions" ON public.collaborator_permissions;
DROP POLICY IF EXISTS "Tenant admins can delete collaborator permissions" ON public.collaborator_permissions;

CREATE POLICY "Tenant users can view collaborator permissions"
ON public.collaborator_permissions
FOR SELECT
USING (
  public.is_king()
  OR (
    tenant_id = public.get_user_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = collaborator_permissions.collaborator_id
        AND c.tenant_id = collaborator_permissions.tenant_id
    )
    AND (
      public.is_tenant_admin()
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'manager'::app_role)
      OR public.has_role(auth.uid(), 'agent'::app_role)
      OR public.has_tenant_permission('collaborators'::permission_module, 'view'::permission_action)
      OR public.has_tenant_permission('settings'::permission_module, 'view'::permission_action)
      OR EXISTS (
        SELECT 1
        FROM public.clients c
        WHERE c.id = collaborator_permissions.collaborator_id
          AND c.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Tenant admins can insert collaborator permissions"
ON public.collaborator_permissions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = collaborator_permissions.collaborator_id
      AND c.tenant_id = collaborator_permissions.tenant_id
      AND c.type_adresse = 'collaborateur'
  )
  AND (
    public.is_king()
    OR (
      tenant_id = public.get_user_tenant_id()
      AND (
        public.is_tenant_admin()
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_tenant_permission('collaborators'::permission_module, 'update'::permission_action)
        OR public.has_tenant_permission('settings'::permission_module, 'update'::permission_action)
      )
    )
  )
);

CREATE POLICY "Tenant admins can update collaborator permissions"
ON public.collaborator_permissions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = collaborator_permissions.collaborator_id
      AND c.tenant_id = collaborator_permissions.tenant_id
      AND c.type_adresse = 'collaborateur'
  )
  AND (
    public.is_king()
    OR (
      tenant_id = public.get_user_tenant_id()
      AND (
        public.is_tenant_admin()
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_tenant_permission('collaborators'::permission_module, 'update'::permission_action)
        OR public.has_tenant_permission('settings'::permission_module, 'update'::permission_action)
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = collaborator_permissions.collaborator_id
      AND c.tenant_id = collaborator_permissions.tenant_id
      AND c.type_adresse = 'collaborateur'
  )
  AND (
    public.is_king()
    OR (
      tenant_id = public.get_user_tenant_id()
      AND (
        public.is_tenant_admin()
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_tenant_permission('collaborators'::permission_module, 'update'::permission_action)
        OR public.has_tenant_permission('settings'::permission_module, 'update'::permission_action)
      )
    )
  )
);

CREATE POLICY "Tenant admins can delete collaborator permissions"
ON public.collaborator_permissions
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = collaborator_permissions.collaborator_id
      AND c.tenant_id = collaborator_permissions.tenant_id
      AND c.type_adresse = 'collaborateur'
  )
  AND (
    public.is_king()
    OR (
      tenant_id = public.get_user_tenant_id()
      AND (
        public.is_tenant_admin()
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_tenant_permission('collaborators'::permission_module, 'update'::permission_action)
        OR public.has_tenant_permission('settings'::permission_module, 'update'::permission_action)
      )
    )
  )
);
