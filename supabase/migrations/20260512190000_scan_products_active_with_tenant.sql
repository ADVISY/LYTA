-- ============================================================================
-- Auto-create scanned products as ACTIVE in the tenant's catalog
-- ============================================================================
-- Until now, when the IA scan detected a product not in the catalog, it
-- inserted a 'pending' candidate (is_active=false, no tenant_id, no
-- tenant_branch_id). Result: the broker never saw those products in
-- Partenaires → Produits and couldn't reuse them for future contracts.
--
-- Habib confirmed (12 mai) the desired behaviour: every scanned product
-- should land in the tenant's product catalog immediately, with the
-- right branch + tenant assignment.
-- ============================================================================

-- Add a new overload of create_candidate_product that accepts tenant_id and
-- tenant_branch_id, and inserts the product as ACTIVE (broker-visible)
-- instead of as a pending candidate.
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

  -- Step 1: resolve company atomically
  v_company_id := find_or_create_company_normalized(p_company_name);

  -- Step 2: existing match? Reuse + bump seen_count
  SELECT product_id, status INTO v_product_id, v_match_status
  FROM find_product_for_company(v_company_id, v_clean_name)
  LIMIT 1;

  IF v_product_id IS NOT NULL THEN
    UPDATE insurance_products
    SET seen_count = seen_count + 1,
        -- if this product had no tenant yet (legacy global), claim it for the scanning tenant
        tenant_id = COALESCE(tenant_id, p_tenant_id),
        tenant_branch_id = COALESCE(tenant_branch_id, p_tenant_branch_id)
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

  -- Step 3: no match — insert as ACTIVE in the tenant's catalog
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
    'active',     -- visible in Partenaires immediately
    'ia',
    p_scan_id,
    true,
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

-- Drop the legacy 5-arg signature (replaced by the 7-arg overload above).
DROP FUNCTION IF EXISTS public.create_candidate_product(TEXT, TEXT, TEXT, TEXT, UUID);

COMMENT ON FUNCTION public.create_candidate_product(TEXT, TEXT, TEXT, TEXT, UUID, UUID, UUID) IS
  'Resolves or creates an insurance_products row for a scanned product. New rows are inserted ACTIVE (visible in tenant Partenaires) when p_tenant_id is provided.';
