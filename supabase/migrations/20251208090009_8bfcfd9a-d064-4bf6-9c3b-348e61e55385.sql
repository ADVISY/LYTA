-- Allow admins and agents to view all profiles for commission assignment
CREATE POLICY "Admins and agents can view all profiles"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'agent'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- Allow admins to view all user roles for fetching agents
CREATE POLICY "Admins and agents can view all roles"
ON public.user_roles
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'agent'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);