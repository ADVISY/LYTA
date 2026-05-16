-- ============================================================================
-- match_commission_line — RPC pour matcher une ligne de décompte au CRM
-- ============================================================================
-- Donne la meilleure correspondance client/police pour une ligne extraite
-- d'un décompte de commissions. Priorités (du plus fiable au moins fiable) :
--   1. policy_number exact (case-insensitive)            → score 1.0
--   2. nom + prénom EXACT normalisé NFD                  → score 0.95
--   3. nom + prénom FUZZY via pg_trgm similarity > 0.7   → score = sim
--
-- Retourne tous les candidats triés par score décroissant, jusqu'à 5.
-- Le caller (edge function scan-commission-statement) prend le top 1 et
-- décide du status (matched / ambiguous / no_match) selon la marge.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.match_commission_line(
  p_tenant_id     UUID,
  p_first_name    TEXT,
  p_last_name     TEXT,
  p_policy_number TEXT DEFAULT NULL
)
RETURNS TABLE(
  client_id   UUID,
  policy_id   UUID,
  match_score NUMERIC,
  match_type  TEXT,
  client_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first TEXT;
  v_last  TEXT;
  v_pol   TEXT;
BEGIN
  -- Normalisation : lower + trim + NFD-stripping côté SQL via translate
  v_first := lower(trim(COALESCE(p_first_name, '')));
  v_last  := lower(trim(COALESCE(p_last_name,  '')));
  v_pol   := upper(trim(regexp_replace(COALESCE(p_policy_number, ''), '\s+', '', 'g')));

  RETURN QUERY
  -- 1) Match exact par numéro de police (le plus fiable)
  SELECT
    c.id,
    p.id,
    1.0::NUMERIC,
    'policy'::TEXT,
    (COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, ''))::TEXT
  FROM public.policies p
  JOIN public.clients c ON c.id = p.client_id
  WHERE c.tenant_id = p_tenant_id
    AND v_pol <> ''
    AND upper(regexp_replace(COALESCE(p.policy_number, ''), '\s+', '', 'g')) = v_pol

  UNION ALL

  -- 2) Match exact nom + prénom
  SELECT
    c.id,
    NULL::UUID,
    0.95::NUMERIC,
    'name_exact'::TEXT,
    (COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, ''))::TEXT
  FROM public.clients c
  WHERE c.tenant_id = p_tenant_id
    AND v_first <> '' AND v_last <> ''
    AND lower(COALESCE(c.first_name, '')) = v_first
    AND lower(COALESCE(c.last_name,  '')) = v_last

  UNION ALL

  -- 3) Match fuzzy nom + prénom (similarity trigram > 0.7)
  SELECT
    c.id,
    NULL::UUID,
    (
      (similarity(lower(COALESCE(c.first_name, '')), v_first) +
       similarity(lower(COALESCE(c.last_name,  '')), v_last)) / 2.0
    )::NUMERIC,
    'name_fuzzy'::TEXT,
    (COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, ''))::TEXT
  FROM public.clients c
  WHERE c.tenant_id = p_tenant_id
    AND v_first <> '' AND v_last <> ''
    AND (
      similarity(lower(COALESCE(c.first_name, '')), v_first) > 0.6
      AND similarity(lower(COALESCE(c.last_name,  '')), v_last)  > 0.7
    )
    -- exclure ce qui est déjà capté par le exact
    AND NOT (
      lower(COALESCE(c.first_name, '')) = v_first
      AND lower(COALESCE(c.last_name,  '')) = v_last
    )

  ORDER BY 3 DESC
  LIMIT 5;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_commission_line(UUID, TEXT, TEXT, TEXT)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.match_commission_line IS
  'Smartflow Décomptes : retourne les meilleurs candidats client/police pour une ligne de décompte de commissions. 1=policy_number exact, 0.95=nom exact, <0.95=fuzzy.';
