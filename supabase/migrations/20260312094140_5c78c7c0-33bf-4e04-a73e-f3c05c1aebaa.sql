
-- Fix: use SECURITY DEFINER function instead of inline query (tenants table has RLS)
DROP POLICY IF EXISTS "Allow deposit form inserts with verification" ON public.document_scans;

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
    OR public.is_active_tenant(tenant_id)
  )
);
