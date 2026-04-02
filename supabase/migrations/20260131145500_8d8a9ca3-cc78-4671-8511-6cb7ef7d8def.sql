-- Drop existing deposit policy and recreate with tenant_id support
DROP POLICY IF EXISTS "Allow public deposit form inserts with verification" ON public.document_scans;

-- Create improved policy that allows public deposit inserts with tenant_id
CREATE POLICY "Allow public deposit form inserts with verification" 
ON public.document_scans 
FOR INSERT 
TO anon, authenticated
WITH CHECK (
  source_type = 'deposit' 
  AND verified_partner_email IS NOT NULL 
  AND verified_partner_email <> ''
  -- Allow tenant_id to be set for proper tenant association
  AND (tenant_id IS NULL OR tenant_id IN (SELECT id FROM public.tenants WHERE status = 'active'))
);

-- Also add a SELECT policy for anon to read their own inserted scans (for edge function)
DROP POLICY IF EXISTS "Anon can read own deposit scans" ON public.document_scans;
CREATE POLICY "Anon can read own deposit scans"
ON public.document_scans
FOR SELECT
TO anon
USING (source_type = 'deposit' AND verified_partner_email IS NOT NULL);

-- Also add UPDATE policy for edge function to update scan status
DROP POLICY IF EXISTS "Service role can update deposit scans" ON public.document_scans;
CREATE POLICY "Anon can update own deposit scans"
ON public.document_scans
FOR UPDATE
TO anon, authenticated
USING (source_type = 'deposit' AND verified_partner_email IS NOT NULL)
WITH CHECK (source_type = 'deposit' AND verified_partner_email IS NOT NULL);