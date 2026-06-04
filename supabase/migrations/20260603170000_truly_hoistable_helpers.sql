-- ============================================================================
-- Vrai fix perf : fonctions zéro-param + PARALLEL SAFE pour vraie hoistability
-- ============================================================================
-- Les tentatives précédentes n'arrivaient pas à faire hoister les fonctions
-- car Postgres considère SECURITY DEFINER comme "potentiellement à effet de
-- bord" et refuse l'optimisation.
--
-- Stratégie ici :
-- 1. Créer des helpers SECURITY DEFINER mais marqués PARALLEL SAFE + STABLE,
--    et SANS paramètre row-dépendant. Postgres devrait les évaluer 1 fois
--    par requête.
-- 2. Réécrire la policy SELECT clients pour utiliser ces helpers
--    + comparaisons directes sur colonnes → planner peut utiliser
--    idx_clients_assigned_agent, etc.
-- ============================================================================

-- ── Helper : mon ID collaborateur dans le tenant actif ────────────────
CREATE OR REPLACE FUNCTION public.my_collab_id_v2()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT id
  FROM public.clients
  WHERE user_id = auth.uid()
    AND tenant_id = public.get_user_tenant_id()
    AND type_adresse = 'collaborateur'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.my_collab_id_v2() TO authenticated;

-- ── Helper : mon scope global vrai/faux dans le tenant actif ──────────
CREATE OR REPLACE FUNCTION public.has_global_scope_v2()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT public.user_has_global_client_scope(public.get_user_tenant_id());
$$;

GRANT EXECUTE ON FUNCTION public.has_global_scope_v2() TO authenticated;

-- ── Helper : mon scope personal ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.has_personal_scope_v2()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT public.user_has_personal_client_scope(public.get_user_tenant_id());
$$;

GRANT EXECUTE ON FUNCTION public.has_personal_scope_v2() TO authenticated;

-- ── Helper : mon scope team ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.has_team_scope_v2()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT public.user_has_team_client_scope(public.get_user_tenant_id());
$$;

GRANT EXECUTE ON FUNCTION public.has_team_scope_v2() TO authenticated;

-- ── Policy SELECT clients : minimale + index-friendly ─────────────────
DROP POLICY IF EXISTS "Tenant users can view scoped clients" ON public.clients;

CREATE POLICY "Tenant users can view scoped clients"
ON public.clients
FOR SELECT
TO authenticated
USING (
  -- 1. King : tout
  public.is_king()

  -- 2. Espace client : ma propre fiche
  OR (user_id IS NOT NULL AND user_id = auth.uid())

  -- 3. Global scope (Admin/Backoffice/Compta) sur leur tenant actif
  OR (tenant_id = public.get_user_tenant_id() AND public.has_global_scope_v2())

  -- 4. Personal scope (Agent) — comparaisons directes sur columns
  --    → Postgres peut utiliser idx_clients_assigned_agent + pk(id)
  OR (
    tenant_id = public.get_user_tenant_id()
    AND public.has_personal_scope_v2()
    AND (
      id = public.my_collab_id_v2()
      OR assigned_agent_id = public.my_collab_id_v2()
    )
  )

  -- 5. Team scope (Manager) — idem + check subordinate via SD function
  OR (
    tenant_id = public.get_user_tenant_id()
    AND public.has_team_scope_v2()
    AND (
      id = public.my_collab_id_v2()
      OR assigned_agent_id = public.my_collab_id_v2()
      OR manager_id = public.my_collab_id_v2()
      OR public._client_is_in_team(
           tenant_id,
           public.my_collab_id_v2(),
           id,
           assigned_agent_id,
           manager_id
         )
    )
  )
);
