-- Supprimer les politiques problématiques
DROP POLICY IF EXISTS "Restricted client access by role" ON public.clients;
DROP POLICY IF EXISTS "Admins have full access to clients" ON public.clients;

-- Créer une fonction SECURITY DEFINER pour vérifier l'accès aux clients
CREATE OR REPLACE FUNCTION public.can_access_client(client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Admin, backoffice, compta peuvent tout voir
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'backoffice'::app_role)
    OR has_role(auth.uid(), 'compta'::app_role)
    OR
    -- Le client lui-même
    EXISTS (
      SELECT 1 FROM clients c 
      WHERE c.id = client_id AND c.user_id = auth.uid()
    )
    OR
    -- Agent/Partner/Manager assigné au client
    EXISTS (
      SELECT 1 FROM clients agent 
      WHERE agent.user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM clients target 
        WHERE target.id = client_id 
        AND (target.assigned_agent_id = agent.id OR target.manager_id = agent.id)
      )
    )
$$;

-- Politique SELECT simple utilisant la fonction
CREATE POLICY "Users can view accessible clients"
ON public.clients
FOR SELECT
USING (public.can_access_client(id));

-- Politique ALL pour admin
CREATE POLICY "Admins have full access"
ON public.clients
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));