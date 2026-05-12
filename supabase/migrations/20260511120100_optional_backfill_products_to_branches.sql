-- ============================================================================
-- OPTIONAL helper: bulk-reclassify existing products into the new branches
-- ============================================================================
-- This migration only CREATES a helper function — it does NOT run it.
-- It is safe to apply: nothing changes until you explicitly call
--   SELECT public.backfill_products_to_branches('<your-tenant-id>'::uuid);
--
-- You can also call it for ALL tenants in one go:
--   SELECT public.backfill_products_to_branches(NULL);
--
-- The function maps legacy main_category + subcategory + product name to the
-- new tenant_branches taxonomy, with smart LAMal detection (BASIS / FAVORIT /
-- MEDPHARM / HMO / TELMED / etc.).
--
-- Returns the number of products updated.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.backfill_products_to_branches(p_tenant_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  WITH mapped AS (
    UPDATE public.insurance_products AS p
    SET tenant_branch_id = b.id
    FROM public.tenant_branches AS b
    WHERE p.tenant_id IS NOT NULL
      AND p.tenant_branch_id IS NULL
      AND b.tenant_id = p.tenant_id
      AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
      AND b.code = CASE
        WHEN LOWER(COALESCE(p.subcategory, '')) IN ('lamal') THEN 'LAMAL'
        WHEN LOWER(p.name) ~ '(lamal|kvg|favorit|medpharm|telmed|casamed|premed|qualimed|^basis|^base|hmo)' THEN 'LAMAL'
        WHEN p.main_category = 'LCA' THEN 'LCA'
        WHEN p.main_category = 'VIE' THEN 'VIE'
        WHEN p.main_category = 'HYPO' THEN 'HYPO_CREDIT'
        WHEN p.main_category = 'NON_VIE' THEN
          CASE
            WHEN LOWER(COALESCE(p.subcategory, '')) LIKE '%auto%'
              OR LOWER(COALESCE(p.subcategory, '')) LIKE '%casco%'
              OR LOWER(p.name) ~ '(auto|casco|moto|bateau|camping)' THEN 'AUTO'
            WHEN LOWER(COALESCE(p.subcategory, '')) LIKE '%menage%'
              OR LOWER(COALESCE(p.subcategory, '')) LIKE '%rc_priv%'
              OR LOWER(p.name) ~ '(ménage|menage|rc priv|inventaire)' THEN 'MENAGE_RC'
            WHEN LOWER(COALESCE(p.subcategory, '')) LIKE '%juridique%'
              OR LOWER(COALESCE(p.subcategory, '')) LIKE '%legal%'
              OR LOWER(p.name) ~ '(juridique|protek|orion|legal)' THEN 'JURIDIQUE'
            WHEN LOWER(COALESCE(p.subcategory, '')) LIKE '%voyage%'
              OR LOWER(p.name) ~ '(voyage|annulation|assistance|travel)' THEN 'VOYAGE'
            ELSE 'MENAGE_RC'
          END
        ELSE 'MENAGE_RC'
      END
    RETURNING p.id
  )
  SELECT COUNT(*) INTO v_updated FROM mapped;

  RETURN COALESCE(v_updated, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_products_to_branches(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_products_to_branches(UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.backfill_products_to_branches(UUID) IS
  'Optional helper: bulk-assign tenant_branch_id to existing products. Pass NULL for all tenants, or a specific tenant_id. Returns count of updated rows. Idempotent — only touches rows where tenant_branch_id IS NULL.';
