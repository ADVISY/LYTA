-- ============================================================================
-- document_scans: store the structured AI extraction output
-- ============================================================================
-- The IA OCR has been producing rich structured output for a while
-- (documents_detected, new_products_detected, family_members_detected,
-- dossier_summary, primary_holder…) — but the columns to PERSIST it never
-- existed on document_scans. The Edge function was therefore dropping the
-- product list silently on every scan.
--
-- This explains the report: "le scan a créé la fiche client mais aucun
-- contrat, alors qu'il y a bien un contrat SWICA dans les documents".
--
-- We add the missing columns now. The Edge function update in this same
-- commit will start saving them. Existing scans stay valid (columns are
-- nullable / default to []).
-- ============================================================================

ALTER TABLE public.document_scans
  ADD COLUMN IF NOT EXISTS dossier_summary TEXT,
  ADD COLUMN IF NOT EXISTS documents_detected JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS new_products_detected JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS old_products_detected JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS family_members_detected JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS primary_holder JSONB,
  ADD COLUMN IF NOT EXISTS has_multiple_products BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_family_members BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_old_policy BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_new_policy BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_termination BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS engagement_analysis JSONB,
  ADD COLUMN IF NOT EXISTS workflow_actions JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.document_scans.new_products_detected IS
  'Array of products detected by the IA in the new/proposal documents. Materialised into policies by the Smartflow wizard.';

COMMENT ON COLUMN public.document_scans.old_products_detected IS
  'Array of products detected in the existing/legacy policies (for archive in Documents).';

COMMENT ON COLUMN public.document_scans.documents_detected IS
  'Per-file classification result from the IA OCR (doc_type, confidence, is_signed, etc.).';
