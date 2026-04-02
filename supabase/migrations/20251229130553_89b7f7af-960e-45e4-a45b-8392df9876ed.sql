-- ===========================================
-- TENANT ROLES & PERMISSIONS SYSTEM
-- ===========================================

-- Enum for permission actions
CREATE TYPE public.permission_action AS ENUM (
  'view', 'create', 'update', 'delete', 'export', 
  'deposit', 'cancel', 'generate', 'validate', 'modify_rules'
);

-- Enum for permission modules
CREATE TYPE public.permission_module AS ENUM (
  'clients', 'contracts', 'partners', 'products', 
  'collaborators', 'commissions', 'decomptes', 'payout', 
  'dashboard', 'settings'
);

-- Enum for dashboard scope
CREATE TYPE public.dashboard_scope AS ENUM (
  'personal', 'team', 'global'
);

-- ===========================================
-- Table: tenant_roles
-- Roles per tenant (cabinet)
-- ===========================================
CREATE TABLE public.tenant_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_system_role BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  dashboard_scope dashboard_scope NOT NULL DEFAULT 'personal',
  can_see_own_commissions BOOLEAN NOT NULL DEFAULT true,
  can_see_team_commissions BOOLEAN NOT NULL DEFAULT false,
  can_see_all_commissions BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name)
);

-- Enable RLS
ALTER TABLE public.tenant_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tenant_roles
CREATE POLICY "Kings can manage all roles"
ON public.tenant_roles FOR ALL
USING (is_king());

CREATE POLICY "Tenant admins can manage their roles"
ON public.tenant_roles FOR ALL
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can view their tenant roles"
ON public.tenant_roles FOR SELECT
USING (tenant_id = get_user_tenant_id());

-- ===========================================
-- Table: tenant_role_permissions
-- Permission matrix per role
-- ===========================================
CREATE TABLE public.tenant_role_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role_id UUID NOT NULL REFERENCES public.tenant_roles(id) ON DELETE CASCADE,
  module permission_module NOT NULL,
  action permission_action NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(role_id, module, action)
);

-- Enable RLS
ALTER TABLE public.tenant_role_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tenant_role_permissions
CREATE POLICY "Kings can manage all permissions"
ON public.tenant_role_permissions FOR ALL
USING (is_king());

CREATE POLICY "Tenant admins can manage their role permissions"
ON public.tenant_role_permissions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.tenant_roles r
    WHERE r.id = tenant_role_permissions.role_id
    AND r.tenant_id = get_user_tenant_id()
  )
);

CREATE POLICY "Users can view their tenant role permissions"
ON public.tenant_role_permissions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tenant_roles r
    WHERE r.id = tenant_role_permissions.role_id
    AND r.tenant_id = get_user_tenant_id()
  )
);

-- ===========================================
-- Table: user_tenant_roles
-- Links users to roles (many-to-many)
-- ===========================================
CREATE TABLE public.user_tenant_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.tenant_roles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.profiles(id),
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role_id, tenant_id)
);

-- Enable RLS
ALTER TABLE public.user_tenant_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_tenant_roles
CREATE POLICY "Kings can manage all user roles"
ON public.user_tenant_roles FOR ALL
USING (is_king());

CREATE POLICY "Tenant admins can manage user roles"
ON public.user_tenant_roles FOR ALL
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can view their own roles"
ON public.user_tenant_roles FOR SELECT
USING (user_id = auth.uid() OR tenant_id = get_user_tenant_id());

-- ===========================================
-- Function: Check if user has permission
-- ===========================================
CREATE OR REPLACE FUNCTION public.has_tenant_permission(
  _module permission_module,
  _action permission_action
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_tenant_roles utr
    JOIN public.tenant_role_permissions trp ON trp.role_id = utr.role_id
    JOIN public.tenant_roles tr ON tr.id = utr.role_id
    WHERE utr.user_id = auth.uid()
      AND trp.module = _module
      AND trp.action = _action
      AND trp.allowed = true
      AND tr.is_active = true
  )
$$;

-- ===========================================
-- Function: Get user's dashboard scope
-- ===========================================
CREATE OR REPLACE FUNCTION public.get_user_dashboard_scope()
RETURNS dashboard_scope
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT MAX(tr.dashboard_scope::text)::dashboard_scope
      FROM public.user_tenant_roles utr
      JOIN public.tenant_roles tr ON tr.id = utr.role_id
      WHERE utr.user_id = auth.uid()
        AND tr.is_active = true
    ),
    'personal'::dashboard_scope
  )
$$;

-- ===========================================
-- Function: Check if user can see commissions
-- ===========================================
CREATE OR REPLACE FUNCTION public.can_see_commissions_scope()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM public.user_tenant_roles utr
        JOIN public.tenant_roles tr ON tr.id = utr.role_id
        WHERE utr.user_id = auth.uid() AND tr.can_see_all_commissions = true AND tr.is_active = true
      ) THEN 'all'
      WHEN EXISTS (
        SELECT 1 FROM public.user_tenant_roles utr
        JOIN public.tenant_roles tr ON tr.id = utr.role_id
        WHERE utr.user_id = auth.uid() AND tr.can_see_team_commissions = true AND tr.is_active = true
      ) THEN 'team'
      WHEN EXISTS (
        SELECT 1 FROM public.user_tenant_roles utr
        JOIN public.tenant_roles tr ON tr.id = utr.role_id
        WHERE utr.user_id = auth.uid() AND tr.can_see_own_commissions = true AND tr.is_active = true
      ) THEN 'own'
      ELSE 'none'
    END
$$;

-- ===========================================
-- Triggers for updated_at
-- ===========================================
CREATE TRIGGER update_tenant_roles_updated_at
BEFORE UPDATE ON public.tenant_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================
-- Index for performance
-- ===========================================
CREATE INDEX idx_tenant_roles_tenant ON public.tenant_roles(tenant_id);
CREATE INDEX idx_tenant_role_permissions_role ON public.tenant_role_permissions(role_id);
CREATE INDEX idx_user_tenant_roles_user ON public.user_tenant_roles(user_id);
CREATE INDEX idx_user_tenant_roles_tenant ON public.user_tenant_roles(tenant_id);