-- ============================================================================
-- Fix RLS critique : restriction visibilité clients pour les Agents
-- ============================================================================
-- Bug observé sur JCG Consulting : les collaborateurs créés avec le rôle
-- "Agent" (dashboard_scope = 'personal') voyaient TOUS les clients/prospects
-- du cabinet au lieu de leurs seuls clients assignés.
--
-- Cause : la table public.clients avait DEUX policies SELECT qui se
-- chevauchent :
--
--   1. "Direct tenant members can view clients"   ← TROP PERMISSIVE
--      → laisse passer n'importe quel membre du tenant, sans tenir
--        compte du scope (global / team / personal) du rôle.
--
--   2. "Tenant users can view scoped clients"     ← LA BONNE
--      → utilise can_access_client(id) qui filtre correctement par
--        scope : global voit tout, team voit hiérarchie, personal voit
--        uniquement target.user_id = auth.uid() OU assigned_agent_id = me.
--
-- En présence de plusieurs policies SELECT, Postgres combine en OR : la
-- plus permissive gagne → le filtre par scope ne sert à rien. Conséquence :
-- un Agent voit tout le portefeuille → fuite de données entre courtiers
-- du même cabinet.
--
-- Fix : on DROP la policy #1. La policy #2 (scopée) couvre tous les cas
-- légitimes :
--   - is_king()                     → King voit tout (autre policy dédiée)
--   - target.user_id = auth.uid()   → un client voit sa propre fiche
--   - user_has_global_client_scope  → Admin Cabinet / Backoffice / Compta
--   - user_has_team_client_scope    → Manager voit son équipe
--   - user_has_personal_client_scope → Agent voit ses clients assignés
--
-- Les tables connexes (policies, suivis, documents, commissions, decomptes)
-- utilisent déjà uniquement la policy scopée → aucune action requise.
-- ============================================================================

DROP POLICY IF EXISTS "Direct tenant members can view clients" ON public.clients;

-- ============================================================================
-- King notification : trou RLS corrigé
-- ============================================================================
INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
VALUES (
  'RLS clients : restriction Agent correctement appliquee',
  'Bug observe sur JCG Consulting : les agents voyaient tout le portefeuille. La policy permissive "Direct tenant members can view clients" est supprimee. Les agents ne voient maintenant que leurs clients assignes (via can_access_client + user_has_personal_client_scope).',
  'system_info', 'high',
  jsonb_build_object(
    'migration', '20260527150000_fix_clients_rls_remove_overpermissive_policy',
    'table', 'public.clients',
    'tenant_origin', 'JCG Consulting'
  )
);
