-- ============================================================================
-- Fix récursion infinie + maintien perf : SECURITY DEFINER pour la sous-EXISTS
-- ============================================================================
-- La policy inline créée à la migration précédente plantait avec :
--   ERROR 42P17: infinite recursion detected in policy for relation "clients"
-- car EXISTS (SELECT FROM clients member WHERE ...) déclenche à nouveau la
-- policy USING sur clients → récursion.
--
-- Fix : extraire la sous-query "check subordinate" dans une fonction
-- SECURITY DEFINER qui bypass les RLS pour son lookup interne.
-- ============================================================================

CREATE OR REPLACE FUNCTION public._client_is_in_team(
  p_tenant_id           uuid,
  p_me_id               uuid,
  p_client_id           uuid,
  p_assigned_agent_id   uuid,
  p_manager_id          uuid
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clients member
    WHERE member.tenant_id = p_tenant_id
      AND member.type_adresse = 'collaborateur'
      AND member.manager_id = p_me_id
      AND (
        p_client_id = member.id
        OR p_assigned_agent_id = member.id
        OR p_manager_id = member.id
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public._client_is_in_team(uuid, uuid, uuid, uuid, uuid) TO authenticated;

-- ── Réécriture de la policy SELECT pour utiliser la fonction ──────────
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
      id = public.current_collaborator_id(tenant_id)
      OR assigned_agent_id = public.current_collaborator_id(tenant_id)
    )
  )
  OR (
    public.user_has_team_client_scope(tenant_id)
    AND (
      id = public.current_collaborator_id(tenant_id)
      OR assigned_agent_id = public.current_collaborator_id(tenant_id)
      OR manager_id = public.current_collaborator_id(tenant_id)
      OR public._client_is_in_team(
           tenant_id,
           public.current_collaborator_id(tenant_id),
           id,
           assigned_agent_id,
           manager_id
         )
    )
  )
);
