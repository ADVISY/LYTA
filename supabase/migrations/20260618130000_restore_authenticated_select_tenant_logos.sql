-- ============================================================================
-- Fix : restaurer SELECT authenticated sur tenant-logos (pour upsert)
-- ============================================================================
-- Bug observé 18 juin 2026 :
-- Upload depuis Espace KING (TenantLogoUpload) échoue en 400. Cause :
--
-- 1. Le 12 juin (fix V15 anti-énumération bucket tenant-logos publique),
--    j'ai droppé la policy "Anyone can view tenant logos" qui était :
--      FOR SELECT USING (bucket_id = 'tenant-logos')
--    → Plus AUCUNE policy SELECT sur tenant-logos.
--
-- 2. Le composant TenantLogoUpload fait
--      supabase.storage.from('tenant-logos').upload(path, file, { upsert: true })
--    Avec upsert=true, Supabase Storage doit SELECT d'abord pour vérifier
--    si le fichier existe (afin de choisir UPDATE ou INSERT).
--    → SELECT bloqué par RLS → 400 sur l'upload.
--
-- Fix : restaurer SELECT pour `authenticated` uniquement (pas `anon`).
-- Sécurité : on conserve l'anti-énumération côté public (anon ne peut
-- toujours pas list() ce bucket). Les courtiers connectés peuvent à
-- nouveau voir/upsert leur logo.
--
-- Le bucket reste `public: true` au niveau métadonnée, donc les URLs
-- publiques /storage/v1/object/public/tenant-logos/... continuent de
-- marcher pour afficher les logos sans auth.
-- ============================================================================

CREATE POLICY "Authenticated can view tenant logos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'tenant-logos');

-- Notification KING
INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
VALUES (
  '🔧 Fix tenant-logos — SELECT restauré pour upsert',
  'Bug observé : upload logo depuis Espace KING échouait en 400. Cause : la fix V15 du 12 juin (anti-énumération) avait droppé la SEULE policy SELECT sur tenant-logos. Le upsert=true du composant TenantLogoUpload nécessite SELECT pour fonctionner. Policy SELECT restaurée pour authenticated uniquement (anon reste bloqué = anti-énumération préservée).',
  'system_info',
  'normal',
  jsonb_build_object(
    'migration', '20260618130000_restore_authenticated_select_tenant_logos',
    'regression_caused_by', '20260612200000_advisor_security_lints_phase1',
    'scope', 'storage.objects bucket tenant-logos SELECT for authenticated'
  )
);
