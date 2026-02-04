-- =====================================================
-- SECURITY PATCH v2: Fix RLS vulnerabilities on document scanning tables
-- =====================================================

-- 1. DROP the overly permissive policy on document_scan_results for anonymous reads
DROP POLICY IF EXISTS "Allow reading own scan results" ON public.document_scan_results;

-- 2. DROP the overly permissive anonymous policy on document_scans
DROP POLICY IF EXISTS "Anon can read own deposit scans" ON public.document_scans;

-- 3. DROP the anonymous update policy on document_scans (dangerous!)
DROP POLICY IF EXISTS "Anon can update own deposit scans" ON public.document_scans;

-- 4. Create a more secure policy for deposit form reads - only during active session
-- Partners can only read their own scans by verified_partner_id (not email exposure)
CREATE POLICY "Deposit scans read by verified partner id" 
ON public.document_scans 
FOR SELECT 
USING (
  source_type = 'deposit' 
  AND verified_partner_id IS NOT NULL
  AND verified_partner_id = auth.uid()
);

-- 5. Create a SECURITY DEFINER function to read scan status without exposing data
CREATE OR REPLACE FUNCTION public.get_deposit_scan_status(p_scan_id uuid, p_partner_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Only return minimal status info, not personal data
  SELECT jsonb_build_object(
    'scan_id', id,
    'status', status,
    'created_at', created_at,
    'documents_processed', CASE WHEN status = 'completed' THEN 
      (SELECT COUNT(*) FROM document_scan_results WHERE scan_id = p_scan_id)
    ELSE 0 END
  ) INTO v_result
  FROM document_scans
  WHERE id = p_scan_id
    AND source_type = 'deposit'
    AND LOWER(verified_partner_email) = LOWER(p_partner_email);
  
  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

-- Grant execute to anon for deposit form status checks
GRANT EXECUTE ON FUNCTION public.get_deposit_scan_status(uuid, text) TO anon;

-- 6. Create rate limiting table for API abuse prevention (without problematic index)
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  endpoint text NOT NULL,
  window_hour timestamptz NOT NULL DEFAULT date_trunc('hour', now()),
  request_count integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- Simple composite index (no function in expression)
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup 
ON public.api_rate_limits(identifier, endpoint, window_hour);

-- Enable RLS on rate limits - only service role can access
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

-- No public access to rate limits
CREATE POLICY "Service role only" ON public.api_rate_limits
FOR ALL USING (false);

-- 7. Create audit log indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_tenant ON public.audit_logs(user_id, tenant_id);

-- 8. Fix email_templates to only expose system templates to authenticated users
DROP POLICY IF EXISTS "Users can view templates for their tenant or system templates" ON public.email_templates;
DROP POLICY IF EXISTS "Tenant users can view their templates" ON public.email_templates;

CREATE POLICY "Authenticated users can view their tenant templates or system templates" 
ON public.email_templates 
FOR SELECT 
TO authenticated
USING (
  is_system = true 
  OR tenant_id = get_user_tenant_id()
);

-- 9. Secure document_categories for authenticated only
DROP POLICY IF EXISTS "Anyone can view categories" ON public.document_categories;

CREATE POLICY "Authenticated can view categories" 
ON public.document_categories 
FOR SELECT 
TO authenticated
USING (is_system = true OR tenant_id = get_user_tenant_id());

-- 10. Secure platform_plans for authenticated only (hide Stripe IDs from public)
DROP POLICY IF EXISTS "Anyone can view plans" ON public.platform_plans;

CREATE POLICY "Authenticated can view plans" 
ON public.platform_plans 
FOR SELECT 
TO authenticated
USING (true);

-- 11. Secure platform_modules for authenticated only
DROP POLICY IF EXISTS "Anyone can view modules" ON public.platform_modules;

CREATE POLICY "Authenticated can view modules" 
ON public.platform_modules 
FOR SELECT 
TO authenticated
USING (true);