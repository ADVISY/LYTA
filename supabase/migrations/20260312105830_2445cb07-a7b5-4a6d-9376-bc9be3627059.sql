
CREATE OR REPLACE FUNCTION public.create_candidate_product(
  p_detected_name text,
  p_company_name text DEFAULT NULL,
  p_main_category text DEFAULT 'NON_VIE',
  p_subcategory text DEFAULT NULL,
  p_scan_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_product_id UUID;
  v_company_id UUID;
  v_clean_name TEXT;
  v_normalized_category TEXT;
BEGIN
  v_clean_name := trim(p_detected_name);
  
  -- Normalize category from AI values to valid check constraint values
  v_normalized_category := CASE lower(COALESCE(p_main_category, 'NON_VIE'))
    WHEN 'vie' THEN 'life'
    WHEN 'lca' THEN 'health'
    WHEN 'lamal' THEN 'health'
    WHEN 'non_vie' THEN 'home'
    WHEN 'non-vie' THEN 'home'
    WHEN 'laa' THEN 'health'
    WHEN 'lpp' THEN 'life'
    WHEN 'hypo' THEN 'home'
    WHEN 'auto' THEN 'auto'
    WHEN 'health' THEN 'health'
    WHEN 'life' THEN 'life'
    WHEN 'home' THEN 'home'
    WHEN 'legal' THEN 'legal'
    WHEN 'rcpro' THEN 'rcpro'
    WHEN 'multirisque' THEN 'multirisque'
    WHEN 'third_pillar' THEN 'third_pillar'
    ELSE 'health'
  END;
  
  -- Try to find the company
  IF p_company_name IS NOT NULL THEN
    SELECT id INTO v_company_id
    FROM insurance_companies
    WHERE lower(name) ILIKE '%' || lower(p_company_name) || '%'
    LIMIT 1;
  END IF;
  
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
  
  -- Check if exact same candidate already exists
  SELECT id INTO v_product_id
  FROM insurance_products
  WHERE status = 'pending'
    AND detected_name = v_clean_name
    AND company_id = v_company_id
  LIMIT 1;
  
  IF v_product_id IS NULL THEN
    INSERT INTO insurance_products (
      name, detected_name, company_id, category, main_category,
      subcategory, status, source, source_scan_id, is_active
    ) VALUES (
      v_clean_name, v_clean_name, v_company_id,
      v_normalized_category,
      COALESCE(p_main_category, 'NON_VIE')::product_main_category,
      p_subcategory, 'pending', 'ia', p_scan_id, false
    )
    RETURNING id INTO v_product_id;
    
    INSERT INTO product_aliases (product_id, alias, language)
    VALUES (v_product_id, v_clean_name, 'fr')
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN v_product_id;
END;
$function$;
