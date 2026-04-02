
-- Create function to check if user is tenant admin (security definer to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_tenant_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_tenant_roles utr
    JOIN public.tenant_roles tr ON tr.id = utr.role_id
    WHERE utr.user_id = auth.uid()
    AND tr.name IN ('Admin Cabinet', 'Manager')
    AND tr.is_active = true
  )
$$;

-- New SELECT policies: Only tenant admins can read plans/modules
CREATE POLICY "Tenant admins can read plans"
ON public.platform_plans
FOR SELECT
TO authenticated
USING (public.is_tenant_admin() OR public.is_king());

CREATE POLICY "Tenant admins can read modules"
ON public.platform_modules
FOR SELECT
TO authenticated
USING (public.is_tenant_admin() OR public.is_king());

CREATE POLICY "Tenant admins can read plan_modules"
ON public.plan_modules
FOR SELECT
TO authenticated
USING (public.is_tenant_admin() OR public.is_king());
