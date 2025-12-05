-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Partners and agents can create family members" ON public.family_members;

-- Create new policy with more roles
CREATE POLICY "Staff can create family members" 
ON public.family_members 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'partner'::app_role) OR 
  has_role(auth.uid(), 'agent'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'backoffice'::app_role)
);

-- Update the UPDATE policy as well
DROP POLICY IF EXISTS "Partners and agents can update family members" ON public.family_members;

CREATE POLICY "Staff can update family members" 
ON public.family_members 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'partner'::app_role) OR 
  has_role(auth.uid(), 'agent'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'backoffice'::app_role)
);

-- Update the SELECT policy to include more roles
DROP POLICY IF EXISTS "Users can view family members for their clients" ON public.family_members;

CREATE POLICY "Users can view family members for their clients" 
ON public.family_members 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'partner'::app_role) OR 
  has_role(auth.uid(), 'agent'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'backoffice'::app_role) OR
  (EXISTS ( 
    SELECT 1 FROM clients 
    WHERE clients.id = family_members.client_id 
    AND (clients.user_id = auth.uid() OR clients.assigned_agent_id = auth.uid())
  ))
);