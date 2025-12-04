-- Allow partners and agents to update clients
CREATE POLICY "Partners can update clients" 
ON public.clients 
FOR UPDATE 
USING (has_role(auth.uid(), 'partner'::app_role) OR has_role(auth.uid(), 'agent'::app_role));