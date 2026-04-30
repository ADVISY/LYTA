-- INSERT ... RETURNING on clients also needs the inserted row to pass the
-- SELECT policy. can_access_client() was still anchored to get_user_tenant_id(),
-- which can be missing or different for historical tenant admins and
-- subdomain-scoped sessions. Evaluate access against the row tenant instead.

CREATE OR REPLACE FUNCTION public.user_has_global_client_scope(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_king()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
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
        public.has_role(auth.uid(), 'backoffice'::public.app_role)
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

GRANT EXECUTE ON FUNCTION public.user_has_global_client_scope(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_client(uuid) TO authenticated;
