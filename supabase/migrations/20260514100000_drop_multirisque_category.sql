-- ============================================================================
-- Drop the legacy 'multirisque' category — replaced by the branches taxonomy
-- ============================================================================
-- 'multirisque' was a generic catch-all in the legacy insurance_products.
-- category enum from before we introduced tenant_branches. Now every product
-- carries a precise tenant_branch_id (AUTO / MENAGE_RC / JURIDIQUE / VOYAGE
-- / ENTREPRISE / …), so 'multirisque' is redundant and misleading in the UI.
--
-- Steps:
--   1. Reclassify every existing row according to its branch (or to 'other'
--      if no branch is set).
--   2. Replace the CHECK constraint to forbid 'multirisque' going forward.
-- ============================================================================

-- 1. Backfill existing rows
UPDATE public.insurance_products AS p
SET category = CASE COALESCE(b.code, '')
  WHEN 'AUTO'         THEN 'auto'
  WHEN 'MENAGE_RC'    THEN 'home'
  WHEN 'JURIDIQUE'    THEN 'legal'
  WHEN 'VOYAGE'       THEN 'home'
  WHEN 'ENTREPRISE'   THEN 'rcpro'
  WHEN 'HYPO_CREDIT'  THEN 'life'
  WHEN 'VIE'          THEN 'life'
  WHEN 'LPP'          THEN 'life'
  WHEN 'LAMAL'        THEN 'health'
  WHEN 'LCA'          THEN 'health'
  WHEN 'PGM'          THEN 'health'
  WHEN 'ACCIDENT'     THEN 'health'
  ELSE 'home'  -- safe default for unbranded multirisque rows
END
FROM public.tenant_branches AS b
WHERE p.tenant_branch_id = b.id
  AND p.category = 'multirisque';

-- Unbranded multirisque rows → fallback to 'home' (the closest match in the
-- legacy enum; they appear in the 'Ménage & RC' section).
UPDATE public.insurance_products
SET category = 'home'
WHERE category = 'multirisque' AND tenant_branch_id IS NULL;

-- 2. Refresh the CHECK constraint (drop and recreate without 'multirisque')
ALTER TABLE public.insurance_products DROP CONSTRAINT IF EXISTS insurance_products_category_check;
ALTER TABLE public.insurance_products
  ADD CONSTRAINT insurance_products_category_check
  CHECK (category IN ('auto','home','health','life','rcpro','legal','third_pillar'));

COMMENT ON COLUMN public.insurance_products.category IS
  'Legacy category enum. Source of truth for categorisation is now tenant_branch_id. Kept for backward compat and for unbranded rows.';
