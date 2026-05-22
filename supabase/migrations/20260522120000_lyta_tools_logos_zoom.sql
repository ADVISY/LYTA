-- ============================================================================
-- LYTA Tools — Ajout Zoom + Logos fiables pour toutes les apps V1
-- ============================================================================
-- Front-end visuel propre : on remplace tous les logos par des sources
-- stables (Clearbit Logo API pour les brands, gstatic pour Google,
-- Wikipedia commons pour Microsoft — toutes URLs accessibles publiquement
-- et qui ne change pas).
-- ============================================================================

-- Ajout Zoom (nouveau)
INSERT INTO public.external_apps (
  slug, name, category, description_short, description_long,
  logo_url, connection_type, launch_mode, launch_url,
  oauth_supported, integration_level, config_schema, sort_order, is_active
) VALUES (
  'zoom', 'Zoom', 'communication',
  'Visioconférence pro',
  'Visioconférence Zoom intégrée à LYTA. Crée des réunions Zoom directement depuis la fiche client, lien d''invitation auto dans les emails. Idéal pour RDV à distance avec clients sans Microsoft/Google.',
  'https://logo.clearbit.com/zoom.us',
  'oauth', 'new_tab', 'https://zoom.us',
  true, 3,
  '{"provider": "zoom", "scope": "meeting:write meeting:read user:read"}'::jsonb,
  34, true
)
ON CONFLICT (slug) DO UPDATE SET
  logo_url = EXCLUDED.logo_url,
  description_short = EXCLUDED.description_short,
  description_long = EXCLUDED.description_long,
  oauth_supported = EXCLUDED.oauth_supported,
  config_schema = EXCLUDED.config_schema,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- ============================================================================
-- Mise à jour des logos pour toutes les apps existantes (URLs stables)
-- ============================================================================

-- Google services (gstatic.com — hébergé par Google, ne change pas)
UPDATE public.external_apps SET logo_url = 'https://ssl.gstatic.com/images/branding/product/2x/gmail_2020q4_48dp.png' WHERE slug = 'gmail';
UPDATE public.external_apps SET logo_url = 'https://ssl.gstatic.com/images/branding/product/2x/calendar_2020q4_48dp.png' WHERE slug = 'google_calendar';
UPDATE public.external_apps SET logo_url = 'https://ssl.gstatic.com/images/branding/product/2x/drive_2020q4_48dp.png' WHERE slug = 'google_drive';
UPDATE public.external_apps SET logo_url = 'https://ssl.gstatic.com/images/branding/product/2x/meet_2020q4_48dp.png' WHERE slug = 'google_meet';
UPDATE public.external_apps SET logo_url = 'https://ssl.gstatic.com/images/branding/product/2x/docs_2020q4_48dp.png' WHERE slug = 'google_docs';
UPDATE public.external_apps SET logo_url = 'https://ssl.gstatic.com/images/branding/product/2x/sheets_2020q4_48dp.png' WHERE slug = 'google_sheets';
UPDATE public.external_apps SET logo_url = 'https://ssl.gstatic.com/images/branding/product/2x/my_business_2020q4_48dp.png' WHERE slug = 'google_my_business';

-- Microsoft 365 (Wikipedia commons SVG — stable)
UPDATE public.external_apps SET logo_url = 'https://upload.wikimedia.org/wikipedia/commons/d/df/Microsoft_Office_Outlook_%282018%E2%80%93present%29.svg' WHERE slug = 'outlook';
UPDATE public.external_apps SET logo_url = 'https://upload.wikimedia.org/wikipedia/commons/c/c9/Microsoft_Office_Teams_%282018%E2%80%93present%29.svg' WHERE slug = 'microsoft_teams';
UPDATE public.external_apps SET logo_url = 'https://upload.wikimedia.org/wikipedia/commons/3/3c/Microsoft_Office_OneDrive_%282019%E2%80%93present%29.svg' WHERE slug = 'onedrive';
UPDATE public.external_apps SET logo_url = 'https://upload.wikimedia.org/wikipedia/commons/e/e1/Microsoft_Office_SharePoint_%282019%E2%80%93present%29.svg' WHERE slug = 'sharepoint';
UPDATE public.external_apps SET logo_url = 'https://upload.wikimedia.org/wikipedia/commons/f/fd/Microsoft_Office_Word_%282019%E2%80%93present%29.svg' WHERE slug = 'word_online';
UPDATE public.external_apps SET logo_url = 'https://upload.wikimedia.org/wikipedia/commons/3/34/Microsoft_Office_Excel_%282019%E2%80%93present%29.svg' WHERE slug = 'excel_online';
UPDATE public.external_apps SET logo_url = 'https://upload.wikimedia.org/wikipedia/commons/0/0d/Microsoft_Office_PowerPoint_%282019%E2%80%93present%29.svg' WHERE slug = 'powerpoint_online';

-- Brands (Clearbit Logo API — gratuit, public, ne change pas)
UPDATE public.external_apps SET logo_url = 'https://logo.clearbit.com/whatsapp.com' WHERE slug = 'whatsapp_business';
UPDATE public.external_apps SET logo_url = 'https://logo.clearbit.com/3cx.com' WHERE slug = '3cx';
UPDATE public.external_apps SET logo_url = 'https://logo.clearbit.com/bexio.com' WHERE slug = 'bexio';

-- Touch updated_at pour bust cache front (si React Query keyé sur updated_at)
UPDATE public.external_apps SET updated_at = NOW() WHERE is_active = true;
