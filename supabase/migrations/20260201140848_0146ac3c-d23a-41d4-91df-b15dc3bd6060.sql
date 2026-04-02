-- Drop both overloads of find_product_by_alias to clean up
DROP FUNCTION IF EXISTS public.find_product_by_alias(text);
DROP FUNCTION IF EXISTS public.find_product_by_alias(text, text, text);

-- Create a single clean version
CREATE OR REPLACE FUNCTION public.find_product_by_alias(
  search_term text,
  company_name text DEFAULT NULL,
  category_hint text DEFAULT NULL
)
RETURNS TABLE(
  product_id uuid,
  product_name text,
  match_type text,
  match_score numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  normalized_search TEXT;
  result RECORD;
BEGIN
  normalized_search := lower(trim(search_term));
  
  -- Return matches using a CTE to allow proper ordering
  RETURN QUERY
  WITH matches AS (
    -- Priority 1: Exact product name match
    SELECT 
      ip.id AS pid,
      ip.name AS pname,
      'exact'::TEXT AS mtype,
      1.0::NUMERIC AS mscore
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
      ip.id,
      ip.name,
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
    
    -- Priority 3: Partial product name match
    SELECT 
      ip.id,
      ip.name,
      'partial'::TEXT,
      0.8::NUMERIC
    FROM insurance_products ip
    WHERE ip.status = 'active'
      AND (
        lower(ip.name) ILIKE '%' || normalized_search || '%'
        OR normalized_search ILIKE '%' || lower(ip.name) || '%'
      )
      AND lower(ip.name) != normalized_search
      AND (company_name IS NULL OR EXISTS (
        SELECT 1 FROM insurance_companies ic 
        WHERE ic.id = ip.company_id 
          AND lower(ic.name) ILIKE '%' || lower(company_name) || '%'
      ))
    
    UNION ALL
    
    -- Priority 4: Partial alias match
    SELECT 
      ip.id,
      ip.name,
      'alias_partial'::TEXT,
      0.7::NUMERIC
    FROM insurance_products ip
    JOIN product_aliases pa ON pa.product_id = ip.id
    WHERE ip.status = 'active'
      AND (
        lower(pa.alias) ILIKE '%' || normalized_search || '%'
        OR normalized_search ILIKE '%' || lower(pa.alias) || '%'
      )
      AND lower(pa.alias) != normalized_search
      AND (company_name IS NULL OR EXISTS (
        SELECT 1 FROM insurance_companies ic 
        WHERE ic.id = ip.company_id 
          AND lower(ic.name) ILIKE '%' || lower(company_name) || '%'
      ))
      
    UNION ALL
    
    -- Priority 5: Fuzzy word match
    SELECT 
      ip.id,
      ip.name,
      'fuzzy'::TEXT,
      0.5::NUMERIC
    FROM insurance_products ip
    WHERE ip.status = 'active'
      AND EXISTS (
        SELECT 1 FROM unnest(string_to_array(normalized_search, ' ')) AS sw
        WHERE length(sw) > 2 
          AND lower(ip.name) ILIKE '%' || sw || '%'
      )
      AND NOT (lower(ip.name) ILIKE '%' || normalized_search || '%')
      AND NOT (normalized_search ILIKE '%' || lower(ip.name) || '%')
      AND (company_name IS NULL OR EXISTS (
        SELECT 1 FROM insurance_companies ic 
        WHERE ic.id = ip.company_id 
          AND lower(ic.name) ILIKE '%' || lower(company_name) || '%'
      ))
  )
  SELECT DISTINCT ON (m.pid) m.pid, m.pname, m.mtype, m.mscore
  FROM matches m
  ORDER BY m.pid, m.mscore DESC;
END;
$function$;