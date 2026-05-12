-- ============================================================================
-- REVERT: scan-created products are pending again (broker validates manually)
-- ============================================================================
-- Habib's clarification (12 mai): the broker wants the IA to signal
-- "product not found" instead of auto-creating active products in the
-- catalog. The catalog should stay curated — only products explicitly
-- added by the broker (Partenaires UI) or seeded officially.
--
-- This migration restores the previous behaviour: candidates land as
-- pending / is_active=false / tenant_id NULL, so they are HIDDEN from
-- the Partenaires UI. The scan still gets a valid product_id back so
-- it can attach the candidate to the policy if the broker validates,
-- but the candidate doesn't pollute the Partners catalog.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_candidate_product(
  p_detected_name TEXT,
  p_company_name TEXT DEFAULT NULL,
  p_main_category TEXT DEFAULT 'NON_VIE',
  p_subcategory TEXT DEFAULT NULL,
  p_scan_id UUID DEFAULT NULL,
  p_tenant_id UUID DEFAULT NULL,
  p_tenant_branch_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id UUID;
  v_company_id UUID;
  v_clean_name TEXT;
  v_match_status TEXT;
BEGIN
  v_clean_name := trim(p_detected_name);
  IF v_clean_name IS NULL OR length(v_clean_name) = 0 THEN
    RAISE EXCEPTION 'create_candidate_product: detected_name is required';
  END IF;

  v_company_id := find_or_create_company_normalized(p_company_name);

  SELECT product_id, status INTO v_product_id, v_match_status
  FROM find_product_for_company(v_company_id, v_clean_name)
  LIMIT 1;

  IF v_product_id IS NOT NULL THEN
    UPDATE insurance_products
    SET seen_count = seen_count + 1
    WHERE id = v_product_id;

    INSERT INTO product_aliases (product_id, alias, language)
    SELECT v_product_id, v_clean_name, 'fr'
    WHERE NOT EXISTS (
      SELECT 1 FROM product_aliases pa
      WHERE pa.product_id = v_product_id
        AND normalize_product_name(pa.alias) = normalize_product_name(v_clean_name)
    );

    RETURN v_product_id;
  END IF;

  -- No match → pending candidate (HIDDEN from Partenaires UI)
  -- The broker is invited to create the product manually before validating.
  INSERT INTO insurance_products (
    name,
    detected_name,
    company_id,
    category,
    main_category,
    subcategory,
    status,
    source,
    source_scan_id,
    is_active,
    seen_count,
    tenant_id,
    tenant_branch_id
  ) VALUES (
    v_clean_name,
    v_clean_name,
    v_company_id,
    CASE upper(COALESCE(p_main_category, 'NON_VIE'))
      WHEN 'VIE' THEN 'life'
      WHEN 'NON_VIE' THEN 'multirisque'
      ELSE 'multirisque'
    END,
    COALESCE(p_main_category, 'NON_VIE')::product_main_category,
    p_subcategory,
    'pending',     -- not visible in Partenaires until the broker promotes it
    'ia',
    p_scan_id,
    false,
    1,
    p_tenant_id,
    p_tenant_branch_id
  )
  RETURNING id INTO v_product_id;

  INSERT INTO product_aliases (product_id, alias, language)
  VALUES (v_product_id, v_clean_name, 'fr')
  ON CONFLICT DO NOTHING;

  RETURN v_product_id;
END;
$$;

COMMENT ON FUNCTION public.create_candidate_product(TEXT, TEXT, TEXT, TEXT, UUID, UUID, UUID) IS
  'Resolves an existing product or creates a pending candidate when no match. Pending candidates are HIDDEN from Partenaires (status=pending, is_active=false). The broker is expected to add unknown products manually before validating the scan.';
