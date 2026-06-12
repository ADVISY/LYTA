-- ============================================================================
-- Supabase Advisor — Security lints phase 1
-- ============================================================================
-- Traite 15 warnings de Supabase Security Advisor (rapport 12 juin 2026) :
--
--   13 × Function Search Path Mutable
--    1 × RLS Policy Always True (document_scan_audit INSERT)
--    1 × Public Bucket Allows Listing (tenant-logos)
--
-- Non traités dans cette migration (décisions ou hors scope) :
--   264 × Public/Signed-In Users Can Execute SECURITY DEFINER Function
--         → audit séparé requis (beaucoup sont volontaires : RLS helpers)
--    1 × Leaked Password Protection Disabled
--         → à activer dans Supabase Dashboard → Auth → Configuration
--    1 × Extension in Public (pg_trgm)
--         → cosmétique, à déplacer en migration séparée si on veut
--    1 × Auth OTP long expiry (86400s)
--         → VOLONTAIRE (magic links 24h pour invitations collab/clients,
--           cf. commentaire dans supabase/config.toml)
--
-- ⚠️ AUCUNE LIGNE DE DONNÉES TOUCHÉE.
-- Cette migration ne modifie QUE :
--   - Des propriétés de fonctions (search_path setting)
--   - Une policy RLS de la table d'audit
--   - Une policy de bucket Storage
-- ============================================================================


-- ─── 1. Function Search Path Mutable (13 fonctions) ──────────────
-- Patch : SET search_path = public, pg_catalog
-- Empêche un attaquant de créer une table dans son schema qui shadow
-- une table public utilisée par la fonction (cf. CVE typique Postgres
-- "trojan horse via search_path mutation").
-- Aucun changement de logique métier — uniquement la propriété
-- search_path est figée.

ALTER FUNCTION public.get_affiliate_stats()                       SET search_path = public, pg_catalog;
ALTER FUNCTION public.touch_pending_signups()                     SET search_path = public, pg_catalog;
ALTER FUNCTION public.tg_clients_auto_canton()                    SET search_path = public, pg_catalog;
ALTER FUNCTION public.check_ip_in_whitelist(TEXT)                 SET search_path = public, pg_catalog;
ALTER FUNCTION public.touch_tenant_branches_updated_at()          SET search_path = public, pg_catalog;
ALTER FUNCTION public.touch_commission_statements()               SET search_path = public, pg_catalog;
ALTER FUNCTION public.normalize_company_name(TEXT)                SET search_path = public, pg_catalog;
ALTER FUNCTION public.normalize_product_name(TEXT)                SET search_path = public, pg_catalog;
ALTER FUNCTION public.touch_commission_statement_lines()          SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_platform_setting(TEXT)                  SET search_path = public, pg_catalog;
ALTER FUNCTION public.touch_signature_requests_updated_at()       SET search_path = public, pg_catalog;
ALTER FUNCTION public.recompute_commission_statement_totals()     SET search_path = public, pg_catalog;
ALTER FUNCTION public.touch_tpco()                                SET search_path = public, pg_catalog;


-- ─── 2. RLS Policy Always True — document_scan_audit ─────────────
-- La policy "System can insert audit logs" était définie avec
--   FOR INSERT WITH CHECK (true)
-- → tout user authentifié pouvait polluer la table d'audit (insérer
-- de faux logs).
--
-- Fix : on drop cette policy. Les edge functions qui logguent les
-- audits utilisent le service_role qui bypass RLS automatiquement.
-- Les users authenticated/anon ne pourront plus INSERT directement,
-- ce qui est exactement le but d'une table d'audit (immuable depuis
-- l'UI utilisateur).
DROP POLICY IF EXISTS "System can insert audit logs" ON public.document_scan_audit;

-- Documentation pour les futurs devs
COMMENT ON TABLE public.document_scan_audit IS
  'Table d''audit (immuable depuis l''UI). INSERTs uniquement via edge functions service_role (qui bypass RLS). Pas de policy permissive pour éviter pollution.';


-- ─── 3. Public Bucket Allows Listing — tenant-logos ──────────────
-- La policy "Anyone can view tenant logos" était `USING (bucket_id =
-- 'tenant-logos')` sans restriction. Sur un bucket public, ça permet
-- l'ÉNUMÉRATION : un attaquant peut lister tous les fichiers du bucket
-- via `storage.from('tenant-logos').list()` et récupérer tous les
-- slugs/UUIDs tenants.
--
-- Fix : drop cette policy. Le bucket reste public (bucket.public=true)
-- donc les URLs directes type
--   https://<project>.supabase.co/storage/v1/object/public/tenant-logos/<key>
-- continuent de marcher pour afficher les logos sur les sous-domaines
-- tenants. Mais le LISTING via API est bloqué.
--
-- Les autres policies (Kings can upload, Kings can update, Kings can
-- delete) ne sont pas touchées — elles restent fonctionnelles.
DROP POLICY IF EXISTS "Anyone can view tenant logos" ON storage.objects;


-- ─── Notification KING ───────────────────────────────────────────
-- Trace dans les notifications pour qu'Habib voie qu'on a fixé ça
INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
VALUES (
  '🔐 Advisor security lints — phase 1 corrigée',
  'Patch de 15 warnings Supabase Advisor : 13 search_path figés sur fonctions vulnérables (trojan horse Postgres), 1 RLS policy permissive supprimée sur document_scan_audit (anti-pollution audit), 1 bucket tenant-logos lock down listing (anti-énumération).',
  'system_info',
  'normal',
  jsonb_build_object(
    'lint_fixed_count', 15,
    'lint_remaining', jsonb_build_object(
      'security_definer_functions', 264,
      'leaked_password_protection', 1,
      'extension_in_public', 1,
      'auth_otp_expiry', 1
    )
  )
);
