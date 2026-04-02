-- Option 1: Create a security definer function to check tenant status
-- This bypasses RLS on tenants table
CREATE OR REPLACE FUNCTION public.is_active_tenant(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenants WHERE id = p_tenant_id AND status = 'active'
  )
$$;

-- Drop and recreate the deposit policy to use the function
DROP POLICY IF EXISTS "Allow public deposit form inserts with verification" ON public.document_scans;

CREATE POLICY "Allow public deposit form inserts with verification" 
ON public.document_scans 
FOR INSERT 
TO anon, authenticated
WITH CHECK (
  source_type = 'deposit' 
  AND verified_partner_email IS NOT NULL 
  AND verified_partner_email <> ''
  -- Use security definer function to check tenant status
  AND (tenant_id IS NULL OR public.is_active_tenant(tenant_id))
);