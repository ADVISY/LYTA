-- Create table for plan definitions (managed by KING)
CREATE TABLE public.platform_plans (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT,
  monthly_price NUMERIC NOT NULL DEFAULT 0,
  seats_included INTEGER NOT NULL DEFAULT 1,
  extra_seat_price NUMERIC NOT NULL DEFAULT 20,
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create table for module definitions
CREATE TABLE public.platform_modules (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create junction table for plan-module relationships
CREATE TABLE public.plan_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id TEXT NOT NULL REFERENCES public.platform_plans(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL REFERENCES public.platform_modules(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plan_id, module_id)
);

-- Insert default plans
INSERT INTO public.platform_plans (id, display_name, description, monthly_price, seats_included, extra_seat_price, stripe_product_id, stripe_price_id, sort_order) VALUES
('start', 'Start', 'Pour démarrer', 69, 1, 20, 'prod_TjgUGx2FNdlhas', 'price_1SmDBeF7ZITS358AgETS41f5', 1),
('pro', 'Pro', 'Pour les cabinets établis', 150, 1, 20, 'prod_TjgmLXohud7WAb', 'price_1SmDSmF7ZITS358AmnGzuosw', 2),
('prime', 'Prime', 'L''expérience complète', 250, 1, 20, 'prod_TjgrBLxInrbnSd', 'price_1SmDU7F7ZITS358ARd44a4sb', 3),
('founder', 'Prime Founder', 'Offre de lancement 6 mois', 150, 1, 20, 'prod_Tk0TPGFCuYQu3Q', 'price_1SmWSCF7ZITS358Au8LylsBw', 4);

-- Insert default modules
INSERT INTO public.platform_modules (id, display_name, description, icon, category, sort_order) VALUES
('clients', 'Gestion des clients', 'Gérer les fiches clients', 'Users', 'core', 1),
('contracts', 'Gestion des contrats', 'Gérer les polices d''assurance', 'FileCheck', 'core', 2),
('commissions', 'Commissions', 'Suivi des commissions', 'DollarSign', 'core', 3),
('statements', 'Décomptes', 'Générer les décomptes', 'FileText', 'core', 4),
('membership', 'Adhésions', 'Gérer les adhésions', 'UserPlus', 'core', 5),
('payroll', 'Masse salariale', 'Gestion de la paie', 'Wallet', 'finance', 6),
('emailing', 'Emailing & Campagnes', 'Envoi d''emails en masse', 'Mail', 'marketing', 7),
('automation', 'Automatisations', 'Workflows automatiques', 'Zap', 'advanced', 8),
('mandate_automation', 'Automation mandats', 'Mandats automatiques', 'FileSignature', 'advanced', 9),
('client_portal', 'Espace client', 'Portail client dédié', 'Globe', 'premium', 10),
('advanced_dashboard', 'Dashboard avancé', 'Tableaux de bord enrichis', 'LayoutDashboard', 'premium', 11),
('advanced_settings', 'Paramètres avancés', 'Configuration avancée', 'Settings', 'premium', 12),
('qr_invoice', 'Factures QR', 'Factures avec QR suisse', 'QrCode', 'premium', 13);

-- Insert plan-module relationships
INSERT INTO public.plan_modules (plan_id, module_id) VALUES
-- Start plan
('start', 'clients'), ('start', 'contracts'), ('start', 'commissions'), ('start', 'statements'), ('start', 'membership'),
-- Pro plan
('pro', 'clients'), ('pro', 'contracts'), ('pro', 'commissions'), ('pro', 'statements'), ('pro', 'membership'),
('pro', 'payroll'), ('pro', 'emailing'), ('pro', 'advanced_dashboard'),
-- Prime plan
('prime', 'clients'), ('prime', 'contracts'), ('prime', 'commissions'), ('prime', 'statements'), ('prime', 'membership'),
('prime', 'payroll'), ('prime', 'emailing'), ('prime', 'automation'), ('prime', 'mandate_automation'),
('prime', 'client_portal'), ('prime', 'advanced_dashboard'), ('prime', 'advanced_settings'), ('prime', 'qr_invoice'),
-- Founder plan (same as Prime)
('founder', 'clients'), ('founder', 'contracts'), ('founder', 'commissions'), ('founder', 'statements'), ('founder', 'membership'),
('founder', 'payroll'), ('founder', 'emailing'), ('founder', 'automation'), ('founder', 'mandate_automation'),
('founder', 'client_portal'), ('founder', 'advanced_dashboard'), ('founder', 'advanced_settings'), ('founder', 'qr_invoice');

-- RLS policies (KING only access via service role, public read for plan features)
ALTER TABLE public.platform_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_modules ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read plans/modules (needed for feature gating)
CREATE POLICY "Anyone can read plans" ON public.platform_plans FOR SELECT USING (true);
CREATE POLICY "Anyone can read modules" ON public.platform_modules FOR SELECT USING (true);
CREATE POLICY "Anyone can read plan_modules" ON public.plan_modules FOR SELECT USING (true);

-- Only KING (via has_role) can modify
CREATE POLICY "KING can manage plans" ON public.platform_plans FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "KING can manage modules" ON public.platform_modules FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "KING can manage plan_modules" ON public.plan_modules FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_platform_plans_updated_at
  BEFORE UPDATE ON public.platform_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();