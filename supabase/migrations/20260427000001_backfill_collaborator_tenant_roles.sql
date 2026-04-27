-- Ensure CRM collaborator accounts have the tenant role required by TEAM login.
-- Older account creation only inserted user_roles/user_tenant_assignments, which
-- left users assigned to a cabinet but blocked by the CRM tenant-role check.

INSERT INTO public.user_tenant_assignments (user_id, tenant_id, is_platform_admin)
SELECT DISTINCT c.user_id, c.tenant_id, false
FROM public.clients c
JOIN public.user_roles ur ON ur.user_id = c.user_id
WHERE c.user_id IS NOT NULL
  AND c.tenant_id IS NOT NULL
  AND c.type_adresse = 'collaborateur'
  AND ur.role::text IN ('admin', 'manager', 'agent', 'backoffice', 'compta')
ON CONFLICT (user_id, tenant_id) DO NOTHING;

WITH role_configs (
  app_role,
  role_name,
  aliases,
  description,
  dashboard_scope,
  can_see_own_commissions,
  can_see_team_commissions,
  can_see_all_commissions
) AS (
  VALUES
    ('admin', 'Admin Cabinet', ARRAY['Admin Cabinet', 'Administrateur', 'Admin'], 'Acces complet a toutes les fonctionnalites', 'global'::public.dashboard_scope, true, true, true),
    ('manager', 'Manager', ARRAY['Manager'], 'Acces equipe + clients personnels', 'team'::public.dashboard_scope, true, true, false),
    ('agent', 'Agent', ARRAY['Agent'], 'Acces uniquement a ses clients et contrats', 'personal'::public.dashboard_scope, true, false, false),
    ('backoffice', 'Back-office', ARRAY['Back-office', 'Backoffice', 'Back Office'], 'Voit tous les clients et contrats, aucun acces finance', 'global'::public.dashboard_scope, false, false, false),
    ('compta', 'Comptabilite', ARRAY['Comptabilite', 'Comptabilité', 'Compta'], 'Acces comptabilite, commissions et decomptes', 'global'::public.dashboard_scope, true, true, true)
)
INSERT INTO public.tenant_roles (
  tenant_id,
  name,
  description,
  is_system_role,
  dashboard_scope,
  can_see_own_commissions,
  can_see_team_commissions,
  can_see_all_commissions
)
SELECT DISTINCT
  uta.tenant_id,
  rc.role_name,
  rc.description,
  true,
  rc.dashboard_scope,
  rc.can_see_own_commissions,
  rc.can_see_team_commissions,
  rc.can_see_all_commissions
FROM public.user_tenant_assignments uta
JOIN public.user_roles ur ON ur.user_id = uta.user_id
JOIN role_configs rc ON rc.app_role = ur.role::text
WHERE uta.tenant_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.tenant_roles tr
    WHERE tr.tenant_id = uta.tenant_id
      AND tr.name = ANY(rc.aliases)
  );

WITH role_permissions (role_name, module, action) AS (
  VALUES
    ('Admin Cabinet', 'clients', 'view'),
    ('Admin Cabinet', 'clients', 'create'),
    ('Admin Cabinet', 'clients', 'update'),
    ('Admin Cabinet', 'clients', 'delete'),
    ('Admin Cabinet', 'clients', 'export'),
    ('Admin Cabinet', 'contracts', 'view'),
    ('Admin Cabinet', 'contracts', 'deposit'),
    ('Admin Cabinet', 'contracts', 'update'),
    ('Admin Cabinet', 'contracts', 'cancel'),
    ('Admin Cabinet', 'contracts', 'export'),
    ('Admin Cabinet', 'partners', 'view'),
    ('Admin Cabinet', 'partners', 'create'),
    ('Admin Cabinet', 'partners', 'update'),
    ('Admin Cabinet', 'partners', 'delete'),
    ('Admin Cabinet', 'products', 'view'),
    ('Admin Cabinet', 'products', 'create'),
    ('Admin Cabinet', 'products', 'update'),
    ('Admin Cabinet', 'products', 'delete'),
    ('Admin Cabinet', 'collaborators', 'view'),
    ('Admin Cabinet', 'collaborators', 'create'),
    ('Admin Cabinet', 'collaborators', 'update'),
    ('Admin Cabinet', 'collaborators', 'delete'),
    ('Admin Cabinet', 'collaborators', 'export'),
    ('Admin Cabinet', 'commissions', 'view'),
    ('Admin Cabinet', 'commissions', 'modify_rules'),
    ('Admin Cabinet', 'commissions', 'export'),
    ('Admin Cabinet', 'decomptes', 'view'),
    ('Admin Cabinet', 'decomptes', 'generate'),
    ('Admin Cabinet', 'decomptes', 'export'),
    ('Admin Cabinet', 'payout', 'view'),
    ('Admin Cabinet', 'payout', 'generate'),
    ('Admin Cabinet', 'payout', 'validate'),
    ('Admin Cabinet', 'payout', 'export'),
    ('Admin Cabinet', 'dashboard', 'view'),
    ('Admin Cabinet', 'settings', 'view'),
    ('Admin Cabinet', 'settings', 'update'),

    ('Manager', 'clients', 'view'),
    ('Manager', 'clients', 'create'),
    ('Manager', 'clients', 'update'),
    ('Manager', 'clients', 'export'),
    ('Manager', 'contracts', 'view'),
    ('Manager', 'contracts', 'deposit'),
    ('Manager', 'contracts', 'update'),
    ('Manager', 'contracts', 'export'),
    ('Manager', 'collaborators', 'view'),
    ('Manager', 'commissions', 'view'),
    ('Manager', 'decomptes', 'view'),
    ('Manager', 'dashboard', 'view'),
    ('Manager', 'settings', 'view'),

    ('Agent', 'clients', 'view'),
    ('Agent', 'clients', 'create'),
    ('Agent', 'clients', 'update'),
    ('Agent', 'contracts', 'view'),
    ('Agent', 'contracts', 'deposit'),
    ('Agent', 'commissions', 'view'),
    ('Agent', 'dashboard', 'view'),

    ('Back-office', 'clients', 'view'),
    ('Back-office', 'clients', 'create'),
    ('Back-office', 'clients', 'update'),
    ('Back-office', 'clients', 'export'),
    ('Back-office', 'contracts', 'view'),
    ('Back-office', 'contracts', 'deposit'),
    ('Back-office', 'contracts', 'update'),
    ('Back-office', 'contracts', 'export'),
    ('Back-office', 'partners', 'view'),
    ('Back-office', 'products', 'view'),
    ('Back-office', 'collaborators', 'view'),
    ('Back-office', 'dashboard', 'view'),
    ('Back-office', 'settings', 'view'),

    ('Comptabilite', 'clients', 'view'),
    ('Comptabilite', 'clients', 'export'),
    ('Comptabilite', 'contracts', 'view'),
    ('Comptabilite', 'contracts', 'export'),
    ('Comptabilite', 'commissions', 'view'),
    ('Comptabilite', 'commissions', 'modify_rules'),
    ('Comptabilite', 'commissions', 'export'),
    ('Comptabilite', 'decomptes', 'view'),
    ('Comptabilite', 'decomptes', 'generate'),
    ('Comptabilite', 'decomptes', 'export'),
    ('Comptabilite', 'payout', 'view'),
    ('Comptabilite', 'payout', 'generate'),
    ('Comptabilite', 'payout', 'validate'),
    ('Comptabilite', 'payout', 'export'),
    ('Comptabilite', 'dashboard', 'view'),
    ('Comptabilite', 'settings', 'view')
)
INSERT INTO public.tenant_role_permissions (role_id, module, action, allowed)
SELECT
  tr.id,
  rp.module::public.permission_module,
  rp.action::public.permission_action,
  true
FROM public.tenant_roles tr
JOIN role_permissions rp ON rp.role_name = tr.name
ON CONFLICT (role_id, module, action) DO NOTHING;

WITH role_candidates AS (
  SELECT
    uta.user_id,
    uta.tenant_id,
    tr.id AS role_id,
    row_number() OVER (
      PARTITION BY uta.user_id, uta.tenant_id
      ORDER BY
        CASE ur.role::text
          WHEN 'admin' THEN 1
          WHEN 'manager' THEN 2
          WHEN 'compta' THEN 3
          WHEN 'backoffice' THEN 4
          WHEN 'agent' THEN 5
          ELSE 9
        END,
        tr.is_system_role DESC
    ) AS rn
  FROM public.user_tenant_assignments uta
  JOIN public.user_roles ur ON ur.user_id = uta.user_id
  JOIN public.tenant_roles tr ON tr.tenant_id = uta.tenant_id
    AND (
      (ur.role::text = 'admin' AND tr.name IN ('Admin Cabinet', 'Administrateur', 'Admin'))
      OR (ur.role::text = 'manager' AND tr.name = 'Manager')
      OR (ur.role::text = 'agent' AND tr.name = 'Agent')
      OR (ur.role::text = 'backoffice' AND tr.name IN ('Back-office', 'Backoffice', 'Back Office'))
      OR (ur.role::text = 'compta' AND tr.name IN ('Comptabilite', 'Comptabilité', 'Compta'))
    )
  WHERE uta.tenant_id IS NOT NULL
    AND ur.role::text IN ('admin', 'manager', 'agent', 'backoffice', 'compta')
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_tenant_roles existing
      WHERE existing.user_id = uta.user_id
        AND existing.tenant_id = uta.tenant_id
    )
)
INSERT INTO public.user_tenant_roles (user_id, tenant_id, role_id, assigned_by)
SELECT user_id, tenant_id, role_id, NULL
FROM role_candidates
WHERE rn = 1
ON CONFLICT (user_id, role_id, tenant_id) DO NOTHING;
