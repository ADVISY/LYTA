-- Align policies RLS with the rest of the CRM staff roles.
-- The previous tenant-isolated policies only allowed admins/agents/partners
-- to insert policies, and no non-admin tenant staff could update them.
-- In practice, backoffice and manager users can work in the CRM but hit
-- RLS errors when creating or editing contracts.

DROP POLICY IF EXISTS "Tenant users can view their policies" ON public.policies;
DROP POLICY IF EXISTS "Tenant staff can create policies" ON public.policies;
DROP POLICY IF EXISTS "Tenant staff can update policies" ON public.policies;

CREATE POLICY "Tenant users can view their policies"
ON public.policies
FOR SELECT
USING (
  tenant_id = public.get_user_tenant_id()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'backoffice'::app_role)
    OR public.has_role(auth.uid(), 'compta'::app_role)
    OR public.has_role(auth.uid(), 'partner'::app_role)
    OR public.has_role(auth.uid(), 'agent'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = policies.client_id
      AND c.user_id = auth.uid()
    )
    OR public.can_access_client(policies.client_id)
  )
);

CREATE POLICY "Tenant staff can create policies"
ON public.policies
FOR INSERT
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
  AND (
    client_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = policies.client_id
      AND c.tenant_id = public.get_user_tenant_id()
    )
  )
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'backoffice'::app_role)
    OR public.has_role(auth.uid(), 'partner'::app_role)
    OR public.has_role(auth.uid(), 'agent'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  )
);

CREATE POLICY "Tenant staff can update policies"
ON public.policies
FOR UPDATE
USING (
  tenant_id = public.get_user_tenant_id()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'backoffice'::app_role)
    OR public.has_role(auth.uid(), 'partner'::app_role)
    OR public.has_role(auth.uid(), 'agent'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  )
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
  AND (
    client_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = policies.client_id
      AND c.tenant_id = public.get_user_tenant_id()
    )
  )
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'backoffice'::app_role)
    OR public.has_role(auth.uid(), 'partner'::app_role)
    OR public.has_role(auth.uid(), 'agent'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  )
);
