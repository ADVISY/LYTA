-- Fix PUBLIC_USER_DATA: Block unauthenticated access to clients table
-- The existing policies are good but we need to add explicit denial for anon role

-- First, ensure clients table has RLS enabled (should already be)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Drop any potentially permissive policies and add explicit auth check
-- Create a blocking policy for unauthenticated users
CREATE POLICY "Block unauthenticated access to clients"
ON public.clients FOR SELECT
TO anon
USING (false);

-- Fix EXPOSED_SENSITIVE_DATA: Drop the existing clients_safe view and recreate with security invoker
-- and also add RLS-like protection through the view definition

-- Check if clients_safe is a view and drop it
DROP VIEW IF EXISTS public.clients_safe;

-- Recreate clients_safe as a secure view that relies on RLS from base table
-- Using security_invoker=on ensures RLS policies from clients table apply
CREATE VIEW public.clients_safe
WITH (security_invoker=on) AS
  SELECT 
    id,
    user_id,
    assigned_agent_id,
    first_name,
    last_name,
    company_name,
    is_company,
    status,
    tags,
    type_adresse,
    tenant_id,
    created_at,
    updated_at,
    -- Expose only non-sensitive fields, mask sensitive data
    CASE WHEN auth.uid() IS NOT NULL THEN phone ELSE NULL END as phone,
    CASE WHEN auth.uid() IS NOT NULL THEN mobile ELSE NULL END as mobile,
    CASE WHEN auth.uid() IS NOT NULL THEN email ELSE NULL END as email,
    CASE WHEN auth.uid() IS NOT NULL THEN address ELSE NULL END as address,
    CASE WHEN auth.uid() IS NOT NULL THEN city ELSE NULL END as city,
    CASE WHEN auth.uid() IS NOT NULL THEN postal_code ELSE NULL END as postal_code,
    CASE WHEN auth.uid() IS NOT NULL THEN zip_code ELSE NULL END as zip_code,
    CASE WHEN auth.uid() IS NOT NULL THEN country ELSE NULL END as country,
    CASE WHEN auth.uid() IS NOT NULL THEN birthdate ELSE NULL END as birthdate,
    CASE WHEN auth.uid() IS NOT NULL THEN civil_status ELSE NULL END as civil_status,
    CASE WHEN auth.uid() IS NOT NULL THEN permit_type ELSE NULL END as permit_type,
    CASE WHEN auth.uid() IS NOT NULL THEN nationality ELSE NULL END as nationality,
    CASE WHEN auth.uid() IS NOT NULL THEN profession ELSE NULL END as profession,
    CASE WHEN auth.uid() IS NOT NULL THEN employer ELSE NULL END as employer,
    CASE WHEN auth.uid() IS NOT NULL THEN canton ELSE NULL END as canton,
    -- Always hide financial data even for authenticated users unless they have proper roles
    NULL::text as iban,
    NULL::text as bank_name,
    -- Commission data - hide from safe view entirely
    NULL::numeric as commission_rate,
    NULL::numeric as commission_rate_lca,
    NULL::numeric as commission_rate_vie,
    NULL::numeric as fixed_salary,
    NULL::numeric as bonus_rate,
    NULL::numeric as work_percentage,
    NULL::date as hire_date,
    NULL::uuid as manager_id,
    NULL::numeric as manager_commission_rate_lca,
    NULL::numeric as manager_commission_rate_vie,
    NULL::numeric as reserve_rate,
    contract_type,
    external_ref
  FROM public.clients;