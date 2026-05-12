-- ============================================================================
-- Robust product matching: stronger normalization + trigram fallback
-- ============================================================================
-- The IA OCR returns product names with company prefixes ("Swica Favorit
-- Medpharm") or slight orthographic variations, and the broker reports
-- catalog products with the canonical name ("Swica Favorit Medpharm").
-- Sometimes the IA returns just "Favorit Medpharm" without the prefix,
-- and the match fails. We make matching tolerant by:
--
--   1. Strip company prefix when normalizing the candidate name
--   2. Strip accents (NFD decomposition)
--   3. Add a final trigram-similarity fallback (≥ 0.55) so typos don't
--      break the match anymore.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------------
-- 1. Stronger product name normalizer
-- ---------------------------------------------------------------------------
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

  -- Strip accents (NFD → drop combining diacritics)
  v_norm := translate(v_norm,
    'àáâãäåæçèéêëìíîïñòóôõöøùúûüýÿœ',
    'aaaaaaaceeeeiiiinooooooouuuuyyo');

  -- Strip common company prefixes so "Swica Favorit Medpharm" matches "Favorit Medpharm"
  v_norm := regexp_replace(v_norm,
    '^(swica|helsana|sanitas|css|concordia|atupri|assura|sympany|visana|kpt|cpt|groupe mutuel|gm|swiss life|helvetia|baloise|generali|axa|zurich|la mobiliere|mobiliere|la vaudoise|vaudoise|pax|liechtenstein life|zugerberg finanz|zugerberg)\s+', '', 'i');

  -- Remove punctuation
  v_norm := regexp_replace(v_norm, '[[:punct:]]', ' ', 'g');

  -- Collapse whitespace
  v_norm := regexp_replace(v_norm, '\s+', ' ', 'g');
  v_norm := trim(v_norm);

  RETURN v_norm;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Stronger company name normalizer (NFD + suffix stripping)
-- ---------------------------------------------------------------------------
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
  v_norm := translate(v_norm,
    'àáâãäåæçèéêëìíîïñòóôõöøùúûüýÿœ',
    'aaaaaaaceeeeiiiinooooooouuuuyyo');
  v_norm := regexp_replace(v_norm, '[[:punct:]&]', ' ', 'g');
  v_norm := regexp_replace(v_norm, '\s+', ' ', 'g');
  v_norm := trim(v_norm);

  -- Strip trailing company-form suffixes
  v_norm := regexp_replace(v_norm,
    '\s+(sa|ag|sarl|gmbh|ltd|limited|assurance|assurances|versicherung|versicherungen|insurance|insurances|holding|group|groupe|gruppe|suisse|switzerland|schweiz|ch)$',
    '', 'gi');

  RETURN trim(v_norm);
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Extend find_product_for_company with trigram fallback
-- ---------------------------------------------------------------------------
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

  -- Priority 1: exact normalized name match
  RETURN QUERY
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

  -- Priority 2: detected_name match
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

  IF FOUND THEN RETURN; END IF;

  -- Priority 4: substring match (one contains the other)
  RETURN QUERY
  SELECT ip.id, ip.status::TEXT, 'contains'::TEXT
  FROM insurance_products ip
  WHERE ip.company_id = p_company_id
    AND ip.status IN ('active', 'pending')
    AND (
      normalize_product_name(ip.name) LIKE '%' || v_norm || '%'
      OR v_norm LIKE '%' || normalize_product_name(ip.name) || '%'
    )
    AND length(v_norm) >= 4   -- avoid very short false-positives
  ORDER BY CASE ip.status WHEN 'active' THEN 1 ELSE 2 END,
           length(ip.name) ASC
  LIMIT 1;

  IF FOUND THEN RETURN; END IF;

  -- Priority 5: trigram similarity ≥ 0.55 (typo tolerance)
  RETURN QUERY
  SELECT ip.id, ip.status::TEXT, 'trigram'::TEXT
  FROM insurance_products ip
  WHERE ip.company_id = p_company_id
    AND ip.status IN ('active', 'pending')
    AND similarity(normalize_product_name(ip.name), v_norm) >= 0.55
  ORDER BY similarity(normalize_product_name(ip.name), v_norm) DESC,
           CASE ip.status WHEN 'active' THEN 1 ELSE 2 END
  LIMIT 1;

  RETURN;
END;
$$;

-- Trigram index speeds up the last similarity lookup
CREATE INDEX IF NOT EXISTS idx_insurance_products_name_trgm
  ON public.insurance_products USING gin (normalize_product_name(name) gin_trgm_ops);
