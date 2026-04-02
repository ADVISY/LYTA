-- Add status and source tracking to insurance_products for candidate products
ALTER TABLE insurance_products 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'rejected', 'merged')),
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'ia', 'import')),
ADD COLUMN IF NOT EXISTS source_scan_id UUID REFERENCES document_scans(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS detected_name TEXT,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS validated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS merged_into_product_id UUID REFERENCES insurance_products(id) ON DELETE SET NULL;

-- Add index for pending products queries
CREATE INDEX IF NOT EXISTS idx_insurance_products_status ON insurance_products(status);
CREATE INDEX IF NOT EXISTS idx_insurance_products_source ON insurance_products(source);

-- Update the find_product_by_alias function with fuzzy matching
CREATE OR REPLACE FUNCTION find_product_by_alias(
  search_term TEXT,
  company_name TEXT DEFAULT NULL,
  category_hint TEXT DEFAULT NULL
)
RETURNS TABLE(
  product_id UUID,
  product_name TEXT,
  match_type TEXT,
  match_score NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_search TEXT;
BEGIN
  -- Normalize search term
  normalized_search := lower(trim(search_term));
  
  -- Return matches ordered by match quality
  RETURN QUERY
  
  -- Priority 1: Exact product name match (active products only)
  SELECT 
    ip.id::UUID,
    ip.name::TEXT,
    'exact'::TEXT,
    1.0::NUMERIC
  FROM insurance_products ip
  WHERE ip.status = 'active'
    AND lower(ip.name) = normalized_search
    AND (company_name IS NULL OR EXISTS (
      SELECT 1 FROM insurance_companies ic 
      WHERE ic.id = ip.company_id 
        AND lower(ic.name) ILIKE '%' || lower(company_name) || '%'
    ))
  
  UNION ALL
  
  -- Priority 2: Exact alias match
  SELECT 
    ip.id::UUID,
    ip.name::TEXT,
    'alias_exact'::TEXT,
    0.95::NUMERIC
  FROM insurance_products ip
  JOIN product_aliases pa ON pa.product_id = ip.id
  WHERE ip.status = 'active'
    AND lower(pa.alias) = normalized_search
    AND (company_name IS NULL OR EXISTS (
      SELECT 1 FROM insurance_companies ic 
      WHERE ic.id = ip.company_id 
        AND lower(ic.name) ILIKE '%' || lower(company_name) || '%'
    ))
  
  UNION ALL
  
  -- Priority 3: Partial product name match (contains)
  SELECT 
    ip.id::UUID,
    ip.name::TEXT,
    'partial'::TEXT,
    0.8::NUMERIC
  FROM insurance_products ip
  WHERE ip.status = 'active'
    AND (
      lower(ip.name) ILIKE '%' || normalized_search || '%'
      OR normalized_search ILIKE '%' || lower(ip.name) || '%'
    )
    AND lower(ip.name) != normalized_search -- Exclude exact matches already found
    AND (company_name IS NULL OR EXISTS (
      SELECT 1 FROM insurance_companies ic 
      WHERE ic.id = ip.company_id 
        AND lower(ic.name) ILIKE '%' || lower(company_name) || '%'
    ))
  
  UNION ALL
  
  -- Priority 4: Partial alias match
  SELECT 
    ip.id::UUID,
    ip.name::TEXT,
    'alias_partial'::TEXT,
    0.7::NUMERIC
  FROM insurance_products ip
  JOIN product_aliases pa ON pa.product_id = ip.id
  WHERE ip.status = 'active'
    AND (
      lower(pa.alias) ILIKE '%' || normalized_search || '%'
      OR normalized_search ILIKE '%' || lower(pa.alias) || '%'
    )
    AND lower(pa.alias) != normalized_search -- Exclude exact matches already found
    AND (company_name IS NULL OR EXISTS (
      SELECT 1 FROM insurance_companies ic 
      WHERE ic.id = ip.company_id 
        AND lower(ic.name) ILIKE '%' || lower(company_name) || '%'
    ))
    
  UNION ALL
  
  -- Priority 5: Fuzzy match using trigram similarity (if words overlap)
  SELECT 
    ip.id::UUID,
    ip.name::TEXT,
    'fuzzy'::TEXT,
    0.5::NUMERIC
  FROM insurance_products ip
  WHERE ip.status = 'active'
    AND (
      -- Check if any word from search term appears in product name
      EXISTS (
        SELECT 1 FROM unnest(string_to_array(normalized_search, ' ')) AS search_word
        WHERE length(search_word) > 2 
          AND lower(ip.name) ILIKE '%' || search_word || '%'
      )
    )
    AND NOT (lower(ip.name) ILIKE '%' || normalized_search || '%')
    AND NOT (normalized_search ILIKE '%' || lower(ip.name) || '%')
    AND (company_name IS NULL OR EXISTS (
      SELECT 1 FROM insurance_companies ic 
      WHERE ic.id = ip.company_id 
        AND lower(ic.name) ILIKE '%' || lower(company_name) || '%'
    ))
    
  ORDER BY match_score DESC, product_name
  LIMIT 10;
END;
$$;

-- Function to create a candidate product from IA
CREATE OR REPLACE FUNCTION create_candidate_product(
  p_detected_name TEXT,
  p_company_name TEXT DEFAULT NULL,
  p_main_category TEXT DEFAULT 'NON_VIE',
  p_subcategory TEXT DEFAULT NULL,
  p_scan_id UUID DEFAULT NULL
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
  -- Clean the product name
  v_clean_name := trim(p_detected_name);
  
  -- Try to find the company
  IF p_company_name IS NOT NULL THEN
    SELECT id INTO v_company_id
    FROM insurance_companies
    WHERE lower(name) ILIKE '%' || lower(p_company_name) || '%'
    LIMIT 1;
  END IF;
  
  -- If no company found, use a placeholder "À définir" company or create one
  IF v_company_id IS NULL THEN
    SELECT id INTO v_company_id
    FROM insurance_companies
    WHERE name = 'À définir'
    LIMIT 1;
    
    IF v_company_id IS NULL THEN
      INSERT INTO insurance_companies (name)
      VALUES ('À définir')
      RETURNING id INTO v_company_id;
    END IF;
  END IF;
  
  -- Check if exact same candidate already exists (avoid duplicates)
  SELECT id INTO v_product_id
  FROM insurance_products
  WHERE status = 'pending'
    AND detected_name = v_clean_name
    AND company_id = v_company_id
  LIMIT 1;
  
  -- If not found, create new candidate
  IF v_product_id IS NULL THEN
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
      is_active
    ) VALUES (
      v_clean_name,
      v_clean_name,
      v_company_id,
      COALESCE(p_main_category, 'NON_VIE'),
      COALESCE(p_main_category, 'NON_VIE')::product_main_category,
      p_subcategory,
      'pending',
      'ia',
      p_scan_id,
      false -- Not active until validated
    )
    RETURNING id INTO v_product_id;
    
    -- Add the detected name as an alias for future matching
    INSERT INTO product_aliases (product_id, alias, language)
    VALUES (v_product_id, v_clean_name, 'fr')
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN v_product_id;
END;
$$;

-- Function to validate a candidate product
CREATE OR REPLACE FUNCTION validate_candidate_product(
  p_product_id UUID,
  p_new_name TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_add_alias BOOLEAN DEFAULT true
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_detected_name TEXT;
BEGIN
  -- Get the detected name before updating
  SELECT detected_name INTO v_detected_name
  FROM insurance_products
  WHERE id = p_product_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Update the product to active
  UPDATE insurance_products
  SET 
    status = 'active',
    is_active = true,
    name = COALESCE(p_new_name, name),
    validated_at = now(),
    validated_by = p_user_id
  WHERE id = p_product_id;
  
  -- If renamed and add_alias is true, add original detected name as alias
  IF p_new_name IS NOT NULL AND p_new_name != v_detected_name AND p_add_alias THEN
    INSERT INTO product_aliases (product_id, alias, language)
    VALUES (p_product_id, v_detected_name, 'fr')
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN true;
END;
$$;

-- Function to merge a candidate into an existing product
CREATE OR REPLACE FUNCTION merge_candidate_product(
  p_candidate_id UUID,
  p_target_product_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_detected_name TEXT;
BEGIN
  -- Get the candidate's detected name
  SELECT detected_name INTO v_detected_name
  FROM insurance_products
  WHERE id = p_candidate_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Mark candidate as merged
  UPDATE insurance_products
  SET 
    status = 'merged',
    merged_into_product_id = p_target_product_id,
    validated_at = now(),
    validated_by = p_user_id
  WHERE id = p_candidate_id;
  
  -- Add detected name as alias to the target product
  INSERT INTO product_aliases (product_id, alias, language)
  VALUES (p_target_product_id, v_detected_name, 'fr')
  ON CONFLICT DO NOTHING;
  
  -- Transfer any aliases from candidate to target
  UPDATE product_aliases
  SET product_id = p_target_product_id
  WHERE product_id = p_candidate_id;
  
  RETURN true;
END;
$$;

-- Function to reject a candidate product
CREATE OR REPLACE FUNCTION reject_candidate_product(
  p_product_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE insurance_products
  SET 
    status = 'rejected',
    validated_at = now(),
    validated_by = p_user_id
  WHERE id = p_product_id AND status = 'pending';
  
  RETURN FOUND;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION find_product_by_alias(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_candidate_product(TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_candidate_product(UUID, TEXT, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION merge_candidate_product(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_candidate_product(UUID, UUID) TO authenticated;