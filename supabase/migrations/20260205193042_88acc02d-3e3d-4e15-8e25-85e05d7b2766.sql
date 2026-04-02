-- Fix PUBLIC_PLATFORM_CONFIG: Restrict platform_plans, platform_modules, plan_modules to authenticated users
-- Drop existing permissive policies
DROP POLICY IF EXISTS "Anyone can read platform plans" ON public.platform_plans;
DROP POLICY IF EXISTS "Anyone can read platform modules" ON public.platform_modules;
DROP POLICY IF EXISTS "Anyone can read plan modules" ON public.plan_modules;

-- Create restrictive policies requiring authentication
CREATE POLICY "Authenticated users can read platform plans"
ON public.platform_plans FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can read platform modules"
ON public.platform_modules FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can read plan modules"
ON public.plan_modules FOR SELECT
TO authenticated
USING (true);

-- Fix PUBLIC_PRODUCT_CATALOG: Restrict insurance_products and product_aliases to authenticated users
DROP POLICY IF EXISTS "Anyone can read insurance products" ON public.insurance_products;
DROP POLICY IF EXISTS "Anyone can read product aliases" ON public.product_aliases;

-- Create restrictive policies for insurance_products
CREATE POLICY "Authenticated users can read insurance products"
ON public.insurance_products FOR SELECT
TO authenticated
USING (true);

-- Create restrictive policies for product_aliases  
CREATE POLICY "Authenticated users can read product aliases"
ON public.product_aliases FOR SELECT
TO authenticated
USING (true);

-- Fix PUBLIC_POSTAL_CODES: Restrict swiss_postal_codes to authenticated users
DROP POLICY IF EXISTS "Anyone can read postal codes" ON public.swiss_postal_codes;

CREATE POLICY "Authenticated users can read postal codes"
ON public.swiss_postal_codes FOR SELECT
TO authenticated
USING (true);

-- Fix PUBLIC_DOCUMENT_CATEGORIES: Restrict document_categories to authenticated users
DROP POLICY IF EXISTS "Anyone can read document categories" ON public.document_categories;

CREATE POLICY "Authenticated users can read document categories"
ON public.document_categories FOR SELECT
TO authenticated
USING (true);