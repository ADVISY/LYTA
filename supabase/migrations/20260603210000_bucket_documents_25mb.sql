-- ============================================================================
-- Storage : bucket documents passe 10 MB → 25 MB + ajout HEIC
-- ============================================================================
-- Habib signale 'probleme stockage document' sur le flux signature à
-- distance. Inspection : bucket 'documents' a file_size_limit = 10 MB.
-- Or :
--   - Mon validateur front (espace client + signature import) accepte
--     jusqu'à 25 MB
--   - Les PDFs LSA / mandats / contrats peuvent dépasser 10 MB (PDFs avec
--     scans haute résolution)
-- Donc : front accepte → upload Supabase rejette avec 413 "File too large"
--        → le broker voit une erreur générique, le signataire voit "Lien
--        introuvable" (preview_file_key resté NULL côté DB).
--
-- Fix : aligner la limite serveur sur le front (25 MB).
-- Ajout aussi de image/heic (photos iPhone qui n'étaient pas acceptées).
-- ============================================================================

UPDATE storage.buckets
SET
  file_size_limit = 26214400,  -- 25 MB
  allowed_mime_types = ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
WHERE id = 'documents';

-- ============================================================================
-- King notification
-- ============================================================================
INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
VALUES (
  'Storage : bucket documents 10MB → 25MB + HEIC',
  'Le bucket documents acceptait max 10 MB cote serveur alors que le front (espace client + signature import) acceptait 25 MB. Tout PDF entre 10-25 MB etait rejete avec 413 silencieux. Ajout aussi de HEIC/HEIF pour photos iPhone.',
  'system_info', 'high',
  jsonb_build_object(
    'migration', '20260603210000_bucket_documents_25mb',
    'old_limit', '10 MB',
    'new_limit', '25 MB'
  )
);
