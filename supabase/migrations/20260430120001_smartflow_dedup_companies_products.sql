-- SmartFlow / IA scan: fix duplicate insurance_companies + insurance_products
-- when a document is scanned. Adds normalization helpers + atomic find-or-create
-- functions, and rewrites create_candidate_product() to reuse existing rows
-- (active, pending, or merged) instead of inserting blindly.

-- ============================================================================
-- 1. Normalization helpers (pure, immutable)
-- ============================================================================

-- Strips legal suffixes ("AG", "SA", "Sàrl", "GmbH", "Ltd", "Inc", "S.A.")
-- and collapses whitespace + casing. Used to match "Swica" with "Swica AG".
CREATE OR REPLACE FUNCTION public.normalize_company_name(p_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  v_norm TEXT;
BEGIN
  IF p_name IS NULL THEN
    RETURN NULL;
  END IF;

  v_norm := lower(trim(p_name));

  -- Remove punctuation that does not carry meaning
  v_norm := regexp_replace(v_norm, E'[.,;:()\\[\\]"\']', '', 'g');

  -- Strip common legal suffixes (order matters - longest first)
  v_norm := regexp_replace(v_norm, '\s+(s\s*\.?\s*a\s*\.?\s*r\s*\.?\s*l\.?|sarl|sàrl|s\.a\.r\.l\.)$', '', 'i');
  v_norm := regexp_replace(v_norm, '\s+(s\.?\s*a\.?|s\.a\.|société\s+anonyme)$', '', 'i');
  v_norm := regexp_replace(v_norm, '\s+(a\.?\s*g\.?|aktiengesellschaft)$', '', 'i');
  v_norm := regexp_replace(v_norm, '\s+(gmbh|g\.m\.b\.h\.)$', '', 'i');
  v_norm := regexp_replace(v_norm, '\s+(ltd\.?|limited)$', '', 'i');
  v_norm := regexp_replace(v_norm, '\s+(inc\.?|incorporated)$', '', 'i');
  v_norm := regexp_replace(v_norm, '\s+(suisse|swiss|switzerland|schweiz|svizzera)$', '', 'i');

  -- Collapse multiple spaces
  v_norm := regexp_replace(v_norm, '\s+', ' ', 'g');
  v_norm := trim(v_norm);

  RETURN v_norm;
END;
$$;

-- Lighter normalization for product names: lowercase, trim, collapse spaces.
-- Does NOT strip suffixes since product names are more structured.
CREATE OR REPLACE FUNCTION public.normalize_product_name(p_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  v_norm TEXT;
BEGIN
  IF p_name IS NULL THEN
    RETURN NULL;
  END IF;

  v_norm := lower(trim(p_name));
  -- Remove most punctuation
  v_norm := regexp_replace(v_norm, E'[.,;:()\\[\\]"\']', '', 'g');
  -- Collapse whitespace
  v_norm := regexp_replace(v_norm, '\s+', ' ', 'g');
  v_norm := trim(v_norm);

  RETURN v_norm;
END;
$$;

-- Functional indexes so normalized lookups stay fast at scale.
CREATE INDEX IF NOT EXISTS idx_insurance_companies_normalized_name
  ON public.insurance_companies (public.normalize_company_name(name));

CREATE INDEX IF NOT EXISTS idx_insurance_products_normalized_name
  ON public.insurance_products (company_id, public.normalize_product_name(name));

CREATE INDEX IF NOT EXISTS idx_insurance_products_normalized_detected_name
  ON public.insurance_products (company_id, public.normalize_product_name(detected_name));


-- ============================================================================
-- 2. Atomic find-or-create company (normalized)
-- ============================================================================

-- Looks up an existing company whose normalized name matches the input.
-- If none found, inserts a new row. Always returns the canonical company_id.
-- Concurrency-safe: uses ON CONFLICT on the unique name column for race conditions.
CREATE OR REPLACE FUNCTION public.find_or_create_company_normalized(
  p_company_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_norm TEXT;
  v_clean TEXT;
BEGIN
  IF p_company_name IS NULL OR length(trim(p_company_name)) = 0 THEN
    -- Fall back to "À définir" placeholder so caller never gets NULL
    SELECT id INTO v_company_id FROM insurance_companies WHERE name = 'À définir' LIMIT 1;
    IF v_company_id IS NULL THEN
      INSERT INTO insurance_companies (name) VALUES ('À définir')
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id INTO v_company_id;
    END IF;
    RETURN v_company_id;
  END IF;

  v_clean := trim(p_company_name);
  v_norm := normalize_company_name(v_clean);

  -- 1. Try exact normalized match
  SELECT id INTO v_company_id
  FROM insurance_companies
  WHERE normalize_company_name(name) = v_norm
  LIMIT 1;

  IF v_company_id IS NOT NULL THEN
    RETURN v_company_id;
  END IF;

  -- 2. Try contains match (handles "AXA" matching "AXA Winterthur" if user typed short form).
  --    We bias toward the SHORTEST canonical name to avoid picking a too-specific subsidiary.
  SELECT id INTO v_company_id
  FROM insurance_companies
  WHERE normalize_company_name(name) LIKE '%' || v_norm || '%'
     OR v_norm LIKE '%' || normalize_company_name(name) || '%'
  ORDER BY length(name) ASC
  LIMIT 1;

  IF v_company_id IS NOT NULL THEN
    RETURN v_company_id;
  END IF;

  -- 3. Insert new (with ON CONFLICT for race condition safety on unique name)
  INSERT INTO insurance_companies (name)
  VALUES (v_clean)
  ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_company_id;

  RETURN v_company_id;
END;
$$;


-- ============================================================================
-- 3. find-or-create candidate product (with fuzzy match against existing)
-- ============================================================================

-- Looks for an existing product (active, pending, or merged) under the given
-- company that matches the input name on EITHER name OR detected_name OR alias,
-- using normalized comparison. Returns the product_id if found.
-- Returns NULL if no match.
CREATE OR REPLACE FUNCTION public.find_product_for_company(
  p_company_id UUID,
  p_product_name TEXT
)
RETURNS TABLE(product_id UUID, status TEXT, match_via TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm TEXT;
BEGIN
  IF p_company_id IS NULL OR p_product_name IS NULL THEN
    RETURN;
  END IF;

  v_norm := normalize_product_name(p_product_name);

  RETURN QUERY
  -- Priority 1: exact name match (any status, prefer active)
  SELECT ip.id, ip.status::TEXT, 'name'::TEXT
  FROM insurance_products ip
  WHERE ip.company_id = p_company_id
    AND normalize_product_name(ip.name) = v_norm
  ORDER BY CASE ip.status
             WHEN 'active' THEN 1
             WHEN 'pending' THEN 2
             WHEN 'merged' THEN 3
             ELSE 4
           END
  LIMIT 1;

  IF FOUND THEN RETURN; END IF;

  -- Priority 2: detected_name match (typically pending candidates from prior scans)
  RETURN QUERY
  SELECT ip.id, ip.status::TEXT, 'detected_name'::TEXT
  FROM insurance_products ip
  WHERE ip.company_id = p_company_id
    AND ip.detected_name IS NOT NULL
    AND normalize_product_name(ip.detected_name) = v_norm
  ORDER BY CASE ip.status
             WHEN 'active' THEN 1
             WHEN 'pending' THEN 2
             WHEN 'merged' THEN 3
             ELSE 4
           END
  LIMIT 1;

  IF FOUND THEN RETURN; END IF;

  -- Priority 3: alias match
  RETURN QUERY
  SELECT ip.id, ip.status::TEXT, 'alias'::TEXT
  FROM insurance_products ip
  JOIN product_aliases pa ON pa.product_id = ip.id
  WHERE ip.company_id = p_company_id
    AND normalize_product_name(pa.alias) = v_norm
  ORDER BY CASE ip.status
             WHEN 'active' THEN 1
             WHEN 'pending' THEN 2
             WHEN 'merged' THEN 3
             ELSE 4
           END
  LIMIT 1;

  RETURN;
END;
$$;


-- ============================================================================
-- 4. Track how many times a candidate has been "seen" (helps prioritize validation)
-- ============================================================================

ALTER TABLE public.insurance_products
  ADD COLUMN IF NOT EXISTS seen_count INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_insurance_products_status_seen_count
  ON public.insurance_products(status, seen_count DESC)
  WHERE status = 'pending';


-- ============================================================================
-- 5. Rewrite create_candidate_product to reuse existing rows
-- ============================================================================

-- Same signature as before so the edge function does not need to change yet,
-- but the body now:
--   - resolves the company via find_or_create_company_normalized (no more ILIKE %name%)
--   - looks for an existing product (active/pending/merged) BEFORE inserting
--   - if found, increments seen_count and returns its id
--   - else inserts a fresh pending candidate
CREATE OR REPLACE FUNCTION public.create_candidate_product(
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
  v_match_status TEXT;
BEGIN
  v_clean_name := trim(p_detected_name);
  IF v_clean_name IS NULL OR length(v_clean_name) = 0 THEN
    RAISE EXCEPTION 'create_candidate_product: detected_name is required';
  END IF;

  -- Step 1: resolve company atomically (handles normalization + insert-if-missing)
  v_company_id := find_or_create_company_normalized(p_company_name);

  -- Step 2: look for an existing matching product under this company
  SELECT product_id, status INTO v_product_id, v_match_status
  FROM find_product_for_company(v_company_id, v_clean_name)
  LIMIT 1;

  IF v_product_id IS NOT NULL THEN
    -- Reuse: bump seen_count + remember the new alias if different from existing names
    UPDATE insurance_products
    SET seen_count = seen_count + 1
    WHERE id = v_product_id;

    -- Add the freshly detected name as an alias if it is genuinely a new spelling
    INSERT INTO product_aliases (product_id, alias, language)
    SELECT v_product_id, v_clean_name, 'fr'
    WHERE NOT EXISTS (
      SELECT 1 FROM product_aliases pa
      WHERE pa.product_id = v_product_id
        AND normalize_product_name(pa.alias) = normalize_product_name(v_clean_name)
    );

    RETURN v_product_id;
  END IF;

  -- Step 3: no match - insert a new pending candidate
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
    seen_count
  ) VALUES (
    v_clean_name,
    v_clean_name,
    v_company_id,
    -- map main_category to legacy category enum (best-effort)
    CASE upper(COALESCE(p_main_category, 'NON_VIE'))
      WHEN 'VIE' THEN 'life'
      WHEN 'NON_VIE' THEN 'multirisque'
      ELSE 'multirisque'
    END,
    COALESCE(p_main_category, 'NON_VIE')::product_main_category,
    p_subcategory,
    'pending',
    'ia',
    p_scan_id,
    false, -- not active until validated
    1
  )
  RETURNING id INTO v_product_id;

  -- Seed the alias table with the detected name for future fuzzy matches
  INSERT INTO product_aliases (product_id, alias, language)
  VALUES (v_product_id, v_clean_name, 'fr')
  ON CONFLICT DO NOTHING;

  RETURN v_product_id;
END;
$$;


-- ============================================================================
-- 6. Extend find_product_by_alias to optionally include candidates
-- ============================================================================

-- Old callers (with 3 args) get the original active-only behavior.
-- New callers can pass p_include_candidates=true to also match pending+merged.
DROP FUNCTION IF EXISTS public.find_product_by_alias(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.find_product_by_alias(
  search_term TEXT,
  company_name TEXT DEFAULT NULL,
  category_hint TEXT DEFAULT NULL,
  p_include_candidates BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(
  product_id UUID,
  product_name TEXT,
  match_type TEXT,
  match_score NUMERIC,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_search TEXT;
  v_status_filter TEXT[];
BEGIN
  normalized_search := normalize_product_name(search_term);

  IF p_include_candidates THEN
    v_status_filter := ARRAY['active', 'pending', 'merged'];
  ELSE
    v_status_filter := ARRAY['active'];
  END IF;

  RETURN QUERY
  -- Priority 1: exact normalized name match
  SELECT
    ip.id::UUID,
    ip.name::TEXT,
    'exact'::TEXT,
    1.0::NUMERIC,
    ip.status::TEXT
  FROM insurance_products ip
  WHERE ip.status = ANY(v_status_filter)
    AND normalize_product_name(ip.name) = normalized_search
    AND (company_name IS NULL OR EXISTS (
      SELECT 1 FROM insurance_companies ic
      WHERE ic.id = ip.company_id
        AND normalize_company_name(ic.name) = normalize_company_name(company_name)
    ))

  UNION ALL

  -- Priority 2: exact alias match
  SELECT
    ip.id::UUID,
    ip.name::TEXT,
    'alias_exact'::TEXT,
    0.95::NUMERIC,
    ip.status::TEXT
  FROM insurance_products ip
  JOIN product_aliases pa ON pa.product_id = ip.id
  WHERE ip.status = ANY(v_status_filter)
    AND normalize_product_name(pa.alias) = normalized_search
    AND (company_name IS NULL OR EXISTS (
      SELECT 1 FROM insurance_companies ic
      WHERE ic.id = ip.company_id
        AND normalize_company_name(ic.name) = normalize_company_name(company_name)
    ))

  UNION ALL

  -- Priority 3: partial name match (contains)
  SELECT
    ip.id::UUID,
    ip.name::TEXT,
    'partial'::TEXT,
    0.8::NUMERIC,
    ip.status::TEXT
  FROM insurance_products ip
  WHERE ip.status = ANY(v_status_filter)
    AND (
      normalize_product_name(ip.name) LIKE '%' || normalized_search || '%'
      OR normalized_search LIKE '%' || normalize_product_name(ip.name) || '%'
    )
    AND normalize_product_name(ip.name) != normalized_search
    AND (company_name IS NULL OR EXISTS (
      SELECT 1 FROM insurance_companies ic
      WHERE ic.id = ip.company_id
        AND normalize_company_name(ic.name) = normalize_company_name(company_name)
    ))

  UNION ALL

  -- Priority 4: partial alias match
  SELECT
    ip.id::UUID,
    ip.name::TEXT,
    'alias_partial'::TEXT,
    0.7::NUMERIC,
    ip.status::TEXT
  FROM insurance_products ip
  JOIN product_aliases pa ON pa.product_id = ip.id
  WHERE ip.status = ANY(v_status_filter)
    AND (
      normalize_product_name(pa.alias) LIKE '%' || normalized_search || '%'
      OR normalized_search LIKE '%' || normalize_product_name(pa.alias) || '%'
    )
    AND normalize_product_name(pa.alias) != normalized_search
    AND (company_name IS NULL OR EXISTS (
      SELECT 1 FROM insurance_companies ic
      WHERE ic.id = ip.company_id
        AND normalize_company_name(ic.name) = normalize_company_name(company_name)
    ))

  ORDER BY match_score DESC, product_name
  LIMIT 10;
END;
$$;


-- ============================================================================
-- 7. Permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.normalize_company_name(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.normalize_product_name(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.find_or_create_company_normalized(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.find_product_for_company(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.find_product_by_alias(TEXT, TEXT, TEXT, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_candidate_product(TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated, service_role;
