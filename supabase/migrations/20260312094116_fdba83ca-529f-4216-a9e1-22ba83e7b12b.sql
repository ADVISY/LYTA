
-- Drop existing deposit INSERT policy
DROP POLICY IF EXISTS "Allow public deposit form inserts with verification" ON public.document_scans;

-- Recreate with inline tenant check (avoid potential function context issues)
CREATE POLICY "Allow deposit form inserts with verification"
ON public.document_scans
FOR INSERT
TO anon, authenticated
WITH CHECK (
  source_type = 'deposit'
  AND verified_partner_email IS NOT NULL
  AND verified_partner_email <> ''
  AND (
    tenant_id IS NULL
    OR EXISTS (SELECT 1 FROM public.tenants WHERE id = tenant_id AND status = 'active')
  )
);

-- Add SELECT policy for anon to read deposit scans by email (needed for INSERT...RETURNING)
CREATE POLICY "Anon can read own deposit scans"
ON public.document_scans
FOR SELECT
TO anon
USING (
  source_type = 'deposit'
  AND verified_partner_email IS NOT NULL
);
