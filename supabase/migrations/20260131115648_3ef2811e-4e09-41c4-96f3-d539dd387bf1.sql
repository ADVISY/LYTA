-- Fix conflicting RLS policies on document_scans
-- The existing "Users can create scans in their tenant" policy applies to ALL roles 
-- and requires auth, which blocks anon users even with our new policy

-- Drop and recreate the authenticated user policy to only apply to authenticated users
DROP POLICY IF EXISTS "Users can create scans in their tenant" ON public.document_scans;

CREATE POLICY "Authenticated users can create scans in their tenant"
ON public.document_scans FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id IN (
    SELECT user_tenant_assignments.tenant_id
    FROM user_tenant_assignments
    WHERE user_tenant_assignments.user_id = auth.uid()
  )
);

-- The "Allow public insert to document_scans" policy for anon users is already in place
-- but let's make sure it's correctly configured for both anon AND situations where 
-- authenticated users use the public form (they don't need tenant assignment)
DROP POLICY IF EXISTS "Allow public insert to document_scans" ON public.document_scans;

CREATE POLICY "Allow public deposit form inserts"
ON public.document_scans FOR INSERT
TO anon, authenticated
WITH CHECK (
  source_type = 'deposit'
);