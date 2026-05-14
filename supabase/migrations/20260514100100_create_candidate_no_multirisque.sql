-- Replace 'multirisque' in create_candidate_product so it no longer
-- inserts rows that violate the new CHECK constraint.

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
BEGIN
  v_clean_name := trim(p_detected_name);
  IF v_clean_name IS NULL OR length(v_clean_name) = 0 THEN
    RAISE EXCEPTION 'create_candidate_product: detected_name is required';
  END IF;

  v_company_id := find_or_create_company_normalized(p_company_name);

  SELECT product_id INTO v_product_id
  FROM find_product_for_company(v_company_id, v_clean_name)
  LIMIT 1;

  IF v_product_id IS NOT NULL THEN
    UPDATE insurance_products
    SET seen_count = seen_count + 1,
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

  -- No match → pending candidate (HIDDEN from Partenaires UI)
  INSERT INTO insurance_products (
    name, detected_name, company_id, category,
    main_category, subcategory, status, source, source_scan_id,
    is_active, seen_count, tenant_id, tenant_branch_id
  ) VALUES (
    v_clean_name,
    v_clean_name,
    v_company_id,
    -- Map main_category → legacy category enum (NO MORE multirisque).
    CASE upper(COALESCE(p_main_category, 'NON_VIE'))
      WHEN 'VIE'      THEN 'life'
      WHEN 'LCA'      THEN 'health'
      WHEN 'LAMAL'    THEN 'health'
      WHEN 'PGM'      THEN 'health'
      WHEN 'ACCIDENT' THEN 'health'
      WHEN 'LPP'      THEN 'life'
      WHEN 'HYPO'     THEN 'life'
      WHEN 'AUTO'     THEN 'auto'
      WHEN 'MENAGE_RC' THEN 'home'
      WHEN 'JURIDIQUE' THEN 'legal'
      WHEN 'VOYAGE'   THEN 'home'
      WHEN 'ENTREPRISE' THEN 'rcpro'
      WHEN 'NON_VIE'  THEN 'home'   -- generic fallback for un-branched NON_VIE
      ELSE 'home'
    END,
    COALESCE(p_main_category, 'NON_VIE')::product_main_category,
    p_subcategory,
    'pending',
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
