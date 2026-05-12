-- ============================================================================
-- Relax RLS on insurance_products + insurance_companies for manager/backoffice
-- ============================================================================
-- Same problem we just fixed for policies: only the strict 'admin' role
-- could manage these tables, which silently blocks UPDATEs when the user
-- has a manager/backoffice profile. The frontend then shows "success" but
-- the change never persists.
-- ============================================================================

-- insurance_products
DROP POLICY IF EXISTS "Tenant staff can manage insurance products" ON public.insurance_products;

CREATE POLICY "Tenant staff can manage insurance products" ON public.insurance_products
  FOR ALL TO authenticated
  USING (
    public.is_king()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'backoffice'::app_role)
  )
  WITH CHECK (
    public.is_king()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'backoffice'::app_role)
  );

-- insurance_companies
DROP POLICY IF EXISTS "Tenant staff can manage insurance companies" ON public.insurance_companies;

CREATE POLICY "Tenant staff can manage insurance companies" ON public.insurance_companies
  FOR ALL TO authenticated
  USING (
    public.is_king()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'backoffice'::app_role)
  )
  WITH CHECK (
    public.is_king()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'backoffice'::app_role)
  );

COMMENT ON POLICY "Tenant staff can manage insurance products" ON public.insurance_products IS
  'Allows admin / manager / backoffice to manage products. Agents and partners can only view.';
