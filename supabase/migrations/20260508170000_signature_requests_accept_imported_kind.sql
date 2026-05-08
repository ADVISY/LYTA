-- ============================================================================
-- Bug fix: signature_requests rejected document_kind = 'imported'
-- ============================================================================
--
-- The original migration (20260429120001_signature_requests.sql) defined:
--   document_kind TEXT NOT NULL CHECK (document_kind IN (
--     'mandat_gestion', 'procuration', 'resiliation_lca_45', 'autre'
--   ))
--
-- But ImportDocumentForSignatureDialog.tsx inserts with document_kind='imported'
-- (the custom-PDF-upload flow). Postgres rejected the INSERT with 400, surfaced
-- in the UI as a generic "Erreur" toast.
--
-- The frontend label dictionary in PendingSignaturesPanel already has
-- "imported: 'Document importé'" so the intent is clear; only the CHECK was
-- forgotten when the import-PDF feature was added.
--
-- Fix: extend the CHECK to also accept 'imported'.
-- ============================================================================

ALTER TABLE public.signature_requests
  DROP CONSTRAINT IF EXISTS signature_requests_document_kind_check;

ALTER TABLE public.signature_requests
  ADD CONSTRAINT signature_requests_document_kind_check
  CHECK (document_kind IN (
    'mandat_gestion',
    'procuration',
    'resiliation_lca_45',
    'imported',
    'autre'
  ));
