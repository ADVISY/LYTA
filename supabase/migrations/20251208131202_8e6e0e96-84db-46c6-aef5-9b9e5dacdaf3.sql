-- Renforce la sécurité de la table profiles
-- Ajoute une politique explicite pour bloquer les utilisateurs non authentifiés
CREATE POLICY "Block unauthenticated access to profiles"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Crée une vue sécurisée pour les clients qui masque les données sensibles
CREATE OR REPLACE VIEW public.clients_secure AS
SELECT 
  id,
  user_id,
  first_name,
  last_name,
  email,
  phone,
  mobile,
  address,
  city,
  postal_code,
  zip_code,
  canton,
  country,
  birthdate,
  civil_status,
  nationality,
  permit_type,
  profession,
  employer,
  is_company,
  company_name,
  status,
  tags,
  type_adresse,
  assigned_agent_id,
  manager_id,
  created_at,
  updated_at,
  -- Champs financiers masqués sauf pour admin/compta
  CASE WHEN public.can_view_financial_data() THEN iban ELSE '****' END as iban,
  CASE WHEN public.can_view_financial_data() THEN bank_name ELSE NULL END as bank_name,
  -- Champs de commission visibles seulement pour admin/compta
  CASE WHEN public.can_view_financial_data() THEN commission_rate ELSE NULL END as commission_rate,
  CASE WHEN public.can_view_financial_data() THEN commission_rate_lca ELSE NULL END as commission_rate_lca,
  CASE WHEN public.can_view_financial_data() THEN commission_rate_vie ELSE NULL END as commission_rate_vie,
  CASE WHEN public.can_view_financial_data() THEN fixed_salary ELSE NULL END as fixed_salary,
  CASE WHEN public.can_view_financial_data() THEN bonus_rate ELSE NULL END as bonus_rate,
  CASE WHEN public.can_view_financial_data() THEN reserve_rate ELSE NULL END as reserve_rate,
  CASE WHEN public.can_view_financial_data() THEN manager_commission_rate_lca ELSE NULL END as manager_commission_rate_lca,
  CASE WHEN public.can_view_financial_data() THEN manager_commission_rate_vie ELSE NULL END as manager_commission_rate_vie,
  work_percentage,
  hire_date,
  contract_type,
  external_ref
FROM public.clients;

-- Accorde les permissions sur la vue
GRANT SELECT ON public.clients_secure TO authenticated;