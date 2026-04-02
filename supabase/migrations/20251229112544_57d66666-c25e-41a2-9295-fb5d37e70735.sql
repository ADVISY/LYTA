-- Table des tenants (cabinets clients SaaS)
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  legal_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'test' CHECK (status IN ('test', 'active', 'suspended')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index pour recherche rapide par slug
CREATE UNIQUE INDEX idx_tenants_slug ON public.tenants(slug);

-- Table branding par tenant
CREATE TABLE public.tenant_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#0066FF',
  secondary_color TEXT DEFAULT '#1a1a2e',
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

-- Table paramètres sécurité par tenant
CREATE TABLE public.tenant_security_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  enable_2fa_login BOOLEAN NOT NULL DEFAULT false,
  enable_2fa_contract BOOLEAN NOT NULL DEFAULT false,
  password_min_length INTEGER NOT NULL DEFAULT 8,
  password_require_uppercase BOOLEAN NOT NULL DEFAULT true,
  password_require_number BOOLEAN NOT NULL DEFAULT true,
  password_require_special BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

-- Ajouter tenant_id aux tables existantes pour le multi-tenant
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.policies ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.commissions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.suivis ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.propositions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.collaborator_permissions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- Table pour lier users aux tenants (un user peut être KING sans tenant, ou admin d'un tenant)
CREATE TABLE public.user_tenant_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  is_platform_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);

-- Enable RLS sur toutes les nouvelles tables
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_security_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tenant_assignments ENABLE ROW LEVEL SECURITY;

-- Fonction pour vérifier si user est KING (platform admin)
CREATE OR REPLACE FUNCTION public.is_king()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'king'::app_role)
$$;

-- Fonction pour obtenir le tenant_id de l'utilisateur courant
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.user_tenant_assignments 
  WHERE user_id = auth.uid() 
  AND tenant_id IS NOT NULL
  LIMIT 1
$$;

-- RLS Policies pour tenants
CREATE POLICY "Kings can manage all tenants" ON public.tenants
FOR ALL USING (public.is_king());

CREATE POLICY "Tenant admins can view their tenant" ON public.tenants
FOR SELECT USING (
  id IN (SELECT tenant_id FROM public.user_tenant_assignments WHERE user_id = auth.uid())
);

-- RLS Policies pour tenant_branding
CREATE POLICY "Kings can manage all branding" ON public.tenant_branding
FOR ALL USING (public.is_king());

CREATE POLICY "Tenant users can view their branding" ON public.tenant_branding
FOR SELECT USING (
  tenant_id IN (SELECT tenant_id FROM public.user_tenant_assignments WHERE user_id = auth.uid())
);

-- RLS Policies pour tenant_security_settings
CREATE POLICY "Kings can manage all security settings" ON public.tenant_security_settings
FOR ALL USING (public.is_king());

CREATE POLICY "Tenant admins can view their security settings" ON public.tenant_security_settings
FOR SELECT USING (
  tenant_id IN (SELECT tenant_id FROM public.user_tenant_assignments WHERE user_id = auth.uid())
);

-- RLS Policies pour user_tenant_assignments
CREATE POLICY "Kings can manage all assignments" ON public.user_tenant_assignments
FOR ALL USING (public.is_king());

CREATE POLICY "Users can view their own assignments" ON public.user_tenant_assignments
FOR SELECT USING (user_id = auth.uid());

-- Triggers pour updated_at
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenant_branding_updated_at
  BEFORE UPDATE ON public.tenant_branding
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenant_security_settings_updated_at
  BEFORE UPDATE ON public.tenant_security_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();