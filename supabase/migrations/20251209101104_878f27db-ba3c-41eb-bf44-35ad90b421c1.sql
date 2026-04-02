-- Fix: Drop the security definer view and recreate as SECURITY INVOKER (default, safer)
DROP VIEW IF EXISTS public.clients_safe;

-- Recreate view without SECURITY DEFINER - uses caller's permissions
CREATE VIEW public.clients_safe AS
SELECT 
  id,
  user_id,
  birthdate,
  is_company,
  created_at,
  updated_at,
  assigned_agent_id,
  CASE WHEN public.can_view_financial_data() THEN commission_rate ELSE NULL END as commission_rate,
  CASE WHEN public.can_view_financial_data() THEN fixed_salary ELSE NULL END as fixed_salary,
  CASE WHEN public.can_view_financial_data() THEN bonus_rate ELSE NULL END as bonus_rate,
  work_percentage,
  hire_date,
  CASE WHEN public.can_view_financial_data() THEN commission_rate_lca ELSE NULL END as commission_rate_lca,
  CASE WHEN public.can_view_financial_data() THEN commission_rate_vie ELSE NULL END as commission_rate_vie,
  manager_id,
  CASE WHEN public.can_view_financial_data() THEN manager_commission_rate_lca ELSE NULL END as manager_commission_rate_lca,
  CASE WHEN public.can_view_financial_data() THEN manager_commission_rate_vie ELSE NULL END as manager_commission_rate_vie,
  CASE WHEN public.can_view_financial_data() THEN reserve_rate ELSE NULL END as reserve_rate,
  external_ref,
  company_name,
  phone,
  address,
  city,
  postal_code,
  country,
  CASE WHEN public.can_view_financial_data() THEN iban ELSE '****' END as iban,
  first_name,
  last_name,
  zip_code,
  mobile,
  status,
  tags,
  email,
  type_adresse,
  civil_status,
  permit_type,
  nationality,
  profession,
  employer,
  CASE WHEN public.can_view_financial_data() THEN bank_name ELSE NULL END as bank_name,
  contract_type,
  canton
FROM public.clients;

-- Explicitly set SECURITY INVOKER (caller's privileges, not definer's)
ALTER VIEW public.clients_safe SET (security_invoker = on);

-- Grant access
GRANT SELECT ON public.clients_safe TO authenticated;

COMMENT ON VIEW public.clients_safe IS 'Secure view masking financial data for non-admin/compta roles. Uses SECURITY INVOKER.';