-- Fix suivis UPDATE policy - assigned_agent_id references clients table, not profiles
-- The comparison should be done through user_id lookup
DROP POLICY IF EXISTS "Tenant staff can update suivis" ON public.suivis;

CREATE POLICY "Tenant staff can update suivis" ON public.suivis
FOR UPDATE USING (
  (tenant_id = get_user_tenant_id()) AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    has_role(auth.uid(), 'agent'::app_role) OR
    has_role(auth.uid(), 'backoffice'::app_role) OR
    -- Check if the agent is the current user through clients table
    (assigned_agent_id IN (SELECT id FROM clients WHERE user_id = auth.uid()))
  )
);

-- Fix documents INSERT policy - add WITH CHECK for proper tenant assignment
DROP POLICY IF EXISTS "Tenant staff can create documents" ON public.documents;

CREATE POLICY "Tenant staff can create documents" ON public.documents
FOR INSERT WITH CHECK (
  (tenant_id = get_user_tenant_id()) AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'backoffice'::app_role) OR 
    has_role(auth.uid(), 'partner'::app_role) OR 
    has_role(auth.uid(), 'agent'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role)
  )
);

-- Also add UPDATE policy for documents for staff
DROP POLICY IF EXISTS "Tenant staff can update documents" ON public.documents;

CREATE POLICY "Tenant staff can update documents" ON public.documents
FOR UPDATE USING (
  (tenant_id = get_user_tenant_id()) AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'backoffice'::app_role) OR 
    has_role(auth.uid(), 'partner'::app_role) OR 
    has_role(auth.uid(), 'agent'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    created_by = auth.uid()
  )
);

-- Add DELETE policy for documents for staff
DROP POLICY IF EXISTS "Tenant staff can delete documents" ON public.documents;

CREATE POLICY "Tenant staff can delete documents" ON public.documents
FOR DELETE USING (
  (tenant_id = get_user_tenant_id()) AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'backoffice'::app_role) OR
    created_by = auth.uid()
  )
);