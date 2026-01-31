-- Fix RLS policy for document SELECT to allow all tenant staff to view documents
-- Current policy is too restrictive - only allows admin and backoffice

DROP POLICY IF EXISTS "Tenant users can view their documents" ON public.documents;

CREATE POLICY "Tenant users can view their documents" 
ON public.documents 
FOR SELECT 
USING (
  (tenant_id = get_user_tenant_id()) 
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'backoffice'::app_role)
    OR has_role(auth.uid(), 'agent'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'partner'::app_role)
    OR has_role(auth.uid(), 'compta'::app_role)
    OR (created_by = auth.uid())
    OR (
      (owner_type = 'client'::text) 
      AND (EXISTS (
        SELECT 1 FROM clients c WHERE (c.id = documents.owner_id) AND (c.user_id = auth.uid())
      ))
    )
  )
);