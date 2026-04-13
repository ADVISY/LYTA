-- Make documents RLS honor tenant role permissions, not only legacy global roles.
-- This unblocks mandate PDFs and client/policy documents for CRM users who are
-- authorized through tenant_roles / tenant_role_permissions.

DROP POLICY IF EXISTS "Tenant users can view their documents" ON public.documents;
DROP POLICY IF EXISTS "Tenant staff can create documents" ON public.documents;
DROP POLICY IF EXISTS "Tenant staff can update documents" ON public.documents;
DROP POLICY IF EXISTS "Tenant staff can delete documents" ON public.documents;

CREATE POLICY "Tenant users can view their documents"
ON public.documents
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
    OR public.has_tenant_permission('clients'::permission_module, 'view'::permission_action)
    OR public.has_tenant_permission('clients'::permission_module, 'update'::permission_action)
    OR public.has_tenant_permission('contracts'::permission_module, 'view'::permission_action)
    OR public.has_tenant_permission('contracts'::permission_module, 'deposit'::permission_action)
    OR public.has_tenant_permission('contracts'::permission_module, 'update'::permission_action)
    OR created_by = auth.uid()
    OR (
      owner_type = 'client'
      AND EXISTS (
        SELECT 1
        FROM public.clients c
        WHERE c.id = documents.owner_id
        AND c.tenant_id = public.get_user_tenant_id()
        AND (c.user_id = auth.uid() OR public.can_access_client(c.id))
      )
    )
    OR (
      owner_type = 'policy'
      AND EXISTS (
        SELECT 1
        FROM public.policies p
        WHERE p.id = documents.owner_id
        AND p.tenant_id = public.get_user_tenant_id()
        AND (
          p.client_id IS NULL
          OR (p.client_id IS NOT NULL AND public.can_access_client(p.client_id))
          OR EXISTS (
            SELECT 1
            FROM public.clients c
            WHERE c.id = p.client_id
            AND c.user_id = auth.uid()
          )
        )
      )
    )
    OR (
      owner_type = 'partner'
      AND EXISTS (
        SELECT 1
        FROM public.partners pt
        WHERE pt.id = documents.owner_id
        AND pt.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Tenant staff can create documents"
ON public.documents
FOR INSERT
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'backoffice'::app_role)
    OR public.has_role(auth.uid(), 'partner'::app_role)
    OR public.has_role(auth.uid(), 'agent'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_tenant_permission('clients'::permission_module, 'update'::permission_action)
    OR public.has_tenant_permission('contracts'::permission_module, 'deposit'::permission_action)
    OR public.has_tenant_permission('contracts'::permission_module, 'update'::permission_action)
  )
  AND (
    owner_type <> 'client'
    OR EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = documents.owner_id
      AND c.tenant_id = public.get_user_tenant_id()
    )
  )
  AND (
    owner_type <> 'policy'
    OR EXISTS (
      SELECT 1
      FROM public.policies p
      WHERE p.id = documents.owner_id
      AND p.tenant_id = public.get_user_tenant_id()
    )
  )
  AND (
    owner_type <> 'contract'
    OR EXISTS (
      SELECT 1
      FROM public.contracts ct
      JOIN public.policies p ON p.id = ct.policy_id
      WHERE ct.id = documents.owner_id
      AND p.tenant_id = public.get_user_tenant_id()
    )
  )
);

CREATE POLICY "Tenant staff can update documents"
ON public.documents
FOR UPDATE
USING (
  tenant_id = public.get_user_tenant_id()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'backoffice'::app_role)
    OR public.has_role(auth.uid(), 'partner'::app_role)
    OR public.has_role(auth.uid(), 'agent'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_tenant_permission('clients'::permission_module, 'update'::permission_action)
    OR public.has_tenant_permission('contracts'::permission_module, 'update'::permission_action)
    OR created_by = auth.uid()
  )
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'backoffice'::app_role)
    OR public.has_role(auth.uid(), 'partner'::app_role)
    OR public.has_role(auth.uid(), 'agent'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_tenant_permission('clients'::permission_module, 'update'::permission_action)
    OR public.has_tenant_permission('contracts'::permission_module, 'update'::permission_action)
    OR created_by = auth.uid()
  )
);

CREATE POLICY "Tenant staff can delete documents"
ON public.documents
FOR DELETE
USING (
  tenant_id = public.get_user_tenant_id()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'backoffice'::app_role)
    OR public.has_tenant_permission('clients'::permission_module, 'update'::permission_action)
    OR public.has_tenant_permission('contracts'::permission_module, 'update'::permission_action)
    OR created_by = auth.uid()
  )
);
