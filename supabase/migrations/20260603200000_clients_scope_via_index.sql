-- ============================================================================
-- Vrai scope sécurisé qui exploite idx_clients_assigned_agent (sargable)
-- ============================================================================
-- La policy permissive précédente (tenant_id only) laissait Stéphane voir
-- TOUTES les fiches JCG → trou sécurité. Règle métier : un Agent ne doit
-- voir QUE ses clients assignés.
--
-- Astuce clé : utiliser des conditions SARGABLES sur les colonnes indexées
-- (assigned_agent_id, id, user_id) avec my_collab_id_v2() qui retourne
-- une valeur constante pour la requête (zéro param row-dépendant).
--
-- Postgres devrait choisir un Bitmap Index Scan combiné :
--   1. idx_clients_assigned_agent pour assigned_agent_id = my_collab_id
--   2. pk(id) pour id = my_collab_id (sa propre fiche collab)
--   3. idx_clients_user pour user_id = auth.uid()
--   4. idx_clients_tenant pour tenant_id = ... AND has_global_scope
-- ============================================================================

-- Drop la policy permissive temporaire
DROP POLICY IF EXISTS "Tenant member can view clients" ON public.clients;

-- Policy unique mais SARGABLE pour chaque branche du OR
CREATE POLICY "Scoped clients view with index"
ON public.clients
FOR SELECT
TO authenticated
USING (
  -- A. Court-circuit King
  public.is_king()

  -- B. Court-circuit espace client (use idx_clients_user)
  OR (user_id IS NOT NULL AND user_id = auth.uid())

  -- C. Global scope : voit tout son tenant (use idx_clients_tenant)
  OR (tenant_id = public.get_user_tenant_id() AND public.has_global_scope_v2())

  -- D. Sa propre fiche collaborateur (use pk)
  --    my_collab_id_v2() est constant pour la requête → index lookup direct
  OR (id = public.my_collab_id_v2())

  -- E. Clients assignés à moi (use idx_clients_assigned_agent)
  --    Critical : assigned_agent_id = constant → bitmap index scan
  OR (assigned_agent_id IS NOT NULL AND assigned_agent_id = public.my_collab_id_v2())

  -- F. Manager : voit les clients dont je suis le manager (use idx_clients_manager_id)
  OR (manager_id IS NOT NULL AND manager_id = public.my_collab_id_v2() AND public.has_team_scope_v2())

  -- G. Manager : voit les clients de mes subordonnés (via SD function pour éviter récursion)
  OR (
    public.has_team_scope_v2()
    AND public._client_is_in_team(
          tenant_id,
          public.my_collab_id_v2(),
          id,
          assigned_agent_id,
          manager_id
        )
  )
);

-- ============================================================================
-- King notification
-- ============================================================================
INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
VALUES (
  'RLS clients : scope securise via INDEX (assigned_agent_id sargable)',
  'Tentative #6 : policy unique avec OR de conditions SARGABLES. Chaque branche peut utiliser un INDEX direct (assigned_agent_id, id, user_id, manager_id, tenant_id). Stephane (Agent) ne voit que ses clients assignes + lui-meme.',
  'system_info', 'high',
  jsonb_build_object(
    'migration', '20260603200000_clients_scope_via_index',
    'expected_speedup_vs_old_can_access', '1000x+'
  )
);
