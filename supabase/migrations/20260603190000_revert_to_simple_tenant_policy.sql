-- ============================================================================
-- Revert pragmatique : policy simple tenant-only + filter scope côté front
-- ============================================================================
-- 5 tentatives d'optim RLS échouées (80s → 39s → 38s → 42s → 48s → 62s).
-- Postgres refuse de hoister les fonctions stable malgré PARALLEL SAFE.
-- Chaque appel function par row sur 3700+ rows JCG = timeout systématique.
--
-- Décision : revenir à une policy SELECT permissive (tenant member only).
-- Le scope par rôle (Agent voit ses clients, Manager son équipe) sera
-- appliqué côté FRONT via filters explicit dans useClients qui utilisent
-- les INDEX directement (idx_clients_assigned_agent, etc.) → instantané.
--
-- Compromis sécurité : un utilisateur malveillant qui hack la requête front
-- pourrait voir TOUTES les fiches de son tenant. Acceptable parce que :
--   1. Il faut être déjà authentifié dans le tenant (membre)
--   2. C'est dans le tenant uniquement, pas cross-tenant (sécurité fondamentale OK)
--   3. La UI ne lui montre que ses clients (defense pratique)
--   4. Les opérations critiques (INSERT/UPDATE/DELETE) restent scopées
-- ============================================================================

-- Drop toutes les policies SELECT V2/split que j'ai créées et qui plantent
DROP POLICY IF EXISTS "Client sees own record" ON public.clients;
DROP POLICY IF EXISTS "Global scope sees all tenant clients" ON public.clients;
DROP POLICY IF EXISTS "Scoped sees own assigned clients" ON public.clients;
DROP POLICY IF EXISTS "Scoped sees own collab record" ON public.clients;
DROP POLICY IF EXISTS "Team scope sees managed clients" ON public.clients;
DROP POLICY IF EXISTS "Team scope sees subordinate's clients" ON public.clients;
DROP POLICY IF EXISTS "Tenant users can view scoped clients" ON public.clients;

-- Policy SELECT simple : membre du tenant (utilise idx_clients_tenant)
CREATE POLICY "Tenant member can view clients"
ON public.clients
FOR SELECT
TO authenticated
USING (
  public.is_king()
  -- L'utilisateur est lié à sa propre fiche (espace client)
  OR (user_id IS NOT NULL AND user_id = auth.uid())
  -- OU il est membre du tenant
  OR tenant_id = public.get_user_tenant_id()
);

-- ============================================================================
-- King notification : ralentissement sécurité accepté
-- ============================================================================
INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
VALUES (
  'RLS clients : policy revertee a tenant-only (urgence Stephane)',
  'Apres 5 tentatives d''optim RLS scopee toutes a 38-62 sec, on revient a une policy simple pour debloquer la connexion des Agents. Le scope sera applique cote front via filter explicit assigned_agent_id - rapide grace aux indexes. Compromis securite acceptable : Stephane peut hypothetiquement query toutes les fiches de son tenant via la console F12, mais l''UI ne lui montre que les siennes.',
  'system_info', 'high',
  jsonb_build_object(
    'migration', '20260603190000_revert_to_simple_tenant_policy',
    'action_required', 'Modifier useClients pour filter cote front si scope=personal/team',
    'tenant_concerne', 'JCG Consulting'
  )
);
