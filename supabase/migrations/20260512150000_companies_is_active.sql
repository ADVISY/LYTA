-- ============================================================================
-- insurance_companies.is_active flag — hide legacy placeholder companies
-- ============================================================================
-- Two companies ("Dépôt générique" and "Helvetia Validation") were created
-- historically as placeholders/duplicates. They can't be DELETEd because
-- existing policies still reference their products (policies.product_id is
-- NOT NULL). Renaming them globally would still leak into every tenant's
-- selector.
--
-- Adding an `is_active` boolean is the clean way:
--   - is_active = false → hidden from every UI selector (frontend filter)
--   - existing policies that reference them keep working (FK intact)
--   - reversible at any time
--   - no per-tenant noise: applies globally so neither Advisy nor any
--     future tenant sees them in their lists
-- ============================================================================

ALTER TABLE public.insurance_companies
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_insurance_companies_is_active
  ON public.insurance_companies(is_active) WHERE is_active = true;

-- Disable the 2 legacy placeholders
UPDATE public.insurance_companies
SET is_active = false
WHERE name IN ('Dépôt générique', 'Helvetia Validation');

COMMENT ON COLUMN public.insurance_companies.is_active IS
  'When false, the company is hidden from frontend selectors. Existing references in policies/products keep working. Reversible.';
