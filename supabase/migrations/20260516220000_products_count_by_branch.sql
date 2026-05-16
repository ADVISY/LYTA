-- ============================================================================
-- RPC count_products_by_branch — distribution produits actifs par branche
-- ============================================================================
-- Utilisée par KingDashboard pour montrer la santé du catalogue (combien de
-- produits actifs LAMAL vs LCA vs AUTO etc.). King-only via SECURITY DEFINER.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.count_products_by_branch()
RETURNS TABLE (
  branch_code TEXT,
  total INT,
  system_count INT,
  tenant_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_king() THEN
    RAISE EXCEPTION 'king required';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(p.branch_code, 'AUCUNE')::TEXT,
    count(*)::INT,
    count(*) FILTER (WHERE p.tenant_id IS NULL)::INT,
    count(*) FILTER (WHERE p.tenant_id IS NOT NULL)::INT
  FROM public.insurance_products p
  WHERE p.is_active = true
  GROUP BY p.branch_code
  ORDER BY count(*) DESC;
END $$;

GRANT EXECUTE ON FUNCTION public.count_products_by_branch() TO authenticated;
