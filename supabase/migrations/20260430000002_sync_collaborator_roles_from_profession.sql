-- Repair existing CRM user roles that drifted from the linked collaborator
-- function, then keep system tenant-role assignments aligned with profession.

WITH collaborator_roles AS (
  SELECT DISTINCT
    c.user_id,
    c.tenant_id,
    CASE lower(COALESCE(c.profession, ''))
      WHEN 'admin' THEN 'admin'
      WHEN 'direction' THEN 'admin'
      WHEN 'manager' THEN 'manager'
      WHEN 'backoffice' THEN 'backoffice'
      WHEN 'comptabilite' THEN 'compta'
      ELSE 'agent'
    END AS app_role
  FROM public.clients c
  WHERE c.user_id IS NOT NULL
    AND c.tenant_id IS NOT NULL
    AND c.type_adresse = 'collaborateur'
    AND COALESCE(c.status, 'actif') <> 'inactif'
),
deleted_global_roles AS (
  DELETE FROM public.user_roles ur
  USING (SELECT DISTINCT user_id FROM collaborator_roles) cr
  WHERE ur.user_id = cr.user_id
    AND ur.role::text IN ('admin', 'manager', 'agent', 'backoffice', 'compta', 'partner')
  RETURNING ur.user_id
),
inserted_global_roles AS (
  INSERT INTO public.user_roles (user_id, role)
  SELECT DISTINCT
    cr.user_id,
    cr.app_role::public.app_role
  FROM collaborator_roles cr
  ON CONFLICT (user_id, role) DO NOTHING
  RETURNING user_id
),
role_configs (app_role, aliases) AS (
  VALUES
    ('admin', ARRAY['Admin Cabinet', 'Administrateur', 'Admin']),
    ('manager', ARRAY['Manager']),
    ('agent', ARRAY['Agent']),
    ('backoffice', ARRAY['Back-office', 'Backoffice', 'Back Office']),
    ('compta', ARRAY['Comptabilite', 'Comptabilité', 'Compta']),
    ('partner', ARRAY['Partenaire', 'Partner'])
),
all_system_role_ids AS (
  SELECT DISTINCT
    cr.user_id,
    cr.tenant_id,
    tr.id AS role_id
  FROM collaborator_roles cr
  JOIN public.tenant_roles tr ON tr.tenant_id = cr.tenant_id
  JOIN role_configs rc ON tr.name = ANY(rc.aliases)
),
deleted_tenant_roles AS (
  DELETE FROM public.user_tenant_roles utr
  USING all_system_role_ids sr
  WHERE utr.user_id = sr.user_id
    AND utr.tenant_id = sr.tenant_id
    AND utr.role_id = sr.role_id
  RETURNING utr.user_id
),
target_role_candidates AS (
  SELECT
    cr.user_id,
    cr.tenant_id,
    tr.id AS role_id,
    row_number() OVER (
      PARTITION BY cr.user_id, cr.tenant_id
      ORDER BY tr.is_system_role DESC, array_position(rc.aliases, tr.name)
    ) AS rn
  FROM collaborator_roles cr
  JOIN role_configs rc ON rc.app_role = cr.app_role
  JOIN public.tenant_roles tr ON tr.tenant_id = cr.tenant_id
    AND tr.name = ANY(rc.aliases)
)
INSERT INTO public.user_tenant_roles (user_id, tenant_id, role_id, assigned_by)
SELECT
  user_id,
  tenant_id,
  role_id,
  NULL
FROM target_role_candidates
WHERE rn = 1
ON CONFLICT (user_id, role_id, tenant_id) DO NOTHING;
