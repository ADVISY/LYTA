-- La vue clients_secure hérite des RLS de la table clients grâce à security_invoker = true
-- Mais pour plus de clarté, on peut aussi restreindre les policies sur clients

-- D'abord, supprimons la policy trop large et créons-en une plus restrictive
DROP POLICY IF EXISTS "CRM users can view clients" ON public.clients;

-- Politique plus restrictive : les utilisateurs ne voient que les clients qui leur sont assignés
-- ou tous les clients si admin/backoffice
CREATE POLICY "Users can view assigned or all clients based on role"
ON public.clients
FOR SELECT
USING (
  -- Le client lui-même peut voir son profil
  (auth.uid() = user_id) 
  OR 
  -- Admin et backoffice voient tout
  has_role(auth.uid(), 'admin'::app_role) 
  OR 
  has_role(auth.uid(), 'backoffice'::app_role)
  OR
  has_role(auth.uid(), 'compta'::app_role)
  OR
  -- Partners, agents, managers ne voient que leurs clients assignés
  (
    (has_role(auth.uid(), 'partner'::app_role) OR has_role(auth.uid(), 'agent'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
    AND (
      assigned_agent_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
      OR manager_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    )
  )
);