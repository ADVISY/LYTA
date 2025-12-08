-- Supprimer la vue clients_secure qui cause de la confusion
DROP VIEW IF EXISTS public.clients_secure;

-- Vérifier et recréer la politique RLS restrictive sur clients
DROP POLICY IF EXISTS "Users can view assigned or all clients based on role" ON public.clients;
DROP POLICY IF EXISTS "Admins can manage all clients" ON public.clients;

-- Politique SELECT restrictive
CREATE POLICY "Restricted client access by role"
ON public.clients
FOR SELECT
USING (
  -- Le client peut voir son propre profil
  auth.uid() = user_id
  OR
  -- Admin, backoffice, compta voient tout
  has_role(auth.uid(), 'admin'::app_role)
  OR
  has_role(auth.uid(), 'backoffice'::app_role)
  OR
  has_role(auth.uid(), 'compta'::app_role)
  OR
  -- Agents/partners/managers voient seulement leurs clients assignés
  (
    has_role(auth.uid(), 'agent'::app_role) 
    AND EXISTS (
      SELECT 1 FROM public.clients c2 
      WHERE c2.user_id = auth.uid() 
      AND (clients.assigned_agent_id = c2.id OR clients.manager_id = c2.id)
    )
  )
  OR
  (
    has_role(auth.uid(), 'partner'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.clients c2 
      WHERE c2.user_id = auth.uid() 
      AND (clients.assigned_agent_id = c2.id OR clients.manager_id = c2.id)
    )
  )
  OR
  (
    has_role(auth.uid(), 'manager'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.clients c2 
      WHERE c2.user_id = auth.uid() 
      AND (clients.assigned_agent_id = c2.id OR clients.manager_id = c2.id)
    )
  )
);

-- Politique ALL pour admin seulement
CREATE POLICY "Admins have full access to clients"
ON public.clients
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));