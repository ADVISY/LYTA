-- ============================================================================
-- find_product_by_alias : retourne aussi branch_code et company_id
-- ============================================================================
-- Aujourd'hui la RPC retourne (product_id, product_name, match_type, match_score, status).
-- Le scan-document edge function calcule ensuite la branche via heuristique nom→branche.
-- Maintenant que les 390 produits du catalogue ont un branch_code fiable, on
-- peut directement le retourner pour fiabiliser le classement du scan.
-- ============================================================================

DROP FUNCTION IF EXISTS public.find_product_by_alias(TEXT, TEXT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.find_product_by_alias(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.find_product_by_alias(TEXT);

CREATE OR REPLACE FUNCTION public.find_product_by_alias(
  search_term TEXT,
  company_name TEXT DEFAULT NULL,
  category_hint TEXT DEFAULT NULL,
  p_include_candidates BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(
  product_id   UUID,
  product_name TEXT,
  match_type   TEXT,
  match_score  NUMERIC,
  status       TEXT,
  branch_code  TEXT,
  company_id   UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_search TEXT;
  v_status_filter   TEXT[];
BEGIN
  normalized_search := normalize_product_name(search_term);

  IF p_include_candidates THEN
    v_status_filter := ARRAY['active', 'pending', 'merged'];
  ELSE
    v_status_filter := ARRAY['active'];
  END IF;

  RETURN QUERY
  -- Priority 1: exact normalized name match on the product itself
  SELECT
    ip.id::UUID,
    ip.name::TEXT,
    'exact'::TEXT,
    1.0::NUMERIC,
    ip.status::TEXT,
    ip.branch_code::TEXT,
    ip.company_id::UUID
  FROM public.insurance_products ip
  WHERE ip.status = ANY(v_status_filter)
    AND normalize_product_name(ip.name) = normalized_search
    AND (company_name IS NULL OR ip.company_id = (
      SELECT id FROM public.insurance_companies
      WHERE normalize_product_name(name) = normalize_product_name(company_name)
      LIMIT 1
    ))

  UNION ALL

  -- Priority 2: exact alias match
  SELECT
    ip.id::UUID,
    ip.name::TEXT,
    'alias'::TEXT,
    0.95::NUMERIC,
    ip.status::TEXT,
    ip.branch_code::TEXT,
    ip.company_id::UUID
  FROM public.product_aliases pa
  JOIN public.insurance_products ip ON ip.id = pa.product_id
  WHERE ip.status = ANY(v_status_filter)
    AND normalize_product_name(pa.alias) = normalized_search
    AND (company_name IS NULL OR ip.company_id = (
      SELECT id FROM public.insurance_companies
      WHERE normalize_product_name(name) = normalize_product_name(company_name)
      LIMIT 1
    ))

  UNION ALL

  -- Priority 3: fuzzy trigram match (similarity > 0.4)
  SELECT
    ip.id::UUID,
    ip.name::TEXT,
    'fuzzy'::TEXT,
    similarity(normalize_product_name(ip.name), normalized_search)::NUMERIC,
    ip.status::TEXT,
    ip.branch_code::TEXT,
    ip.company_id::UUID
  FROM public.insurance_products ip
  WHERE ip.status = ANY(v_status_filter)
    AND similarity(normalize_product_name(ip.name), normalized_search) > 0.4
    AND (company_name IS NULL OR ip.company_id = (
      SELECT id FROM public.insurance_companies
      WHERE normalize_product_name(name) = normalize_product_name(company_name)
      LIMIT 1
    ))

  ORDER BY 4 DESC, 3
  LIMIT 5;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_product_by_alias(TEXT, TEXT, TEXT, BOOLEAN) TO authenticated, service_role;
