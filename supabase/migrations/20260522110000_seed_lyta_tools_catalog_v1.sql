-- ============================================================================
-- LYTA Tools — Seed catalogue V1 (17 apps essentielles broker suisse)
-- ============================================================================
-- 4 connexions OAuth/API à gérer côté tenant :
--  - Google Workspace (1 OAuth Google → 7 apps Google débloquées)
--  - Microsoft 365 (1 OAuth Microsoft → 7 apps MS débloquées)
--  - 3CX (clé API)
--  - Bexio (OAuth dédié)
--  - WhatsApp Business (API token + numéro)
-- ============================================================================

INSERT INTO public.external_apps (
  slug, name, category, description_short, description_long,
  logo_url, connection_type, launch_mode, launch_url, embed_allowed,
  oauth_supported, smartflow_compatible, integration_level,
  is_premium, is_beta, is_active, config_schema, sort_order
) VALUES
-- ═════════ GOOGLE WORKSPACE (1 OAuth Google débloque les 7) ═════════
('gmail', 'Gmail', 'communication',
 'Email professionnel Google',
 'Synchronise tes emails Gmail avec LYTA. Voir les emails reçus/envoyés dans la fiche client. Envoyer directement depuis LYTA via ton adresse Gmail.',
 'https://www.google.com/gmail/about/static-2.0/images/logo-gmail.png',
 'oauth', 'new_tab', 'https://mail.google.com', false,
 true, true, 3, false, false, true,
 '{"provider": "google", "scope": "gmail"}'::jsonb, 10),

('google_calendar', 'Google Calendar', 'productivite',
 'Calendrier Google synchronisé',
 'Sync bi-directionnelle avec ton agenda Google. Les RDV créés dans LYTA apparaissent dans Calendar et vice-versa. Vue unifiée des dispo.',
 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg',
 'oauth', 'new_tab', 'https://calendar.google.com', false,
 true, false, 3, false, false, true,
 '{"provider": "google", "scope": "calendar"}'::jsonb, 11),

('google_drive', 'Google Drive', 'storage',
 'Stockage cloud Google',
 'Attache des documents de ton Drive aux fiches client LYTA. Sauvegarde auto des contrats/mandats dans un dossier client dédié.',
 'https://upload.wikimedia.org/wikipedia/commons/d/da/Google_Drive_logo.png',
 'oauth', 'new_tab', 'https://drive.google.com', false,
 true, false, 2, false, false, true,
 '{"provider": "google", "scope": "drive.file"}'::jsonb, 12),

('google_meet', 'Google Meet', 'communication',
 'Visioconférence Google',
 'Crée des liens Meet automatiquement quand tu planifies un RDV client visio dans LYTA.',
 'https://upload.wikimedia.org/wikipedia/commons/9/9b/Google_Meet_icon_%282020%29.svg',
 'oauth', 'new_tab', 'https://meet.google.com', false,
 true, false, 2, false, false, true,
 '{"provider": "google"}'::jsonb, 13),

('google_docs', 'Google Docs', 'productivite',
 'Documents Google',
 'Crée et collabore sur des documents directement depuis LYTA. Modèles partagés cabinet.',
 'https://upload.wikimedia.org/wikipedia/commons/0/01/Google_Docs_logo_%282014-2020%29.svg',
 'oauth', 'new_tab', 'https://docs.google.com', false,
 true, false, 1, false, false, true,
 '{"provider": "google"}'::jsonb, 14),

('google_sheets', 'Google Sheets', 'productivite',
 'Tableurs Google',
 'Exporte tes rapports LYTA directement vers Sheets. Tableaux partagés équipe.',
 'https://upload.wikimedia.org/wikipedia/commons/3/30/Google_Sheets_logo_%282014-2020%29.svg',
 'oauth', 'new_tab', 'https://sheets.google.com', false,
 true, false, 1, false, false, true,
 '{"provider": "google"}'::jsonb, 15),

('google_my_business', 'Google My Business', 'marketing',
 'Visibilité locale & reviews',
 'Pilote ta fiche Google Business depuis LYTA. Réponds aux reviews clients. Boost SEO local pour acquisition organique.',
 'https://www.gstatic.com/images/branding/product/2x/google_my_business_2020q4_48dp.png',
 'oauth', 'new_tab', 'https://business.google.com', false,
 true, false, 2, false, false, true,
 '{"provider": "google", "scope": "business.manage"}'::jsonb, 16),

-- ═════════ MICROSOFT 365 (1 OAuth Microsoft débloque les 7) ═════════
('outlook', 'Outlook', 'communication',
 'Email + Calendrier Microsoft',
 'Sync emails Outlook et agenda. Voir échanges client dans la fiche. Envoyer depuis ton adresse pro Outlook.',
 'https://upload.wikimedia.org/wikipedia/commons/d/df/Microsoft_Office_Outlook_%282018%E2%80%93present%29.svg',
 'oauth', 'new_tab', 'https://outlook.office.com', false,
 true, true, 3, false, false, true,
 '{"provider": "microsoft", "scope": "Mail.ReadWrite Calendars.ReadWrite"}'::jsonb, 20),

('microsoft_teams', 'Microsoft Teams', 'communication',
 'Visio + chat équipe',
 'Crée des liens Teams automatiquement pour les RDV client. Chat interne cabinet. Visios sans switch d''app.',
 'https://upload.wikimedia.org/wikipedia/commons/c/c9/Microsoft_Office_Teams_%282018%E2%80%93present%29.svg',
 'oauth', 'new_tab', 'https://teams.microsoft.com', false,
 true, false, 3, false, false, true,
 '{"provider": "microsoft", "scope": "OnlineMeetings.ReadWrite"}'::jsonb, 21),

('onedrive', 'OneDrive', 'storage',
 'Stockage cloud Microsoft',
 'Attache des documents OneDrive aux fiches client. Backup auto contrats/mandats dans un dossier dédié.',
 'https://upload.wikimedia.org/wikipedia/commons/3/3c/Microsoft_Office_OneDrive_%282019%E2%80%93present%29.svg',
 'oauth', 'new_tab', 'https://onedrive.live.com', false,
 true, false, 2, false, false, true,
 '{"provider": "microsoft", "scope": "Files.ReadWrite"}'::jsonb, 22),

('sharepoint', 'SharePoint', 'storage',
 'Espace de travail collaboratif',
 'Bibliothèques documents partagées entre collaborateurs. Idéal pour grosses cabinets multi-agents.',
 'https://upload.wikimedia.org/wikipedia/commons/e/e1/Microsoft_Office_SharePoint_%282019%E2%80%93present%29.svg',
 'oauth', 'new_tab', 'https://www.office.com/launch/sharepoint', false,
 true, false, 1, false, false, true,
 '{"provider": "microsoft"}'::jsonb, 23),

('word_online', 'Word', 'productivite',
 'Documents Word en ligne',
 'Édition collaborative de docs Word. Modèles partagés cabinet (lettres types, devis).',
 'https://upload.wikimedia.org/wikipedia/commons/f/fd/Microsoft_Office_Word_%282019%E2%80%93present%29.svg',
 'oauth', 'new_tab', 'https://www.office.com/launch/word', false,
 true, false, 1, false, false, true,
 '{"provider": "microsoft"}'::jsonb, 24),

('excel_online', 'Excel', 'productivite',
 'Tableurs Excel en ligne',
 'Exports rapports LYTA → Excel. Tableaux d''analyse partagés équipe.',
 'https://upload.wikimedia.org/wikipedia/commons/3/34/Microsoft_Office_Excel_%282019%E2%80%93present%29.svg',
 'oauth', 'new_tab', 'https://www.office.com/launch/excel', false,
 true, false, 1, false, false, true,
 '{"provider": "microsoft"}'::jsonb, 25),

('powerpoint_online', 'PowerPoint', 'productivite',
 'Présentations PowerPoint',
 'Présentations client (analyse besoins, comparatifs). Modèles cabinet partagés.',
 'https://upload.wikimedia.org/wikipedia/commons/0/0d/Microsoft_Office_PowerPoint_%282019%E2%80%93present%29.svg',
 'oauth', 'new_tab', 'https://www.office.com/launch/powerpoint', false,
 true, false, 1, false, false, true,
 '{"provider": "microsoft"}'::jsonb, 26),

-- ═════════ MÉTIER BROKER SUISSE (API/OAuth dédiés) ═════════
('whatsapp_business', 'WhatsApp Business', 'communication',
 'Messagerie clients suisses',
 '90% des clients suisses utilisent WhatsApp. Reçois et envoie des messages WhatsApp Business depuis la fiche client LYTA. Templates pré-approuvés Meta.',
 'https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg',
 'api_key', 'new_tab', 'https://business.whatsapp.com', false,
 false, true, 3, false, false, true,
 '{"requires": ["phone_number_id", "access_token", "business_account_id"]}'::jsonb, 30),

('3cx', '3CX', 'communication',
 'Téléphonie pro PME suisse',
 'Téléphonie cloud 3CX intégrée à LYTA : clic-to-call depuis la fiche client, journal d''appels auto, enregistrements (compliance courtage).',
 'https://www.3cx.com/wp-content/uploads/2021/02/3cx-icon.svg',
 'api_key', 'new_tab', 'https://www.3cx.com', false,
 false, true, 3, false, false, true,
 '{"requires": ["server_url", "api_key", "extension_id"]}'::jsonb, 31),

('bexio', 'Bexio', 'comptabilite',
 'ERP & compta suisse',
 '⭐ LE ERP suisse n°1 PME. Sync auto clients LYTA ↔ Bexio. Facturation QR-bill. Compta sans double-saisie. Indispensable pour courtage CH.',
 'https://www.bexio.com/dam/jcr:fce5e5fc-95a7-4d04-bbb2-d7c98efba50e/bexio_logo.svg',
 'oauth', 'new_tab', 'https://office.bexio.com', false,
 true, true, 3, false, false, true,
 '{"provider": "bexio", "scope": "contact_show kb_invoice_show kb_offer_show", "country": "CH"}'::jsonb, 32)

ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description_short = EXCLUDED.description_short,
  description_long = EXCLUDED.description_long,
  logo_url = EXCLUDED.logo_url,
  connection_type = EXCLUDED.connection_type,
  launch_mode = EXCLUDED.launch_mode,
  launch_url = EXCLUDED.launch_url,
  oauth_supported = EXCLUDED.oauth_supported,
  smartflow_compatible = EXCLUDED.smartflow_compatible,
  integration_level = EXCLUDED.integration_level,
  config_schema = EXCLUDED.config_schema,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- ============================================================================
-- King notification : seed appliqué
-- ============================================================================
INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
VALUES (
  '🛠️ Catalogue LYTA Tools V1 seedé',
  '17 apps essentielles broker suisse ajoutées au catalogue (Google×7, Microsoft×7, WhatsApp Business, 3CX, Bexio).',
  'system_info', 'low',
  jsonb_build_object('migration', '20260522110000_seed_lyta_tools_catalog_v1', 'apps_count', 17)
);
