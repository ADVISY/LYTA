-- Separate paid CRM staff from free client portal users, repair partially linked
-- collaborator accounts, and enforce personal/team/global visibility scopes.

-- ---------------------------------------------------------------------------
-- Repair collaborator accounts that were linked to clients.user_id but missed
-- tenant assignment or staff roles during older invite failures.
-- ---------------------------------------------------------------------------

INSERT INTO public.user_tenant_assignments (user_id, tenant_id, is_platform_admin)
SELECT DISTINCT c.user_id, c.tenant_id, false
FROM public.clients c
WHERE c.user_id IS NOT NULL
  AND c.tenant_id IS NOT NULL
  AND c.type_adresse = 'collaborateur'
ON CONFLICT (user_id, tenant_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT
  c.user_id,
  (
    CASE lower(COALESCE(c.profession, ''))
      WHEN 'admin' THEN 'admin'
      WHEN 'direction' THEN 'admin'
      WHEN 'manager' THEN 'manager'
      WHEN 'backoffice' THEN 'backoffice'
      WHEN 'back-office' THEN 'backoffice'
      WHEN 'comptabilite' THEN 'compta'
      WHEN 'comptabilité' THEN 'compta'
      WHEN 'compta' THEN 'compta'
      ELSE 'agent'
    END
  )::public.app_role
FROM public.clients c
WHERE c.user_id IS NOT NULL
  AND c.type_adresse = 'collaborateur'
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = c.user_id
      AND ur.role::text <> 'client'
  )
ON CONFLICT (user_id, role) DO NOTHING;

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
    ('compta', 'Comptabilite', ARRAY['Comptabilite', 'Comptabilité', 'Compta'], 'Acces comptabilite, commissions et decomptes', 'global'::public.dashboard_scope, true, true, true),
    ('partner', 'Partenaire', ARRAY['Partenaire', 'Partner'], 'Acces partenaire au CRM', 'personal'::public.dashboard_scope, true, false, false)
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

    ('Partenaire', 'clients', 'view'),
    ('Partenaire', 'clients', 'create'),
    ('Partenaire', 'clients', 'update'),
    ('Partenaire', 'contracts', 'view'),
    ('Partenaire', 'contracts', 'deposit'),
    ('Partenaire', 'partners', 'view'),
    ('Partenaire', 'commissions', 'view'),
    ('Partenaire', 'dashboard', 'view')
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
          WHEN 'partner' THEN 6
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
      OR (ur.role::text = 'partner' AND tr.name IN ('Partenaire', 'Partner'))
    )
  WHERE uta.tenant_id IS NOT NULL
    AND ur.role::text IN ('admin', 'manager', 'agent', 'backoffice', 'compta', 'partner')
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

-- ---------------------------------------------------------------------------
-- Tenant-scoped permission helpers.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.has_tenant_permission(
  _module public.permission_module,
  _action public.permission_action
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_tenant_roles utr
    JOIN public.tenant_role_permissions trp ON trp.role_id = utr.role_id
    JOIN public.tenant_roles tr ON tr.id = utr.role_id
    WHERE utr.user_id = auth.uid()
      AND utr.tenant_id = public.get_user_tenant_id()
      AND tr.tenant_id = utr.tenant_id
      AND trp.module = _module
      AND trp.action = _action
      AND trp.allowed = true
      AND tr.is_active = true
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_dashboard_scope()
RETURNS public.dashboard_scope
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT tr.dashboard_scope
      FROM public.user_tenant_roles utr
      JOIN public.tenant_roles tr ON tr.id = utr.role_id
      WHERE utr.user_id = auth.uid()
        AND utr.tenant_id = public.get_user_tenant_id()
        AND tr.is_active = true
      ORDER BY
        CASE tr.dashboard_scope
          WHEN 'global' THEN 1
          WHEN 'team' THEN 2
          ELSE 3
        END
      LIMIT 1
    ),
    'personal'::public.dashboard_scope
  )
$$;

CREATE OR REPLACE FUNCTION public.can_see_commissions_scope()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM public.user_tenant_roles utr
        JOIN public.tenant_roles tr ON tr.id = utr.role_id
        WHERE utr.user_id = auth.uid()
          AND utr.tenant_id = public.get_user_tenant_id()
          AND tr.can_see_all_commissions = true
          AND tr.is_active = true
      ) THEN 'all'
      WHEN EXISTS (
        SELECT 1
        FROM public.user_tenant_roles utr
        JOIN public.tenant_roles tr ON tr.id = utr.role_id
        WHERE utr.user_id = auth.uid()
          AND utr.tenant_id = public.get_user_tenant_id()
          AND tr.can_see_team_commissions = true
          AND tr.is_active = true
      ) THEN 'team'
      WHEN EXISTS (
        SELECT 1
        FROM public.user_tenant_roles utr
        JOIN public.tenant_roles tr ON tr.id = utr.role_id
        WHERE utr.user_id = auth.uid()
          AND utr.tenant_id = public.get_user_tenant_id()
          AND tr.can_see_own_commissions = true
          AND tr.is_active = true
      ) THEN 'own'
      ELSE 'none'
    END
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_king()
    OR EXISTS (
      SELECT 1
      FROM public.user_tenant_assignments uta
      WHERE uta.user_id = auth.uid()
        AND uta.tenant_id = public.get_user_tenant_id()
        AND uta.is_platform_admin = true
    )
    OR (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      AND EXISTS (
        SELECT 1
        FROM public.user_tenant_assignments uta
        WHERE uta.user_id = auth.uid()
          AND uta.tenant_id = public.get_user_tenant_id()
      )
    )
    OR public.has_tenant_permission('settings'::public.permission_module, 'update'::public.permission_action)
$$;

CREATE OR REPLACE FUNCTION public.current_collaborator_id(p_tenant_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
  FROM public.clients c
  WHERE c.user_id = auth.uid()
    AND c.tenant_id = COALESCE(p_tenant_id, public.get_user_tenant_id())
    AND c.type_adresse = 'collaborateur'
  ORDER BY c.created_at ASC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.user_has_global_client_scope(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_king()
    OR EXISTS (
      SELECT 1
      FROM public.user_tenant_assignments uta
      WHERE uta.user_id = auth.uid()
        AND uta.tenant_id = p_tenant_id
        AND uta.is_platform_admin = true
    )
    OR (
      EXISTS (
        SELECT 1
        FROM public.user_tenant_assignments uta
        WHERE uta.user_id = auth.uid()
          AND uta.tenant_id = p_tenant_id
      )
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'backoffice'::public.app_role)
        OR public.has_role(auth.uid(), 'compta'::public.app_role)
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_tenant_roles utr
      JOIN public.tenant_roles tr ON tr.id = utr.role_id
      JOIN public.tenant_role_permissions trp ON trp.role_id = tr.id
      WHERE utr.user_id = auth.uid()
        AND utr.tenant_id = p_tenant_id
        AND tr.tenant_id = p_tenant_id
        AND tr.is_active = true
        AND tr.dashboard_scope = 'global'::public.dashboard_scope
        AND trp.module = 'clients'::public.permission_module
        AND trp.action = 'view'::public.permission_action
        AND trp.allowed = true
    )
$$;

CREATE OR REPLACE FUNCTION public.user_has_team_client_scope(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.user_has_global_client_scope(p_tenant_id)
    OR (
      EXISTS (
        SELECT 1
        FROM public.user_tenant_assignments uta
        WHERE uta.user_id = auth.uid()
          AND uta.tenant_id = p_tenant_id
      )
      AND public.has_role(auth.uid(), 'manager'::public.app_role)
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_tenant_roles utr
      JOIN public.tenant_roles tr ON tr.id = utr.role_id
      JOIN public.tenant_role_permissions trp ON trp.role_id = tr.id
      WHERE utr.user_id = auth.uid()
        AND utr.tenant_id = p_tenant_id
        AND tr.tenant_id = p_tenant_id
        AND tr.is_active = true
        AND tr.dashboard_scope IN ('team'::public.dashboard_scope, 'global'::public.dashboard_scope)
        AND trp.module = 'clients'::public.permission_module
        AND trp.action = 'view'::public.permission_action
        AND trp.allowed = true
    )
$$;

CREATE OR REPLACE FUNCTION public.user_has_personal_client_scope(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.user_has_team_client_scope(p_tenant_id)
    OR (
      EXISTS (
        SELECT 1
        FROM public.user_tenant_assignments uta
        WHERE uta.user_id = auth.uid()
          AND uta.tenant_id = p_tenant_id
      )
      AND (
        public.has_role(auth.uid(), 'agent'::public.app_role)
        OR public.has_role(auth.uid(), 'partner'::public.app_role)
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_tenant_roles utr
      JOIN public.tenant_roles tr ON tr.id = utr.role_id
      JOIN public.tenant_role_permissions trp ON trp.role_id = tr.id
      WHERE utr.user_id = auth.uid()
        AND utr.tenant_id = p_tenant_id
        AND tr.tenant_id = p_tenant_id
        AND tr.is_active = true
        AND trp.module = 'clients'::public.permission_module
        AND trp.action = 'view'::public.permission_action
        AND trp.allowed = true
    )
$$;

CREATE OR REPLACE FUNCTION public.can_access_client(client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH target AS (
    SELECT c.*
    FROM public.clients c
    WHERE c.id = $1
      AND c.tenant_id = public.get_user_tenant_id()
  ),
  me AS (
    SELECT c.*
    FROM public.clients c
    JOIN target t ON t.tenant_id = c.tenant_id
    WHERE c.id = public.current_collaborator_id(t.tenant_id)
  )
  SELECT
    public.is_king()
    OR EXISTS (
      SELECT 1
      FROM target t
      LEFT JOIN me ON true
      WHERE
        t.user_id = auth.uid()
        OR public.user_has_global_client_scope(t.tenant_id)
        OR (
          me.id IS NOT NULL
          AND public.user_has_team_client_scope(t.tenant_id)
          AND (
            t.id = me.id
            OR t.assigned_agent_id = me.id
            OR t.manager_id = me.id
            OR EXISTS (
              SELECT 1
              FROM public.clients member
              WHERE member.tenant_id = t.tenant_id
                AND member.type_adresse = 'collaborateur'
                AND member.manager_id = me.id
                AND (
                  t.id = member.id
                  OR t.assigned_agent_id = member.id
                  OR t.manager_id = member.id
                )
            )
          )
        )
        OR (
          me.id IS NOT NULL
          AND public.user_has_personal_client_scope(t.tenant_id)
          AND (
            t.id = me.id
            OR t.assigned_agent_id = me.id
          )
        )
    )
$$;

GRANT EXECUTE ON FUNCTION public.current_collaborator_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_global_client_scope(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_team_client_scope(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_personal_client_scope(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_client(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Admin visibility over user management tables.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Kings can manage all roles" ON public.tenant_roles;
DROP POLICY IF EXISTS "Tenant admins can manage their roles" ON public.tenant_roles;
DROP POLICY IF EXISTS "Users can view their tenant roles" ON public.tenant_roles;
DROP POLICY IF EXISTS "Tenant admins can manage tenant roles" ON public.tenant_roles;
DROP POLICY IF EXISTS "Users can view assigned tenant roles" ON public.tenant_roles;
DROP POLICY IF EXISTS "Kings can manage all permissions" ON public.tenant_role_permissions;
DROP POLICY IF EXISTS "Tenant admins can manage their role permissions" ON public.tenant_role_permissions;
DROP POLICY IF EXISTS "Users can view their tenant role permissions" ON public.tenant_role_permissions;
DROP POLICY IF EXISTS "Tenant admins can manage tenant role permissions" ON public.tenant_role_permissions;
DROP POLICY IF EXISTS "Users can view assigned tenant role permissions" ON public.tenant_role_permissions;
DROP POLICY IF EXISTS "Admins and agents can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins and agents can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Tenant admins can view tenant assignments" ON public.user_tenant_assignments;
DROP POLICY IF EXISTS "Tenant admins can view tenant user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Tenant admins can view assigned profiles" ON public.profiles;
DROP POLICY IF EXISTS "Tenant admins can manage user roles" ON public.user_tenant_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_tenant_roles;
DROP POLICY IF EXISTS "Users can view their own tenant roles" ON public.user_tenant_roles;

CREATE POLICY "Kings can manage all roles"
ON public.tenant_roles
FOR ALL
USING (public.is_king())
WITH CHECK (public.is_king());

CREATE POLICY "Tenant admins can manage tenant roles"
ON public.tenant_roles
FOR ALL
USING (
  tenant_id = public.get_user_tenant_id()
  AND public.is_tenant_admin()
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
  AND public.is_tenant_admin()
);

CREATE POLICY "Users can view assigned tenant roles"
ON public.tenant_roles
FOR SELECT
USING (
  tenant_id = public.get_user_tenant_id()
  AND (
    public.is_tenant_admin()
    OR EXISTS (
      SELECT 1
      FROM public.user_tenant_roles utr
      WHERE utr.user_id = auth.uid()
        AND utr.tenant_id = tenant_roles.tenant_id
        AND utr.role_id = tenant_roles.id
    )
  )
);

CREATE POLICY "Kings can manage all permissions"
ON public.tenant_role_permissions
FOR ALL
USING (public.is_king())
WITH CHECK (public.is_king());

CREATE POLICY "Tenant admins can manage tenant role permissions"
ON public.tenant_role_permissions
FOR ALL
USING (
  public.is_tenant_admin()
  AND EXISTS (
    SELECT 1
    FROM public.tenant_roles tr
    WHERE tr.id = tenant_role_permissions.role_id
      AND tr.tenant_id = public.get_user_tenant_id()
  )
)
WITH CHECK (
  public.is_tenant_admin()
  AND EXISTS (
    SELECT 1
    FROM public.tenant_roles tr
    WHERE tr.id = tenant_role_permissions.role_id
      AND tr.tenant_id = public.get_user_tenant_id()
  )
);

CREATE POLICY "Users can view assigned tenant role permissions"
ON public.tenant_role_permissions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.tenant_roles tr
    WHERE tr.id = tenant_role_permissions.role_id
      AND tr.tenant_id = public.get_user_tenant_id()
      AND (
        public.is_tenant_admin()
        OR EXISTS (
          SELECT 1
          FROM public.user_tenant_roles utr
          WHERE utr.user_id = auth.uid()
            AND utr.tenant_id = tr.tenant_id
            AND utr.role_id = tr.id
        )
      )
  )
);

CREATE POLICY "Tenant admins can view tenant assignments"
ON public.user_tenant_assignments
FOR SELECT
USING (
  user_id = auth.uid()
  OR public.is_king()
  OR (
    tenant_id = public.get_user_tenant_id()
    AND public.is_tenant_admin()
  )
);

CREATE POLICY "Tenant admins can view assigned profiles"
ON public.profiles
FOR SELECT
USING (
  id = auth.uid()
  OR public.is_king()
  OR (
    public.is_tenant_admin()
    AND EXISTS (
      SELECT 1
      FROM public.user_tenant_assignments uta
      WHERE uta.user_id = profiles.id
        AND uta.tenant_id = public.get_user_tenant_id()
    )
  )
);

CREATE POLICY "Tenant admins can view tenant user roles"
ON public.user_roles
FOR SELECT
USING (
  user_id = auth.uid()
  OR public.is_king()
  OR (
    public.is_tenant_admin()
    AND EXISTS (
      SELECT 1
      FROM public.user_tenant_assignments uta
      WHERE uta.user_id = user_roles.user_id
        AND uta.tenant_id = public.get_user_tenant_id()
    )
  )
);

CREATE POLICY "Tenant admins can manage user roles"
ON public.user_tenant_roles
FOR ALL
USING (
  public.is_king()
  OR (
    tenant_id = public.get_user_tenant_id()
    AND public.is_tenant_admin()
  )
)
WITH CHECK (
  public.is_king()
  OR (
    tenant_id = public.get_user_tenant_id()
    AND public.is_tenant_admin()
  )
);

CREATE POLICY "Users can view their own tenant roles"
ON public.user_tenant_roles
FOR SELECT
USING (
  (user_id = auth.uid() AND tenant_id = public.get_user_tenant_id())
  OR public.is_king()
  OR (
    tenant_id = public.get_user_tenant_id()
    AND public.is_tenant_admin()
  )
);

-- ---------------------------------------------------------------------------
-- Scoped CRM data policies.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Kings have full access to all clients" ON public.clients;
DROP POLICY IF EXISTS "Tenant users can view their clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users access clients via can_access_client" ON public.clients;
DROP POLICY IF EXISTS "Tenant admins can manage clients" ON public.clients;
DROP POLICY IF EXISTS "Tenant staff can create clients" ON public.clients;
DROP POLICY IF EXISTS "Tenant staff can update clients" ON public.clients;
DROP POLICY IF EXISTS "Tenant admins can delete clients" ON public.clients;
DROP POLICY IF EXISTS "Users can view accessible clients" ON public.clients;
DROP POLICY IF EXISTS "Admins have full access" ON public.clients;

CREATE POLICY "Kings have full access to all clients"
ON public.clients
FOR ALL
USING (public.is_king())
WITH CHECK (public.is_king());

CREATE POLICY "Tenant users can view scoped clients"
ON public.clients
FOR SELECT
USING (public.can_access_client(id));

CREATE POLICY "Tenant staff can create clients"
ON public.clients
FOR INSERT
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
  AND (
    public.user_has_global_client_scope(tenant_id)
    OR public.has_tenant_permission('clients'::public.permission_module, 'create'::public.permission_action)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
    OR public.has_role(auth.uid(), 'agent'::public.app_role)
    OR public.has_role(auth.uid(), 'partner'::public.app_role)
    OR public.has_role(auth.uid(), 'backoffice'::public.app_role)
  )
);

CREATE POLICY "Tenant staff can update scoped clients"
ON public.clients
FOR UPDATE
USING (
  public.can_access_client(id)
  AND (
    public.user_has_global_client_scope(tenant_id)
    OR public.has_tenant_permission('clients'::public.permission_module, 'update'::public.permission_action)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
    OR public.has_role(auth.uid(), 'agent'::public.app_role)
    OR public.has_role(auth.uid(), 'partner'::public.app_role)
    OR user_id = auth.uid()
  )
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
  AND (
    public.can_access_client(id)
    OR public.user_has_global_client_scope(tenant_id)
  )
);

CREATE POLICY "Tenant admins can delete clients"
ON public.clients
FOR DELETE
USING (
  tenant_id = public.get_user_tenant_id()
  AND public.is_tenant_admin()
);

DROP POLICY IF EXISTS "Tenant users can view their policies" ON public.policies;
DROP POLICY IF EXISTS "Tenant staff can create policies" ON public.policies;
DROP POLICY IF EXISTS "Tenant staff can update policies" ON public.policies;
DROP POLICY IF EXISTS "Tenant admins can manage policies" ON public.policies;

CREATE POLICY "Tenant users can view scoped policies"
ON public.policies
FOR SELECT
USING (
  tenant_id = public.get_user_tenant_id()
  AND (
    public.is_king()
    OR public.user_has_global_client_scope(tenant_id)
    OR (client_id IS NOT NULL AND public.can_access_client(client_id))
    OR EXISTS (
      SELECT 1
      FROM public.partners p
      WHERE p.id = policies.partner_id
        AND p.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Tenant staff can create scoped policies"
ON public.policies
FOR INSERT
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
  AND (
    public.user_has_global_client_scope(tenant_id)
    OR public.has_tenant_permission('contracts'::public.permission_module, 'deposit'::public.permission_action)
  )
  AND (
    client_id IS NULL
    OR public.can_access_client(client_id)
  )
);

CREATE POLICY "Tenant staff can update scoped policies"
ON public.policies
FOR UPDATE
USING (
  tenant_id = public.get_user_tenant_id()
  AND (
    public.user_has_global_client_scope(tenant_id)
    OR public.has_tenant_permission('contracts'::public.permission_module, 'update'::public.permission_action)
  )
  AND (
    client_id IS NULL
    OR public.can_access_client(client_id)
  )
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
  AND (
    client_id IS NULL
    OR public.can_access_client(client_id)
  )
);

DROP POLICY IF EXISTS "Tenant users can view their commissions" ON public.commissions;
DROP POLICY IF EXISTS "Tenant admins can manage commissions" ON public.commissions;

CREATE POLICY "Tenant users can view scoped commissions"
ON public.commissions
FOR SELECT
USING (
  tenant_id = public.get_user_tenant_id()
  AND (
    public.is_king()
    OR public.can_see_commissions_scope() = 'all'
    OR (
      public.can_see_commissions_scope() IN ('own', 'team')
      AND EXISTS (
        SELECT 1
        FROM public.policies p
        WHERE p.id = commissions.policy_id
          AND p.client_id IS NOT NULL
          AND public.can_access_client(p.client_id)
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.partners p
      WHERE p.id = commissions.partner_id
        AND p.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Tenant finance can manage commissions"
ON public.commissions
FOR ALL
USING (
  tenant_id = public.get_user_tenant_id()
  AND (
    public.is_tenant_admin()
    OR public.has_tenant_permission('commissions'::public.permission_module, 'modify_rules'::public.permission_action)
  )
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
  AND (
    public.is_tenant_admin()
    OR public.has_tenant_permission('commissions'::public.permission_module, 'modify_rules'::public.permission_action)
  )
);

DROP POLICY IF EXISTS "Tenant users can view their documents" ON public.documents;
DROP POLICY IF EXISTS "Tenant staff can create documents" ON public.documents;
DROP POLICY IF EXISTS "Tenant staff can update documents" ON public.documents;
DROP POLICY IF EXISTS "Tenant staff can delete documents" ON public.documents;
DROP POLICY IF EXISTS "Tenant admins can manage documents" ON public.documents;

CREATE POLICY "Tenant users can view scoped documents"
ON public.documents
FOR SELECT
USING (
  tenant_id = public.get_user_tenant_id()
  AND (
    public.is_king()
    OR public.user_has_global_client_scope(tenant_id)
    OR created_by = auth.uid()
    OR (
      owner_type = 'client'
      AND public.can_access_client(owner_id)
    )
    OR (
      owner_type = 'policy'
      AND EXISTS (
        SELECT 1
        FROM public.policies p
        WHERE p.id = documents.owner_id
          AND p.tenant_id = public.get_user_tenant_id()
          AND (
            p.client_id IS NULL
            OR public.can_access_client(p.client_id)
          )
      )
    )
  )
);

CREATE POLICY "Tenant staff can create scoped documents"
ON public.documents
FOR INSERT
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
  AND (
    public.user_has_global_client_scope(tenant_id)
    OR public.has_tenant_permission('clients'::public.permission_module, 'update'::public.permission_action)
    OR public.has_tenant_permission('contracts'::public.permission_module, 'deposit'::public.permission_action)
    OR public.has_tenant_permission('contracts'::public.permission_module, 'update'::public.permission_action)
  )
);

CREATE POLICY "Tenant staff can update scoped documents"
ON public.documents
FOR UPDATE
USING (
  tenant_id = public.get_user_tenant_id()
  AND (
    public.user_has_global_client_scope(tenant_id)
    OR created_by = auth.uid()
    OR public.has_tenant_permission('clients'::public.permission_module, 'update'::public.permission_action)
    OR public.has_tenant_permission('contracts'::public.permission_module, 'update'::public.permission_action)
  )
)
WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Tenant staff can delete scoped documents"
ON public.documents
FOR DELETE
USING (
  tenant_id = public.get_user_tenant_id()
  AND (
    public.is_tenant_admin()
    OR created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "Tenant users can view their suivis" ON public.suivis;
DROP POLICY IF EXISTS "Tenant staff can create suivis" ON public.suivis;
DROP POLICY IF EXISTS "Tenant staff can update suivis" ON public.suivis;
DROP POLICY IF EXISTS "Tenant admins can delete suivis" ON public.suivis;

CREATE POLICY "Tenant users can view scoped suivis"
ON public.suivis
FOR SELECT
USING (
  tenant_id = public.get_user_tenant_id()
  AND (
    public.is_king()
    OR public.user_has_global_client_scope(tenant_id)
    OR public.can_access_client(client_id)
    OR assigned_agent_id = auth.uid()
  )
);

CREATE POLICY "Tenant staff can create scoped suivis"
ON public.suivis
FOR INSERT
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
  AND public.can_access_client(client_id)
);

CREATE POLICY "Tenant staff can update scoped suivis"
ON public.suivis
FOR UPDATE
USING (
  tenant_id = public.get_user_tenant_id()
  AND (
    public.user_has_global_client_scope(tenant_id)
    OR public.can_access_client(client_id)
    OR assigned_agent_id = auth.uid()
  )
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
  AND public.can_access_client(client_id)
);

CREATE POLICY "Tenant admins can delete suivis"
ON public.suivis
FOR DELETE
USING (
  tenant_id = public.get_user_tenant_id()
  AND public.is_tenant_admin()
);

-- Client portal users are free: only non-client roles consume paid seats.
CREATE OR REPLACE FUNCTION public.get_tenant_seat_summary(p_tenant_id uuid DEFAULT NULL)
RETURNS TABLE (
  tenant_id uuid,
  seats_included integer,
  extra_users integer,
  total_seats integer,
  active_users integer,
  available_seats integer,
  seat_price numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  v_tenant_id := COALESCE(p_tenant_id, public.get_user_tenant_id());

  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT public.is_king()
     AND NOT EXISTS (
       SELECT 1
       FROM public.user_tenant_assignments uta
       WHERE uta.user_id = auth.uid()
         AND uta.tenant_id = v_tenant_id
     ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH tenant_row AS (
    SELECT
      t.id,
      COALESCE(t.seats_included, 1)::integer AS seats_included,
      COALESCE(t.extra_users, 0)::integer AS extra_users,
      COALESCE(t.seats_price, 20)::numeric AS seat_price
    FROM public.tenants t
    WHERE t.id = v_tenant_id
  ),
  limit_row AS (
    SELECT
      tl.users_limit,
      EXISTS (
        SELECT 1
        FROM public.tenant_limits_audit tla
        WHERE tla.tenant_id = tl.tenant_id
          AND tla.limit_type IN ('users_limit', 'users')
      ) AS has_user_limit_override
    FROM public.tenant_limits tl
    WHERE tl.tenant_id = v_tenant_id
  ),
  capacity AS (
    SELECT
      tr.id,
      tr.seats_included,
      CASE
        WHEN COALESCE(lr.has_user_limit_override, false)
          THEN GREATEST(COALESCE(lr.users_limit, tr.seats_included + tr.extra_users), tr.seats_included)
        ELSE tr.seats_included + tr.extra_users
      END::integer AS total_seats,
      tr.seat_price
    FROM tenant_row tr
    LEFT JOIN limit_row lr ON true
  ),
  billable_users AS (
    SELECT COUNT(DISTINCT c.user_id)::integer AS count
    FROM public.clients c
    WHERE c.tenant_id = v_tenant_id
      AND c.type_adresse = 'collaborateur'
      AND c.user_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = c.user_id
          AND ur.role::text <> 'client'
      )
  )
  SELECT
    c.id AS tenant_id,
    c.seats_included,
    GREATEST(0, c.total_seats - c.seats_included)::integer AS extra_users,
    c.total_seats,
    COALESCE(b.count, 0)::integer AS active_users,
    (c.total_seats - COALESCE(b.count, 0))::integer AS available_seats,
    c.seat_price
  FROM capacity c
  CROSS JOIN billable_users b;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_tenant_seat_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_seat_summary(uuid) TO service_role;
