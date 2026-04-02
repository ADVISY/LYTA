-- =====================================================
-- SECURITY FIX: Critical vulnerabilities before commercialization
-- =====================================================

-- Helper function: check if user is admin (global role) or has admin tenant role
CREATE OR REPLACE FUNCTION public.is_tenant_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Global admin role
    public.has_role(auth.uid(), 'admin'::app_role)
    OR
    -- Or a tenant role with dashboard_scope = 'global' (indicates admin-level access)
    EXISTS (
      SELECT 1 FROM public.user_tenant_roles utr
      JOIN public.tenant_roles tr ON tr.id = utr.role_id
      WHERE utr.user_id = auth.uid()
      AND tr.dashboard_scope = 'global'::dashboard_scope
      AND tr.is_active = true
    )
$$;

-- 1. FIX: notifications table - restrict insert to service role only
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Service role can create notifications" ON public.notifications;
CREATE POLICY "Service role can create notifications" 
ON public.notifications 
FOR INSERT 
TO service_role
WITH CHECK (true);

-- Keep existing user access policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" 
ON public.notifications 
FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications" 
ON public.notifications 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2. FIX: scheduled_emails table - restrict to admins only with tenant isolation
DROP POLICY IF EXISTS "System can insert scheduled emails" ON public.scheduled_emails;
DROP POLICY IF EXISTS "System can update scheduled emails" ON public.scheduled_emails;
DROP POLICY IF EXISTS "Admins can insert scheduled emails for their tenant" ON public.scheduled_emails;
DROP POLICY IF EXISTS "Admins can update scheduled emails for their tenant" ON public.scheduled_emails;
DROP POLICY IF EXISTS "Admins can view scheduled emails for their tenant" ON public.scheduled_emails;
DROP POLICY IF EXISTS "Service role can manage scheduled emails" ON public.scheduled_emails;

CREATE POLICY "Admins can insert scheduled emails for their tenant" 
ON public.scheduled_emails 
FOR INSERT 
WITH CHECK (
  public.is_tenant_admin()
  AND tenant_id = public.get_user_tenant_id()
);

CREATE POLICY "Admins can update scheduled emails for their tenant" 
ON public.scheduled_emails 
FOR UPDATE 
USING (
  public.is_tenant_admin()
  AND tenant_id = public.get_user_tenant_id()
);

CREATE POLICY "Admins can view scheduled emails for their tenant" 
ON public.scheduled_emails 
FOR SELECT 
USING (
  public.is_tenant_admin()
  AND tenant_id = public.get_user_tenant_id()
);

-- Service role can still manage all scheduled emails (for cron jobs)
CREATE POLICY "Service role can manage scheduled emails" 
ON public.scheduled_emails 
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

-- 3. FIX: profiles table - add tenant isolation
DROP POLICY IF EXISTS "Admins and agents can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view profiles in their tenant" ON public.profiles;
DROP POLICY IF EXISTS "King can view all profiles" ON public.profiles;

-- Users can view their own profile
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

-- Admins can view profiles within their tenant only
CREATE POLICY "Admins can view profiles in their tenant" 
ON public.profiles 
FOR SELECT 
USING (
  public.is_tenant_admin()
  AND EXISTS (
    SELECT 1 FROM user_tenant_assignments uta1
    JOIN user_tenant_assignments uta2 ON uta1.tenant_id = uta2.tenant_id
    WHERE uta1.user_id = auth.uid()
    AND uta2.user_id = profiles.id
  )
);

-- King can view all profiles
CREATE POLICY "King can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (public.is_king());

-- 4. FIX: company_contacts - restrict to authenticated users
DROP POLICY IF EXISTS "Anyone can view company contacts" ON public.company_contacts;
DROP POLICY IF EXISTS "Authenticated users can view company contacts" ON public.company_contacts;
CREATE POLICY "Authenticated users can view company contacts" 
ON public.company_contacts 
FOR SELECT 
TO authenticated
USING (true);

-- 5. FIX: audit_logs - restrict insert to service role
DROP POLICY IF EXISTS "System can create audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Service role can create audit logs" ON public.audit_logs;
CREATE POLICY "Service role can create audit logs" 
ON public.audit_logs 
FOR INSERT 
TO service_role
WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins can view audit logs for their tenant" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs for their tenant" 
ON public.audit_logs 
FOR SELECT 
USING (
  (public.is_tenant_admin() AND tenant_id = public.get_user_tenant_id())
  OR public.is_king()
);

-- 6. FIX: insurance_companies - restrict to authenticated users
DROP POLICY IF EXISTS "Anyone can view insurance companies" ON public.insurance_companies;
DROP POLICY IF EXISTS "Authenticated users can view insurance companies" ON public.insurance_companies;
CREATE POLICY "Authenticated users can view insurance companies" 
ON public.insurance_companies 
FOR SELECT 
TO authenticated
USING (true);

-- 7. FIX: insurance_products - restrict to authenticated users
DROP POLICY IF EXISTS "Anyone can view insurance products" ON public.insurance_products;
DROP POLICY IF EXISTS "Authenticated users can view insurance products" ON public.insurance_products;
CREATE POLICY "Authenticated users can view insurance products" 
ON public.insurance_products 
FOR SELECT 
TO authenticated
USING (true);

-- 8. FIX: email_templates - restrict to authenticated users with tenant isolation
DROP POLICY IF EXISTS "Anyone can view email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Public can view system email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Users can view templates for their tenant or system templates" ON public.email_templates;

CREATE POLICY "Users can view templates for their tenant or system templates" 
ON public.email_templates 
FOR SELECT 
TO authenticated
USING (
  is_system = true 
  OR tenant_id = public.get_user_tenant_id()
);

-- 9. FIX: document_categories - restrict to authenticated users
DROP POLICY IF EXISTS "Anyone can view document categories" ON public.document_categories;
DROP POLICY IF EXISTS "Authenticated users can view document categories" ON public.document_categories;
CREATE POLICY "Authenticated users can view document categories" 
ON public.document_categories 
FOR SELECT 
TO authenticated
USING (true);