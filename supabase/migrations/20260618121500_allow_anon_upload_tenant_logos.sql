-- ============================================================================
-- Quick fix : autoriser anon à uploader sur tenant-logos pendant le signup
-- ============================================================================
-- Bug observé en prod le 18 juin 2026 :
-- Le formulaire Lovable `lyta.ch/access` (post-paiement Stripe) uploade le
-- logo du nouveau cabinet directement via `supabase.storage.from(...).upload()`
-- côté front, avec un client ANONYME (le user vient de payer mais n'a pas
-- encore de compte créé). La policy INSERT actuelle exige `TO authenticated`
-- → 400 RLS → tenant créé sans logo (Klary affecté).
--
-- Le design idéal serait que Lovable envoie le logo en base64 dans le body
-- de l'edge fn `provision-self-signup-tenant` qui upload via service_role.
-- Mais ça demande un refactor Lovable. Ce fix est temporaire en attendant.
--
-- Stratégie sécurité :
--   - Anon peut INSERT sur `tenant-logos` (bucket public en lecture, déjà
--     dropé la policy SELECT le 12 juin pour anti-énumération)
--   - Pas de PII dans ce bucket (logos cabinets uniquement, info publique)
--   - Limite size 2 Mo gérée côté front + bucket
--   - Risque : abus quota par spam upload. À monitorer via Storage usage.
--     Si abus → durcir + ajout edge fn dédiée `upload-signup-logo`.
--
-- À RETIRER quand Lovable upload via edge fn base64. Ticket à créer.
-- ============================================================================

-- ─── INSERT : anon autorisé temporairement pour signup ────────────
CREATE POLICY "Anon can upload to tenant-logos (signup)"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (bucket_id = 'tenant-logos');

-- ─── Notification KING : trace du fix temporaire ──────────────────
INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
VALUES (
  '🩹 Fix temporaire — anon upload tenant-logos autorisé',
  'Quick fix appliqué le 18 juin 2026 pour débloquer le flow signup self-service (formulaire Lovable lyta.ch/access uploade le logo en mode anon → 400 RLS bloquait). Policy INSERT anon ajoutée sur le bucket. À RETIRER quand Lovable sera refactorisé pour upload via edge fn base64.',
  'system_info',
  'normal',
  jsonb_build_object(
    'migration', '20260618121500_allow_anon_upload_tenant_logos',
    'ticket_to_create', 'Refactor Lovable lyta.ch/access pour upload logo via edge fn base64',
    'mitigation', 'Bucket public sans PII, limite 2MB front + bucket, monitoring Storage usage'
  )
);
