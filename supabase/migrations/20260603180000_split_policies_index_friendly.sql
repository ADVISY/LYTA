-- ============================================================================
-- Refonte radicale : policies multiples au lieu d'un USING monolithique
-- ============================================================================
-- 4 tentatives d'optim ont échoué (80s → 39s → 38s → 42s → 48s) car le
-- planner Postgres ne pouvait pas utiliser les INDEX avec un USING OR
-- massive contenant des fonctions row-dépendantes.
--
-- Stratégie : SPLIT en plusieurs policies PERMISSIVE (Postgres les OR-s
-- automatiquement). Chaque policy a un USING simple qui peut utiliser un
-- index spécifique :
--   - Policy A : USING (is_king()) — court-circuit
--   - Policy B : USING (user_id = auth.uid()) — pk lookup via idx_clients_user
--   - Policy C : USING (tenant_id = mine() AND has_global_scope()) —
--                idx_clients_tenant
--   - Policy D : USING (assigned_agent_id = my_collab_v2() AND
--                has_personal_or_team_scope()) — idx_clients_assigned_agent
--   - Policy E : USING (id = my_collab_v2() AND has_personal_or_team_scope())
--                — pk lookup
--   - Policy F : USING (manager_id = my_collab_v2() AND has_team_scope())
--                — idx_clients_manager_id
--   - Policy G : (subordinate team)
--
-- Pour Stéphane (Agent personal), Policy D match → bitmap scan sur
-- idx_clients_assigned_agent (12 rows) → instantané.
-- Pour Matthieu (Admin global), Policy C match → bitmap scan sur
-- idx_clients_tenant → rapide.
-- ============================================================================

-- ── Combine helper : personal OR team scope ───────────────────────────
CREATE OR REPLACE FUNCTION public.has_personal_or_team_scope_v2()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER PARALLEL SAFE
SET search_path = public
AS $$
  SELECT public.user_has_personal_client_scope(public.get_user_tenant_id())
      OR public.user_has_team_client_scope(public.get_user_tenant_id());
$$;

GRANT EXECUTE ON FUNCTION public.has_personal_or_team_scope_v2() TO authenticated;

-- ── Drop l'ancienne policy monolithique ───────────────────────────────
DROP POLICY IF EXISTS "Tenant users can view scoped clients" ON public.clients;

-- ── A. King : court-circuit ──────────────────────────────────────────
-- Déjà "Kings have full access to all clients" (FOR ALL).

-- ── B. Espace client : sa propre fiche ────────────────────────────────
CREATE POLICY "Client sees own record"
ON public.clients
FOR SELECT
TO authenticated
USING (user_id IS NOT NULL AND user_id = auth.uid());

-- ── C. Global scope : voit tout son tenant ────────────────────────────
CREATE POLICY "Global scope sees all tenant clients"
ON public.clients
FOR SELECT
TO authenticated
USING (
  tenant_id = public.get_user_tenant_id()
  AND public.has_global_scope_v2()
);

-- ── D. Personal/Team scope : clients assignés à moi (via index) ───────
CREATE POLICY "Scoped sees own assigned clients"
ON public.clients
FOR SELECT
TO authenticated
USING (
  assigned_agent_id = public.my_collab_id_v2()
  AND public.has_personal_or_team_scope_v2()
);

-- ── E. Personal/Team scope : ma propre fiche collaborateur ────────────
CREATE POLICY "Scoped sees own collab record"
ON public.clients
FOR SELECT
TO authenticated
USING (
  id = public.my_collab_id_v2()
  AND public.has_personal_or_team_scope_v2()
);

-- ── F. Team scope : clients managés par moi ───────────────────────────
CREATE POLICY "Team scope sees managed clients"
ON public.clients
FOR SELECT
TO authenticated
USING (
  manager_id = public.my_collab_id_v2()
  AND public.has_team_scope_v2()
);

-- ── G. Team scope : clients assignés aux subordonnés ──────────────────
CREATE POLICY "Team scope sees subordinate's clients"
ON public.clients
FOR SELECT
TO authenticated
USING (
  public.has_team_scope_v2()
  AND public._client_is_in_team(
        tenant_id,
        public.my_collab_id_v2(),
        id,
        assigned_agent_id,
        manager_id
      )
);
