-- Drop and recreate documents_expiring_soon view with security
DROP VIEW IF EXISTS public.documents_expiring_soon;

CREATE VIEW public.documents_expiring_soon 
WITH (security_invoker = true)
AS
SELECT 
  d.id,
  d.owner_type,
  d.owner_id,
  d.file_name,
  d.file_key,
  d.mime_type,
  d.size_bytes,
  d.doc_kind,
  d.created_by,
  d.created_at,
  d.tenant_id,
  d.category,
  d.tags,
  d.expires_at,
  d.version,
  d.parent_document_id,
  d.is_template,
  d.template_name,
  d.metadata,
  dr.reminder_date,
  dr.days_before,
  (c.first_name || ' ' || c.last_name) AS client_name,
  c.email AS client_email
FROM documents d
LEFT JOIN document_reminders dr ON dr.document_id = d.id AND dr.notification_sent = false
LEFT JOIN clients c ON d.owner_type = 'client' AND d.owner_id = c.id
WHERE d.expires_at IS NOT NULL 
  AND d.expires_at <= (CURRENT_DATE + INTERVAL '60 days')
  AND d.tenant_id = get_user_tenant_id()
ORDER BY d.expires_at;

-- Drop and recreate clients_safe view with security_invoker
DROP VIEW IF EXISTS public.clients_safe;

CREATE VIEW public.clients_safe 
WITH (security_invoker = true)
AS
SELECT 
  id,
  user_id,
  birthdate,
  is_company,
  created_at,
  updated_at,
  assigned_agent_id,
  NULL::numeric AS commission_rate,
  NULL::numeric AS fixed_salary,
  NULL::numeric AS bonus_rate,
  work_percentage,
  hire_date,
  NULL::numeric AS commission_rate_lca,
  NULL::numeric AS commission_rate_vie,
  manager_id,
  NULL::numeric AS manager_commission_rate_lca,
  NULL::numeric AS manager_commission_rate_vie,
  NULL::numeric AS reserve_rate,
  external_ref,
  company_name,
  phone,
  address,
  city,
  postal_code,
  country,
  NULL::text AS iban,
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
  NULL::text AS bank_name,
  contract_type,
  canton,
  tenant_id
FROM clients c
WHERE can_access_client(id);

-- Add comment for documentation
COMMENT ON VIEW public.clients_safe IS 'Vue sécurisée des clients - masque IBAN, salaires et taux de commission. Utilise can_access_client() pour le contrôle d''accès.';
COMMENT ON VIEW public.documents_expiring_soon IS 'Vue des documents expirant bientôt - filtrée par tenant_id pour isolation multi-tenant.';