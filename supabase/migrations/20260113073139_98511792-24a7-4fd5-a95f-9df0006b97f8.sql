-- Fix commissions SELECT policy to allow all tenant staff to view commissions
-- Currently only admin/compta can see them, which is too restrictive

DROP POLICY IF EXISTS "Tenant users can view their commissions" ON public.commissions;

CREATE POLICY "Tenant users can view their commissions" ON public.commissions
FOR SELECT USING (
  (tenant_id = get_user_tenant_id()) AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'compta'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    has_role(auth.uid(), 'agent'::app_role) OR
    has_role(auth.uid(), 'backoffice'::app_role) OR
    has_role(auth.uid(), 'partner'::app_role) OR
    -- Allow partners to see their own commissions via partner_id
    (EXISTS ( SELECT 1
       FROM partners p
      WHERE ((p.id = commissions.partner_id) AND (p.user_id = auth.uid()))))
  )
);

-- Also update the ALL policy to include more roles for insert/update/delete
DROP POLICY IF EXISTS "Tenant admins can manage commissions" ON public.commissions;

CREATE POLICY "Tenant admins can manage commissions" ON public.commissions
FOR ALL USING (
  (tenant_id = get_user_tenant_id()) AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'compta'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role)
  )
) WITH CHECK (
  (tenant_id = get_user_tenant_id()) AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'compta'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role)
  )
);