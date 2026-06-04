-- ============================================================================
-- Perf critique #2 : policy SELECT clients en INLINE (cause root du timeout)
-- ============================================================================
-- Précédent fix de can_access_client (migration 20260603120000) a divisé par
-- 2 le temps (80s → 39s) mais c'est encore catastrophiquement au-dessus du
-- statement_timeout 8s. Cause : Postgres appelle can_access_client(id) row
-- par row, et même optimisée la fonction fait au minimum 1 SELECT sur
-- clients pour récupérer les colonnes de la target → 3754 SELECTs cumulés.
--
-- Vraie solution : on inline la logique dans le USING de la policy. Les
-- fonctions STABLE comme user_has_*_scope(tenant_id) et
-- current_collaborator_id(tenant_id) sont alors évaluées UNE SEULE FOIS
-- par requête (Postgres les hoiste), et les comparaisons restantes sont
-- des tests directs sur les colonnes (id, assigned_agent_id, manager_id,
-- user_id) → le planner peut utiliser les INDEX (idx_clients_assigned_agent,
-- etc.) au lieu d'un seq scan + filter.
--
-- Pour Stéphane (Agent JCG, scope personal, 0 client assigné) :
--   AVANT : Filter: can_access_client(id), Rows Removed: 3742, 39 sec
--   APRÈS : Bitmap Index Scan sur idx_clients_assigned_agent — quasi
--           instantané (12 rows lus directement par index)
-- ============================================================================

DROP POLICY IF EXISTS "Tenant users can view scoped clients" ON public.clients;

CREATE POLICY "Tenant users can view scoped clients"
ON public.clients
FOR SELECT
TO authenticated
USING (
  -- 1. King : tout voir
  public.is_king()

  -- 2. Espace client : la fiche m'appartient
  OR (user_id IS NOT NULL AND user_id = auth.uid())

  -- 3. Scope global du rôle (Admin Cabinet / Back-office / Compta)
  -- → user_has_global_client_scope est STABLE, évalué une seule fois.
  OR public.user_has_global_client_scope(tenant_id)

  -- 4. Scope personal (Agent) : moi-même OU mes clients assignés
  -- current_collaborator_id et user_has_personal_client_scope sont STABLE.
  OR (
    public.user_has_personal_client_scope(tenant_id)
    AND (
      id = public.current_collaborator_id(tenant_id)
      OR assigned_agent_id = public.current_collaborator_id(tenant_id)
    )
  )

  -- 5. Scope team (Manager) : moi, mes clients assignés, mes managés, et
  -- les clients/contacts assignés à mes managés.
  OR (
    public.user_has_team_client_scope(tenant_id)
    AND (
      id = public.current_collaborator_id(tenant_id)
      OR assigned_agent_id = public.current_collaborator_id(tenant_id)
      OR manager_id = public.current_collaborator_id(tenant_id)
      OR EXISTS (
        SELECT 1
        FROM public.clients member
        WHERE member.tenant_id = clients.tenant_id
          AND member.type_adresse = 'collaborateur'
          AND member.manager_id = public.current_collaborator_id(clients.tenant_id)
          AND (
            clients.id = member.id
            OR clients.assigned_agent_id = member.id
            OR clients.manager_id = member.id
          )
      )
    )
  )
);

-- ============================================================================
-- King notification
-- ============================================================================
INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
VALUES (
  'Perf : policy SELECT clients inline (fini les timeout login Agent)',
  'Policy reecrite en inline (sans appel de can_access_client par row). Les fonctions STABLE (user_has_*_scope, current_collaborator_id) ne sont evaluees qu''une fois par requete. Les comparaisons directes (id =, assigned_agent_id =) permettent au planner d''utiliser les INDEX (idx_clients_assigned_agent) au lieu d''un seq scan.',
  'system_info', 'high',
  jsonb_build_object(
    'migration', '20260603130000_inline_clients_select_policy',
    'expected_speedup', '300x+',
    'tenant_concerne', 'JCG Consulting'
  )
);
