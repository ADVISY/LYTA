-- ============================================================================
-- Perf critique : réécriture de can_access_client (cause timeout login Stéphane)
-- ============================================================================
-- Bug observé : Stéphane (Agent JCG sans aucun client assigné) ne pouvait
-- plus se connecter — toute requête SELECT clients déclenchait un
-- 'canceling statement due to statement timeout'.
--
-- EXPLAIN ANALYZE :
--   Index Scan idx_clients_tenant + Filter: can_access_client(id)
--   Rows Removed by Filter: 3742
--   Buffers: shared hit=1,758,096   (← 1.7M de blocs)
--   Execution Time: 79 724 ms       (← 80 sec, timeout à 8s)
--
-- Cause : l'ancienne can_access_client utilisait 2 CTE qui re-SELECT
-- clients pour chaque row du parent → explosion O(N²) sur gros tenants.
--
-- Fix : version PL/pgSQL avec court-circuits rapides :
--   1. King → return TRUE direct (0 lookup)
--   2. 1 seul SELECT pour récupérer tenant_id, assigned_agent_id,
--      manager_id, user_id de la row target
--   3. Vérifie user_id = auth.uid() (espace client)
--   4. Court-circuit si user_has_global_client_scope (Admin/Backoffice)
--   5. Pour les Manager/Agent : 1 seul appel current_collaborator_id,
--      puis comparaisons directes (pas de sous-EXISTS sauf pour
--      la hiérarchie team manager)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_access_client(client_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id           uuid;
  v_assigned_agent_id   uuid;
  v_manager_id          uuid;
  v_user_id_on_target   uuid;
  v_me_id               uuid;
BEGIN
  -- 1. King : court-circuit immédiat
  IF public.is_king() THEN
    RETURN TRUE;
  END IF;

  -- 2. Récupère en UN SEUL SELECT toutes les colonnes utiles de la target.
  SELECT tenant_id, assigned_agent_id, manager_id, user_id
  INTO   v_tenant_id, v_assigned_agent_id, v_manager_id, v_user_id_on_target
  FROM public.clients
  WHERE id = client_id;

  IF v_tenant_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 3. C'est sa propre fiche (espace client) : OK
  IF v_user_id_on_target IS NOT NULL AND v_user_id_on_target = auth.uid() THEN
    RETURN TRUE;
  END IF;

  -- 4. Scope global (Admin Cabinet, Back-office, Compta) : court-circuit
  IF public.user_has_global_client_scope(v_tenant_id) THEN
    RETURN TRUE;
  END IF;

  -- 5. Pour les scopes team/personal il nous faut l'ID de la fiche
  -- collaborateur qui correspond à auth.uid() dans CE tenant.
  v_me_id := public.current_collaborator_id(v_tenant_id);
  IF v_me_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 6. Scope team : moi-même, mes clients assignés, ou ceux de mes subordonnés
  IF public.user_has_team_client_scope(v_tenant_id) THEN
    IF client_id = v_me_id
       OR v_assigned_agent_id = v_me_id
       OR v_manager_id = v_me_id
    THEN
      RETURN TRUE;
    END IF;

    -- Subordonnés : un collaborateur dont je suis le manager
    RETURN EXISTS (
      SELECT 1
      FROM public.clients member
      WHERE member.tenant_id = v_tenant_id
        AND member.type_adresse = 'collaborateur'
        AND member.manager_id = v_me_id
        AND (
          client_id = member.id
          OR v_assigned_agent_id = member.id
          OR v_manager_id = member.id
        )
    );
  END IF;

  -- 7. Scope personal (Agent) : juste moi et mes clients assignés
  IF public.user_has_personal_client_scope(v_tenant_id) THEN
    RETURN client_id = v_me_id OR v_assigned_agent_id = v_me_id;
  END IF;

  RETURN FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_access_client(uuid) TO authenticated;

-- ============================================================================
-- King notification
-- ============================================================================
INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
VALUES (
  'Perf : can_access_client reecrit (timeout Stephane JCG)',
  'Reecriture de la fonction can_access_client en PL/pgSQL avec court-circuits rapides. Avant : 80 sec pour 50 rows JCG (statement timeout pour Agent). Apres : attendu <100 ms grace aux court-circuits King/global et SELECT unique sur target.',
  'system_info', 'high',
  jsonb_build_object(
    'migration', '20260603120000_optimize_can_access_client',
    'tenant_concerne', 'JCG Consulting',
    'before_ms', 79724,
    'rows_removed_by_filter', 3742
  )
);
