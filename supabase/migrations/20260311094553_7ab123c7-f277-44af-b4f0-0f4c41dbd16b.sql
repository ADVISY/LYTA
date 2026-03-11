
-- Pilot feature restricted to Advisy tenant until validation.

-- Table 1: external_apps - Catalog of available external applications
CREATE TABLE public.external_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description_short TEXT,
  description_long TEXT,
  logo_url TEXT,
  connection_type TEXT NOT NULL DEFAULT 'link',
  launch_mode TEXT NOT NULL DEFAULT 'external',
  launch_url TEXT,
  embed_allowed BOOLEAN NOT NULL DEFAULT false,
  oauth_supported BOOLEAN NOT NULL DEFAULT false,
  smartflow_compatible BOOLEAN NOT NULL DEFAULT false,
  integration_level INTEGER NOT NULL DEFAULT 1,
  is_premium BOOLEAN NOT NULL DEFAULT false,
  is_beta BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  config_schema JSONB DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 2: tenant_app_settings - Per-tenant app configuration
CREATE TABLE public.tenant_app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES public.external_apps(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  config_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, app_id)
);

-- Table 3: user_app_connections - User-level app connections
CREATE TABLE public.user_app_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  app_id UUID NOT NULL REFERENCES public.external_apps(id) ON DELETE CASCADE,
  connection_status TEXT NOT NULL DEFAULT 'disconnected',
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  metadata_json JSONB DEFAULT '{}',
  connected_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id, app_id)
);

-- Table 4: app_usage_logs - Usage tracking
CREATE TABLE public.app_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  app_id UUID NOT NULL REFERENCES public.external_apps(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL DEFAULT 'open',
  metadata_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 5: tenant_feature_flags - Feature flags per tenant
CREATE TABLE public.tenant_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
  lyta_tools_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.external_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_app_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_feature_flags ENABLE ROW LEVEL SECURITY;

-- RLS: external_apps (public catalog, read for authenticated)
CREATE POLICY "authenticated_read_active_apps" ON public.external_apps
  FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "king_manage_apps" ON public.external_apps
  FOR ALL TO authenticated
  USING (public.is_king()) WITH CHECK (public.is_king());

-- RLS: tenant_app_settings (tenant isolation)
CREATE POLICY "tenant_read_app_settings" ON public.tenant_app_settings
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "king_manage_all_app_settings" ON public.tenant_app_settings
  FOR ALL TO authenticated
  USING (public.is_king()) WITH CHECK (public.is_king());

CREATE POLICY "admin_manage_tenant_app_settings" ON public.tenant_app_settings
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin())
  WITH CHECK (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin());

-- RLS: user_app_connections (user + tenant isolation)
CREATE POLICY "user_manage_own_connections" ON public.user_app_connections
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND tenant_id = public.get_user_tenant_id())
  WITH CHECK (user_id = auth.uid() AND tenant_id = public.get_user_tenant_id());

CREATE POLICY "admin_view_tenant_connections" ON public.user_app_connections
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin());

-- RLS: app_usage_logs (user can insert, admin can read tenant)
CREATE POLICY "user_insert_usage_logs" ON public.app_usage_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND tenant_id = public.get_user_tenant_id());

CREATE POLICY "admin_read_usage_logs" ON public.app_usage_logs
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin());

-- RLS: tenant_feature_flags (tenant isolation)
CREATE POLICY "tenant_read_feature_flags" ON public.tenant_feature_flags
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "king_manage_feature_flags" ON public.tenant_feature_flags
  FOR ALL TO authenticated
  USING (public.is_king()) WITH CHECK (public.is_king());

-- Updated_at triggers
CREATE TRIGGER set_updated_at_external_apps BEFORE UPDATE ON public.external_apps
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_tenant_app_settings BEFORE UPDATE ON public.tenant_app_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_user_app_connections BEFORE UPDATE ON public.user_app_connections
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_tenant_feature_flags BEFORE UPDATE ON public.tenant_feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable LYTA Tools for Advisy tenant (pilot)
INSERT INTO public.tenant_feature_flags (tenant_id, lyta_tools_enabled)
VALUES ('e8d1cab6-1053-49f8-90dc-eed500b8be37', true);

-- Seed initial app catalog
INSERT INTO public.external_apps (slug, name, category, description_short, description_long, logo_url, connection_type, launch_mode, launch_url, embed_allowed, oauth_supported, smartflow_compatible, integration_level, is_premium, is_beta, sort_order) VALUES
('gmail', 'Gmail', 'communication', 'Messagerie email professionnelle Google', 'Gmail est le service de messagerie de Google, utilisé par des millions de professionnels. Gérez vos emails, contacts et agenda directement depuis LYTA.', 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Gmail_icon_%282020%29.svg', 'oauth', 'external', 'https://mail.google.com', false, true, true, 2, false, false, 10),
('outlook', 'Outlook', 'communication', 'Messagerie et calendrier Microsoft', 'Microsoft Outlook combine email, calendrier, contacts et tâches. Idéal pour la gestion professionnelle de la communication.', 'https://upload.wikimedia.org/wikipedia/commons/d/df/Microsoft_Office_Outlook_%282018%E2%80%93present%29.svg', 'oauth', 'external', 'https://outlook.office.com', false, true, true, 2, false, false, 11),
('whatsapp-business', 'WhatsApp Business', 'communication', 'Communication client par messagerie instantanée', 'WhatsApp Business permet de communiquer directement avec vos clients, envoyer des notifications et gérer vos conversations professionnelles.', 'https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg', 'api_key', 'external', 'https://business.whatsapp.com', false, false, true, 2, true, true, 12),
('zoom', 'Zoom', 'communication', 'Visioconférence et réunions en ligne', 'Zoom permet d''organiser des réunions vidéo, webinaires et conférences téléphoniques avec vos clients et collaborateurs.', 'https://upload.wikimedia.org/wikipedia/commons/1/11/Zoom_Logo_2022.svg', 'oauth', 'external', 'https://zoom.us', false, true, true, 2, false, false, 13),
('google-meet', 'Google Meet', 'communication', 'Visioconférence Google', 'Google Meet offre des réunions vidéo sécurisées et intégrées à l''écosystème Google Workspace.', 'https://fonts.gstatic.com/s/i/productlogos/meet_2020q4/v1/web-96dp/logo_meet_2020q4_color_2x_web_96dp.png', 'oauth', 'external', 'https://meet.google.com', false, true, false, 1, false, false, 14),
('google-drive', 'Google Drive', 'stockage', 'Stockage cloud et collaboration documentaire', 'Google Drive permet de stocker, partager et collaborer sur des documents, feuilles de calcul et présentations dans le cloud.', 'https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg', 'oauth', 'embed', 'https://drive.google.com', true, true, true, 3, false, false, 20),
('dropbox', 'Dropbox', 'stockage', 'Stockage et partage de fichiers sécurisé', 'Dropbox offre un stockage cloud sécurisé avec synchronisation automatique et partage de fichiers professionnel.', 'https://upload.wikimedia.org/wikipedia/commons/7/78/Dropbox_Icon.svg', 'oauth', 'external', 'https://www.dropbox.com', false, true, false, 2, false, false, 21),
('onedrive', 'OneDrive', 'stockage', 'Stockage cloud Microsoft', 'OneDrive est le service de stockage cloud de Microsoft, intégré à Office 365 pour une collaboration transparente.', 'https://upload.wikimedia.org/wikipedia/commons/3/3c/Microsoft_Office_OneDrive_%282019%E2%80%93present%29.svg', 'oauth', 'external', 'https://onedrive.live.com', false, true, false, 2, false, false, 22),
('docusign', 'DocuSign', 'signature', 'Signature électronique de documents', 'DocuSign permet de signer électroniquement des contrats et documents en toute sécurité, conformément aux réglementations.', 'https://upload.wikimedia.org/wikipedia/commons/c/cb/Docusign_Logo.svg', 'oauth', 'external', 'https://www.docusign.com', false, true, true, 3, true, false, 30),
('yousign', 'Yousign', 'signature', 'Signature électronique européenne', 'Yousign est une solution de signature électronique conforme eIDAS, parfaite pour les professionnels européens de l''assurance.', 'https://yousign.com/favicon-32x32.png', 'api_key', 'external', 'https://yousign.com', false, false, true, 3, true, false, 31),
('google-calendar', 'Google Calendar', 'productivite', 'Gestion d''agenda et planification', 'Google Calendar permet de planifier vos rendez-vous, réunions et événements, avec partage et notifications automatiques.', 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg', 'oauth', 'embed', 'https://calendar.google.com', true, true, true, 3, false, false, 40),
('calendly', 'Calendly', 'productivite', 'Prise de rendez-vous en ligne automatisée', 'Calendly automatise la prise de rendez-vous en permettant aux clients de réserver directement un créneau disponible.', 'https://assets.calendly.com/assets/frontend/media/calendly-logo-429ee63d22f7b56e29da.svg', 'oauth', 'embed', 'https://calendly.com', true, true, true, 3, false, false, 41),
('notion', 'Notion', 'productivite', 'Espace de travail collaboratif tout-en-un', 'Notion combine notes, bases de données, wikis et gestion de projets dans un seul espace de travail.', 'https://upload.wikimedia.org/wikipedia/commons/4/45/Notion_app_logo.png', 'oauth', 'external', 'https://www.notion.so', false, true, false, 2, false, false, 42),
('trello', 'Trello', 'productivite', 'Gestion de projets par tableaux Kanban', 'Trello organise vos projets en tableaux visuels avec des cartes et des listes pour un suivi simple et efficace.', 'https://upload.wikimedia.org/wikipedia/en/8/8c/Trello_logo.svg', 'oauth', 'external', 'https://trello.com', false, true, false, 2, false, false, 43),
('stripe', 'Stripe', 'finance', 'Plateforme de paiement en ligne', 'Stripe permet de gérer les paiements, abonnements et factures en ligne avec une API puissante et sécurisée.', 'https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg', 'api_key', 'external', 'https://dashboard.stripe.com', false, false, true, 4, true, false, 50),
('quickbooks', 'QuickBooks', 'finance', 'Comptabilité et facturation', 'QuickBooks simplifie la comptabilité, la facturation et le suivi des dépenses pour les petites entreprises et cabinets.', 'https://upload.wikimedia.org/wikipedia/commons/1/1e/QuickBooks_logo.png', 'oauth', 'external', 'https://quickbooks.intuit.com', false, true, true, 3, true, true, 51),
('bexio', 'Bexio', 'finance', 'Logiciel de gestion suisse', 'Bexio est la solution de gestion d''entreprise suisse : comptabilité, facturation, salaires et CRM intégrés.', 'https://www.bexio.com/favicon-32x32.png', 'api_key', 'external', 'https://office.bexio.com', false, false, true, 3, true, false, 52),
('chatgpt', 'ChatGPT', 'ia', 'Assistant IA conversationnel', 'ChatGPT d''OpenAI permet de générer du texte, analyser des documents et automatiser des tâches grâce à l''intelligence artificielle.', 'https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg', 'api_key', 'external', 'https://chat.openai.com', false, false, true, 2, false, false, 60),
('zapier', 'Zapier', 'ia', 'Automatisation de workflows inter-applications', 'Zapier connecte plus de 5000 applications et automatise les tâches répétitives sans code. Idéal pour les workflows SmartFlow.', 'https://cdn.zapier.com/zcms/terracotta/93f0e53cab3e07f82d01ee0345f8e764.svg', 'api_key', 'external', 'https://zapier.com', false, false, true, 4, true, false, 61),
('make', 'Make', 'ia', 'Plateforme d''automatisation visuelle', 'Make (ex-Integromat) permet de créer des scénarios d''automatisation visuels complexes connectant vos applications.', 'https://images.ctfassets.net/qqlj6g4ee76j/2zIuWVqSEcMIKKASKKoSCe/8f6adfa49fec0c159cbc/make-logo.svg', 'api_key', 'external', 'https://www.make.com', false, false, true, 4, true, false, 62),
('3cx', '3CX', 'telephonie', 'Système téléphonique VoIP professionnel', '3CX est un système de téléphonie IP complet avec PBX, visioconférence, chat et intégration CRM pour une communication unifiée.', 'https://www.3cx.com/wp-content/uploads/2020/02/3cx-logo.svg', 'api_key', 'embed', 'https://login.3cx.com', true, false, true, 3, false, false, 70);
