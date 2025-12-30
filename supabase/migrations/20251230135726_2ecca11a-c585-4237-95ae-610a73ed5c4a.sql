-- Table pour les paramètres d'automatisation email par tenant
CREATE TABLE public.tenant_email_automation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- Déclencheurs automatiques
  auto_welcome_email BOOLEAN DEFAULT true,
  auto_contract_deposit_email BOOLEAN DEFAULT true,
  auto_contract_signed_email BOOLEAN DEFAULT true,
  auto_mandat_signed_email BOOLEAN DEFAULT true,
  auto_account_created_email BOOLEAN DEFAULT true,
  -- Emails programmés
  enable_renewal_reminder BOOLEAN DEFAULT true,
  renewal_reminder_days_before INTEGER DEFAULT 30,
  enable_birthday_email BOOLEAN DEFAULT false,
  enable_follow_up_reminder BOOLEAN DEFAULT true,
  follow_up_reminder_days INTEGER DEFAULT 7,
  -- Métadonnées
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

-- Enable RLS
ALTER TABLE public.tenant_email_automation ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Tenant admins can view their email automation settings"
  ON public.tenant_email_automation
  FOR SELECT
  USING (tenant_id = get_user_tenant_id() OR is_king());

CREATE POLICY "Tenant admins can update their email automation settings"
  ON public.tenant_email_automation
  FOR UPDATE
  USING (tenant_id = get_user_tenant_id() OR is_king());

CREATE POLICY "Tenant admins can insert email automation settings"
  ON public.tenant_email_automation
  FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id() OR is_king());

-- Trigger pour updated_at
CREATE TRIGGER update_tenant_email_automation_updated_at
  BEFORE UPDATE ON public.tenant_email_automation
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Table pour tracker les emails programmés envoyés
CREATE TABLE public.scheduled_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL, -- 'renewal_reminder', 'birthday', 'follow_up'
  target_type TEXT NOT NULL, -- 'client', 'policy', 'suivi'
  target_id UUID NOT NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'cancelled'
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_emails ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Tenant users can view their scheduled emails"
  ON public.scheduled_emails
  FOR SELECT
  USING (tenant_id = get_user_tenant_id() OR is_king());

CREATE POLICY "System can insert scheduled emails"
  ON public.scheduled_emails
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update scheduled emails"
  ON public.scheduled_emails
  FOR UPDATE
  USING (true);

-- Index pour les emails à envoyer
CREATE INDEX idx_scheduled_emails_pending ON public.scheduled_emails(scheduled_for, status) WHERE status = 'pending';

-- Fonction pour créer automatiquement les paramètres email lors de la création d'un tenant
CREATE OR REPLACE FUNCTION public.create_default_tenant_email_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Créer les paramètres d'automatisation email par défaut
  INSERT INTO public.tenant_email_automation (tenant_id)
  VALUES (NEW.id);
  
  -- Créer le branding par défaut si pas déjà existant
  INSERT INTO public.tenant_branding (
    tenant_id,
    display_name,
    email_sender_name,
    email_sender_address,
    primary_color,
    secondary_color
  )
  VALUES (
    NEW.id,
    NEW.name,
    NEW.name,
    'noreply@' || NEW.slug || '.ch',
    '#0EA5E9',
    '#6366F1'
  )
  ON CONFLICT (tenant_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Trigger pour créer les paramètres par défaut lors de la création d'un tenant
CREATE TRIGGER create_tenant_email_settings_on_insert
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION create_default_tenant_email_settings();

-- Créer les paramètres pour les tenants existants qui n'en ont pas
INSERT INTO public.tenant_email_automation (tenant_id)
SELECT id FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.tenant_email_automation tea WHERE tea.tenant_id = t.id
);

-- Fonction pour programmer les emails de rappel renouvellement
CREATE OR REPLACE FUNCTION public.schedule_renewal_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Programmer les rappels de renouvellement pour les polices qui expirent bientôt
  INSERT INTO public.scheduled_emails (tenant_id, email_type, target_type, target_id, scheduled_for)
  SELECT 
    p.tenant_id,
    'renewal_reminder',
    'policy',
    p.id,
    (p.end_date - (tea.renewal_reminder_days_before || ' days')::INTERVAL)::TIMESTAMP WITH TIME ZONE
  FROM public.policies p
  JOIN public.tenant_email_automation tea ON tea.tenant_id = p.tenant_id
  WHERE p.end_date IS NOT NULL
    AND p.status = 'active'
    AND tea.enable_renewal_reminder = true
    AND p.end_date > now()
    AND p.end_date <= now() + INTERVAL '60 days'
    AND NOT EXISTS (
      SELECT 1 FROM public.scheduled_emails se 
      WHERE se.target_id = p.id 
        AND se.email_type = 'renewal_reminder'
        AND se.status IN ('pending', 'sent')
    );
END;
$$;

-- Fonction pour programmer les emails de suivi
CREATE OR REPLACE FUNCTION public.schedule_follow_up_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Programmer les rappels de suivi
  INSERT INTO public.scheduled_emails (tenant_id, email_type, target_type, target_id, scheduled_for)
  SELECT 
    s.tenant_id,
    'follow_up',
    'suivi',
    s.id,
    s.reminder_date
  FROM public.suivis s
  JOIN public.tenant_email_automation tea ON tea.tenant_id = s.tenant_id
  WHERE s.reminder_date IS NOT NULL
    AND s.status != 'completed'
    AND tea.enable_follow_up_reminder = true
    AND s.reminder_date > now()
    AND NOT EXISTS (
      SELECT 1 FROM public.scheduled_emails se 
      WHERE se.target_id = s.id 
        AND se.email_type = 'follow_up'
        AND se.status IN ('pending', 'sent')
    );
END;
$$;