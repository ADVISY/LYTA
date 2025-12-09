-- 1. Fix ai_rate_limits RLS policy - restrict to service role only
-- First drop the overly permissive policy
DROP POLICY IF EXISTS "Allow rate limit tracking" ON public.ai_rate_limits;

-- Create a more restrictive policy - only allow inserts/updates via service role (edge functions)
-- Regular users should not be able to manipulate rate limits directly
CREATE POLICY "Service role only for rate limits"
ON public.ai_rate_limits
FOR ALL
USING (false)
WITH CHECK (false);

-- 2. Create a secure view that masks sensitive financial data for non-admin/compta roles
CREATE OR REPLACE VIEW public.clients_safe AS
SELECT 
  id,
  user_id,
  birthdate,
  is_company,
  created_at,
  updated_at,
  assigned_agent_id,
  -- Mask commission rates for non-financial roles
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
  -- Mask sensitive financial data (IBAN, bank)
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

-- Grant access to the view
GRANT SELECT ON public.clients_safe TO authenticated;

-- 3. Add comment explaining the security model
COMMENT ON VIEW public.clients_safe IS 'Secure view of clients table that masks financial data (IBAN, bank_name, salary, commission rates) for non-admin/compta roles';