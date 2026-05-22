-- ============================================================================
-- LYTA Tools — RESET catalogue + logos cdn.simpleicons.org (ultra-fiable)
-- ============================================================================
-- Les précédentes migrations utilisaient des URLs externes qui ne s'affichent
-- pas (CORS, redirects, formats SVG cassés sur Wikipedia commons, gstatic
-- qui retourne 404 sur certains slugs).
--
-- On bascule sur cdn.simpleicons.org qui sert des SVG aux couleurs de marque
-- ultra-stable (utilisé partout sur internet). Pour 3CX et Bexio (absents de
-- simpleicons), fallback Clearbit Logo API.
-- ============================================================================

-- 1) Reset : on vide le catalogue actuel.
--    Les tenant_app_connections cascadent automatiquement (ON DELETE CASCADE).
DELETE FROM public.external_apps;

-- 2) Re-seed avec 18 apps + logos vérifiés
INSERT INTO public.external_apps (
  slug, name, category, description_short, description_long,
  logo_url, connection_type, launch_mode, launch_url, embed_allowed,
  oauth_supported, smartflow_compatible, integration_level,
  is_premium, is_beta, is_active, config_schema, sort_order
) VALUES
-- ═════════ GOOGLE WORKSPACE ═════════
('gmail', 'Gmail', 'communication',
 'Email professionnel Google',
 'Synchronise tes emails Gmail avec LYTA. Voir les emails reçus/envoyés dans la fiche client. Envoyer directement depuis LYTA via ton adresse Gmail.',
 'https://cdn.simpleicons.org/gmail/EA4335',
 'oauth', 'new_tab', 'https://mail.google.com', false,
 true, true, 3, false, false, true,
 '{"provider": "google", "scope": "gmail"}'::jsonb, 10),

('google_calendar', 'Google Calendar', 'productivite',
 'Calendrier Google synchronisé',
 'Sync bi-directionnelle avec ton agenda Google. Les RDV créés dans LYTA apparaissent dans Calendar et vice-versa. Vue unifiée des dispo.',
 'https://cdn.simpleicons.org/googlecalendar/4285F4',
 'oauth', 'new_tab', 'https://calendar.google.com', false,
 true, false, 3, false, false, true,
 '{"provider": "google", "scope": "calendar"}'::jsonb, 11),

('google_drive', 'Google Drive', 'stockage',
 'Stockage cloud Google',
 'Attache des documents de ton Drive aux fiches client LYTA. Sauvegarde auto des contrats/mandats dans un dossier client dédié.',
 'https://cdn.simpleicons.org/googledrive/4285F4',
 'oauth', 'new_tab', 'https://drive.google.com', false,
 true, false, 2, false, false, true,
 '{"provider": "google", "scope": "drive.file"}'::jsonb, 12),

('google_meet', 'Google Meet', 'communication',
 'Visioconférence Google',
 'Crée des liens Meet automatiquement quand tu planifies un RDV client visio dans LYTA.',
 'https://cdn.simpleicons.org/googlemeet/00897B',
 'oauth', 'new_tab', 'https://meet.google.com', false,
 true, false, 2, false, false, true,
 '{"provider": "google"}'::jsonb, 13),

('google_docs', 'Google Docs', 'productivite',
 'Documents Google',
 'Crée et collabore sur des documents directement depuis LYTA. Modèles partagés cabinet.',
 'https://cdn.simpleicons.org/googledocs/4285F4',
 'oauth', 'new_tab', 'https://docs.google.com', false,
 true, false, 1, false, false, true,
 '{"provider": "google"}'::jsonb, 14),

('google_sheets', 'Google Sheets', 'productivite',
 'Tableurs Google',
 'Exporte tes rapports LYTA directement vers Sheets. Tableaux partagés équipe.',
 'https://cdn.simpleicons.org/googlesheets/34A853',
 'oauth', 'new_tab', 'https://sheets.google.com', false,
 true, false, 1, false, false, true,
 '{"provider": "google"}'::jsonb, 15),

('google_my_business', 'Google Business Profile', 'marketing',
 'Visibilité locale & reviews',
 'Pilote ta fiche Google Business depuis LYTA. Réponds aux reviews clients. Boost SEO local pour acquisition organique.',
 'https://cdn.simpleicons.org/google/4285F4',
 'oauth', 'new_tab', 'https://business.google.com', false,
 true, false, 2, false, false, true,
 '{"provider": "google", "scope": "business.manage"}'::jsonb, 16),

-- ═════════ MICROSOFT 365 ═════════
('outlook', 'Outlook', 'communication',
 'Email + Calendrier Microsoft',
 'Sync emails Outlook et agenda. Voir échanges client dans la fiche. Envoyer depuis ton adresse pro Outlook.',
 'https://cdn.simpleicons.org/microsoftoutlook/0078D4',
 'oauth', 'new_tab', 'https://outlook.office.com', false,
 true, true, 3, false, false, true,
 '{"provider": "microsoft", "scope": "Mail.ReadWrite Calendars.ReadWrite"}'::jsonb, 20),

('microsoft_teams', 'Microsoft Teams', 'communication',
 'Visio + chat équipe',
 'Crée des liens Teams automatiquement pour les RDV client. Chat interne cabinet. Visios sans switch d''app.',
 'https://cdn.simpleicons.org/microsoftteams/6264A7',
 'oauth', 'new_tab', 'https://teams.microsoft.com', false,
 true, false, 3, false, false, true,
 '{"provider": "microsoft", "scope": "OnlineMeetings.ReadWrite"}'::jsonb, 21),

('onedrive', 'OneDrive', 'stockage',
 'Stockage cloud Microsoft',
 'Attache des documents OneDrive aux fiches client. Backup auto contrats/mandats dans un dossier dédié.',
 'https://cdn.simpleicons.org/microsoftonedrive/0078D4',
 'oauth', 'new_tab', 'https://onedrive.live.com', false,
 true, false, 2, false, false, true,
 '{"provider": "microsoft", "scope": "Files.ReadWrite"}'::jsonb, 22),

('sharepoint', 'SharePoint', 'stockage',
 'Espace de travail collaboratif',
 'Bibliothèques documents partagées entre collaborateurs. Idéal pour grosses cabinets multi-agents.',
 'https://cdn.simpleicons.org/microsoftsharepoint/038387',
 'oauth', 'new_tab', 'https://www.office.com/launch/sharepoint', false,
 true, false, 1, false, false, true,
 '{"provider": "microsoft"}'::jsonb, 23),

('word_online', 'Word', 'productivite',
 'Documents Word en ligne',
 'Édition collaborative de docs Word. Modèles partagés cabinet (lettres types, devis).',
 'https://cdn.simpleicons.org/microsoftword/2B579A',
 'oauth', 'new_tab', 'https://www.office.com/launch/word', false,
 true, false, 1, false, false, true,
 '{"provider": "microsoft"}'::jsonb, 24),

('excel_online', 'Excel', 'productivite',
 'Tableurs Excel en ligne',
 'Exports rapports LYTA → Excel. Tableaux d''analyse partagés équipe.',
 'https://cdn.simpleicons.org/microsoftexcel/217346',
 'oauth', 'new_tab', 'https://www.office.com/launch/excel', false,
 true, false, 1, false, false, true,
 '{"provider": "microsoft"}'::jsonb, 25),

('powerpoint_online', 'PowerPoint', 'productivite',
 'Présentations PowerPoint',
 'Présentations client (analyse besoins, comparatifs). Modèles cabinet partagés.',
 'https://cdn.simpleicons.org/microsoftpowerpoint/B7472A',
 'oauth', 'new_tab', 'https://www.office.com/launch/powerpoint', false,
 true, false, 1, false, false, true,
 '{"provider": "microsoft"}'::jsonb, 26),

-- ═════════ MÉTIER BROKER SUISSE ═════════
('whatsapp_business', 'WhatsApp Business', 'communication',
 'Messagerie clients suisses',
 '90% des clients suisses utilisent WhatsApp. Reçois et envoie des messages WhatsApp Business depuis la fiche client LYTA. Templates pré-approuvés Meta.',
 'https://cdn.simpleicons.org/whatsapp/25D366',
 'api_key', 'new_tab', 'https://business.whatsapp.com', false,
 false, true, 3, false, false, true,
 '{"requires": ["phone_number_id", "access_token", "business_account_id"]}'::jsonb, 30),

('3cx', '3CX', 'communication',
 'Téléphonie pro PME suisse',
 'Téléphonie cloud 3CX intégrée à LYTA : clic-to-call depuis la fiche client, journal d''appels auto, enregistrements (compliance courtage).',
 'https://logo.clearbit.com/3cx.com',
 'api_key', 'new_tab', 'https://www.3cx.com', false,
 false, true, 3, false, false, true,
 '{"requires": ["server_url", "api_key", "extension_id"]}'::jsonb, 31),

('bexio', 'Bexio', 'comptabilite',
 'ERP & compta suisse',
 'LE ERP suisse n°1 PME. Sync auto clients LYTA ↔ Bexio. Facturation QR-bill. Compta sans double-saisie. Indispensable pour courtage CH.',
 'https://logo.clearbit.com/bexio.com',
 'oauth', 'new_tab', 'https://office.bexio.com', false,
 true, true, 3, false, false, true,
 '{"provider": "bexio", "scope": "contact_show kb_invoice_show kb_offer_show", "country": "CH"}'::jsonb, 32),

('zoom', 'Zoom', 'communication',
 'Visioconférence pro',
 'Visioconférence Zoom intégrée à LYTA. Crée des réunions Zoom directement depuis la fiche client, lien d''invitation auto dans les emails. Idéal pour RDV à distance.',
 'https://cdn.simpleicons.org/zoom/2D8CFF',
 'oauth', 'new_tab', 'https://zoom.us', false,
 true, false, 3, false, false, true,
 '{"provider": "zoom", "scope": "meeting:write meeting:read user:read"}'::jsonb, 34);

-- 3) Catégorie "comptabilite" : on s'assure que le label existe côté front
--    (le front a déjà categoryLabels pour communication/stockage/productivite/
--     marketing — comptabilite est mappé dans CRMLytaTools.tsx)

-- 4) King notification
INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
VALUES (
  'Catalogue LYTA Tools — RESET V2',
  '18 apps re-seedées avec logos cdn.simpleicons.org (ultra-fiable). Anciennes connexions tenant purgées.',
  'system_info', 'low',
  jsonb_build_object(
    'migration', '20260522130000_lyta_tools_reset_catalog_v2',
    'apps_count', 18,
    'logo_source', 'cdn.simpleicons.org + clearbit'
  )
);
