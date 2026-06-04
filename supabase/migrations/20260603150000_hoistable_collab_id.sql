-- ============================================================================
-- Perf finale : current_collaborator_id sans param → hoistable par Postgres
-- ============================================================================
-- Précédente version : 38 sec encore. Cause : current_collaborator_id(tenant_id)
-- est STABLE mais prend tenant_id de la row → Postgres l'évalue row par row
-- car il ne peut pas prouver que tenant_id sera constant dans tout le filter.
--
-- Fix : nouvelle fonction my_collab_id_for_active_tenant() SANS paramètre,
-- qui résout le tenant via get_user_tenant_id() en interne. Comme elle n'a
-- pas de param row-dépendant, Postgres l'évalue UNE SEULE FOIS par requête.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.my_collab_id_for_active_tenant()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_collaborator_id(public.get_user_tenant_id());
$$;

GRANT EXECUTE ON FUNCTION public.my_collab_id_for_active_tenant() TO authenticated;

-- ── Policy SELECT clients : utilise la version sans param ─────────────
DROP POLICY IF EXISTS "Tenant users can view scoped clients" ON public.clients;

CREATE POLICY "Tenant users can view scoped clients"
ON public.clients
FOR SELECT
TO authenticated
USING (
  public.is_king()
  OR (user_id IS NOT NULL AND user_id = auth.uid())
  OR public.user_has_global_client_scope(tenant_id)
  OR (
    public.user_has_personal_client_scope(tenant_id)
    AND (
      id = public.my_collab_id_for_active_tenant()
      OR assigned_agent_id = public.my_collab_id_for_active_tenant()
    )
  )
  OR (
    public.user_has_team_client_scope(tenant_id)
    AND (
      id = public.my_collab_id_for_active_tenant()
      OR assigned_agent_id = public.my_collab_id_for_active_tenant()
      OR manager_id = public.my_collab_id_for_active_tenant()
      OR public._client_is_in_team(
           tenant_id,
           public.my_collab_id_for_active_tenant(),
           id,
           assigned_agent_id,
           manager_id
         )
    )
  )
);
