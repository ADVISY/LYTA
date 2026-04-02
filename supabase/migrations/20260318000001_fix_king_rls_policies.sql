-- Fix RLS policies: King user has role 'king' but policies checked for 'admin'
-- This blocked all INSERT/UPDATE/DELETE operations for the platform super admin

-- ============================================================
-- 1. Fix platform_modules, platform_plans, plan_modules
-- ============================================================

DROP POLICY IF EXISTS "KING can manage modules" ON public.platform_modules;
DROP POLICY IF EXISTS "KING can manage plans" ON public.platform_plans;
DROP POLICY IF EXISTS "KING can manage plan_modules" ON public.plan_modules;

CREATE POLICY "KING can manage modules" ON public.platform_modules
  FOR ALL TO authenticated
  USING (public.is_king())
  WITH CHECK (public.is_king());

CREATE POLICY "KING can manage plans" ON public.platform_plans
  FOR ALL TO authenticated
  USING (public.is_king())
  WITH CHECK (public.is_king());

CREATE POLICY "KING can manage plan_modules" ON public.plan_modules
  FOR ALL TO authenticated
  USING (public.is_king())
  WITH CHECK (public.is_king());

-- ============================================================
-- 2. Fix insurance_products and insurance_companies
-- ============================================================

DROP POLICY IF EXISTS "Admins can manage insurance products" ON public.insurance_products;
DROP POLICY IF EXISTS "Admins can manage insurance companies" ON public.insurance_companies;

CREATE POLICY "King and admins can manage insurance products" ON public.insurance_products
  FOR ALL TO authenticated
  USING (public.is_king() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_king() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "King and admins can manage insurance companies" ON public.insurance_companies
  FOR ALL TO authenticated
  USING (public.is_king() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_king() OR public.has_role(auth.uid(), 'admin'));
