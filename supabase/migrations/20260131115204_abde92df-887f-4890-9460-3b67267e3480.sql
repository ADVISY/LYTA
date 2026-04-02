-- Allow anonymous users to insert document_scans from the public deposit contract page
-- The tenant_id is provided to scope the data correctly

-- First ensure RLS is enabled on the table
ALTER TABLE public.document_scans ENABLE ROW LEVEL SECURITY;

-- Drop existing anon insert policy if exists (to avoid conflicts)
DROP POLICY IF EXISTS "Allow public insert to document_scans" ON public.document_scans;

-- Policy: Allow anonymous and authenticated users to insert scans
CREATE POLICY "Allow public insert to document_scans"
ON public.document_scans FOR INSERT
TO anon, authenticated
WITH CHECK (
  source_type = 'deposit' -- Only allow from the deposit form
);

-- Also need to allow inserting document_scan_results for the edge function
-- The edge function uses service role, so we need to ensure service role has access
-- which it does by default, but let's also allow reading results for validation
DROP POLICY IF EXISTS "Allow reading own scan results" ON public.document_scan_results;

CREATE POLICY "Allow reading own scan results"
ON public.document_scan_results FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.document_scans ds
    WHERE ds.id = document_scan_results.scan_id
    AND ds.source_type = 'deposit'
  )
);