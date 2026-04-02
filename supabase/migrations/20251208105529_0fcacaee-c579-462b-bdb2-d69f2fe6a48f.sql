-- Drop existing SELECT policy on clients
DROP POLICY IF EXISTS "Users can view their own client profile" ON public.clients;

-- Create new comprehensive SELECT policy for clients
CREATE POLICY "CRM users can view clients" 
ON public.clients 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'partner'::app_role)
  OR has_role(auth.uid(), 'agent'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'backoffice'::app_role)
  OR has_role(auth.uid(), 'compta'::app_role)
);