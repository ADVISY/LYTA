-- =====================================================
-- SECURITY PATCH v3: Fix remaining RLS vulnerabilities
-- =====================================================

-- 1. FIX clients table - ensure proper tenant isolation
DROP POLICY IF EXISTS "Anyone can view clients" ON public.clients;
DROP POLICY IF EXISTS "Public can view clients" ON public.clients;

-- Check if policy already exists before creating
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'clients' 
    AND policyname = 'Authenticated users access clients via can_access_client'
  ) THEN
    CREATE POLICY "Authenticated users access clients via can_access_client" 
    ON public.clients FOR SELECT TO authenticated
    USING (can_access_client(id));
  END IF;
END $$;

-- 2. FIX profiles table
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public can view profiles" ON public.profiles;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' 
    AND policyname = 'Users can view own or team profiles'
  ) THEN
    CREATE POLICY "Users can view own or team profiles" ON public.profiles FOR SELECT TO authenticated
    USING (
      id = auth.uid() 
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'agent'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'backoffice'::app_role)
    );
  END IF;
END $$;

-- 3. FIX qr_invoices table
DROP POLICY IF EXISTS "Anyone can view invoices" ON public.qr_invoices;
DROP POLICY IF EXISTS "Public can view invoices" ON public.qr_invoices;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'qr_invoices' 
    AND policyname = 'Tenant users can view their invoices'
  ) THEN
    CREATE POLICY "Tenant users can view their invoices" ON public.qr_invoices FOR SELECT TO authenticated
    USING (tenant_id = get_user_tenant_id());
  END IF;
END $$;

-- 4. FIX family_members table
DROP POLICY IF EXISTS "Anyone can view family members" ON public.family_members;
DROP POLICY IF EXISTS "Public can view family members" ON public.family_members;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'family_members' 
    AND policyname = 'Users can view family members of accessible clients'
  ) THEN
    CREATE POLICY "Users can view family members of accessible clients" ON public.family_members FOR SELECT TO authenticated
    USING (
      EXISTS (SELECT 1 FROM clients c WHERE c.id = family_members.client_id AND can_access_client(c.id))
    );
  END IF;
END $$;

-- 5. FIX company_contacts table
DROP POLICY IF EXISTS "Anyone can view company contacts" ON public.company_contacts;
DROP POLICY IF EXISTS "Public can view company contacts" ON public.company_contacts;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'company_contacts' 
    AND policyname = 'Authenticated users can view company contacts'
  ) THEN
    CREATE POLICY "Authenticated users can view company contacts" ON public.company_contacts FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- 6. FIX document_scans - ensure no public SELECT
DROP POLICY IF EXISTS "Public can view document scans" ON public.document_scans;

-- 7. FIX tenant_branding
DROP POLICY IF EXISTS "Anyone can view tenant branding" ON public.tenant_branding;
DROP POLICY IF EXISTS "Public can view tenant branding" ON public.tenant_branding;

-- Create secure function for public branding access (login pages)
CREATE OR REPLACE FUNCTION public.get_public_tenant_branding(p_slug text)
RETURNS TABLE (display_name text, logo_url text, primary_color text, secondary_color text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT tb.display_name, tb.logo_url, tb.primary_color, tb.secondary_color
  FROM tenant_branding tb JOIN tenants t ON t.id = tb.tenant_id
  WHERE t.slug = p_slug LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_tenant_branding(text) TO anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tenant_branding' 
    AND policyname = 'Tenant users can view their branding'
  ) THEN
    CREATE POLICY "Tenant users can view their branding" ON public.tenant_branding FOR SELECT TO authenticated
    USING (tenant_id = get_user_tenant_id() OR is_king());
  END IF;
END $$;

-- 8. FIX insurance_companies
DROP POLICY IF EXISTS "Anyone can view insurance companies" ON public.insurance_companies;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'insurance_companies' 
    AND policyname = 'Authenticated users can view companies'
  ) THEN
    CREATE POLICY "Authenticated users can view companies" ON public.insurance_companies FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- 9. FIX insurance_products
DROP POLICY IF EXISTS "Anyone can view insurance products" ON public.insurance_products;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'insurance_products' 
    AND policyname = 'Authenticated users can view products'
  ) THEN
    CREATE POLICY "Authenticated users can view products" ON public.insurance_products FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- 10. FIX notifications
DROP POLICY IF EXISTS "Anyone can view notifications" ON public.notifications;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' 
    AND policyname = 'Users can view their own notifications'
  ) THEN
    CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;

-- 11. FIX suivis table
DROP POLICY IF EXISTS "Anyone can view suivis" ON public.suivis;
DROP POLICY IF EXISTS "Public can view suivis" ON public.suivis;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'suivis' 
    AND policyname = 'Tenant users can view their suivis'
  ) THEN
    CREATE POLICY "Tenant users can view their suivis" ON public.suivis FOR SELECT TO authenticated
    USING (tenant_id = get_user_tenant_id());
  END IF;
END $$;