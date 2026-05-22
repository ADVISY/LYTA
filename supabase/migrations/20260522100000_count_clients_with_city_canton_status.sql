-- ============================================================================
-- count_clients_for_tenant — ajout filtres city / canton / status / postal_code
-- ============================================================================
-- Nouveaux filtres pour la page Adresses : permet de filtrer côté serveur
-- par ville, canton, statut et code postal — utile pour cibler des prospects
-- géographiquement ou par maturité commerciale.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.count_clients_for_tenant(
  p_tenant_id     UUID,
  p_type_adresse  TEXT DEFAULT NULL,
  p_search        TEXT DEFAULT NULL,
  p_city          TEXT DEFAULT NULL,
  p_canton        TEXT DEFAULT NULL,
  p_status        TEXT DEFAULT NULL,
  p_postal_code   TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_has_access BOOLEAN;
  v_count BIGINT;
  v_pattern TEXT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  SELECT (
    public.is_king()
    OR EXISTS (
      SELECT 1 FROM public.user_tenant_assignments uta
      WHERE uta.user_id = v_user AND uta.tenant_id = p_tenant_id
    )
    OR EXISTS (
      SELECT 1 FROM public.user_tenant_roles utr
      JOIN public.tenant_roles tr ON tr.id = utr.role_id
      WHERE utr.user_id = v_user AND tr.tenant_id = p_tenant_id AND tr.is_active = true
    )
  ) INTO v_has_access;

  IF NOT v_has_access THEN RAISE EXCEPTION 'access denied to tenant %', p_tenant_id; END IF;

  v_pattern := CASE
    WHEN p_search IS NULL OR length(trim(p_search)) = 0 THEN NULL
    ELSE '%' || trim(p_search) || '%'
  END;

  SELECT count(*) INTO v_count
  FROM public.clients c
  WHERE c.tenant_id = p_tenant_id
    AND (p_type_adresse IS NULL OR c.type_adresse = p_type_adresse)
    AND (p_status IS NULL OR c.status = p_status)
    AND (p_canton IS NULL OR c.canton ILIKE p_canton)
    AND (p_city IS NULL OR c.city ILIKE '%' || p_city || '%')
    AND (p_postal_code IS NULL OR c.postal_code ILIKE p_postal_code || '%')
    AND (v_pattern IS NULL
      OR c.first_name   ILIKE v_pattern
      OR c.last_name    ILIKE v_pattern
      OR c.email        ILIKE v_pattern
      OR c.company_name ILIKE v_pattern
      OR c.phone        ILIKE v_pattern
    );

  RETURN v_count;
END $$;

GRANT EXECUTE ON FUNCTION public.count_clients_for_tenant(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- Index pour accélérer les filtres city / canton / postal_code
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_clients_tenant_city
  ON public.clients (tenant_id, city)
  WHERE city IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clients_tenant_canton
  ON public.clients (tenant_id, canton)
  WHERE canton IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clients_tenant_postal_code
  ON public.clients (tenant_id, postal_code)
  WHERE postal_code IS NOT NULL;

-- ============================================================================
-- RPC bonus : retourne les villes/cantons uniques pour les dropdowns autocomplete
-- ============================================================================
CREATE OR REPLACE FUNCTION public.distinct_client_locations(
  p_tenant_id UUID,
  p_type_adresse TEXT DEFAULT NULL
)
RETURNS TABLE (
  cities TEXT[],
  cantons TEXT[],
  postal_codes TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_has_access BOOLEAN;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  SELECT (
    public.is_king()
    OR EXISTS (
      SELECT 1 FROM public.user_tenant_assignments uta
      WHERE uta.user_id = v_user AND uta.tenant_id = p_tenant_id
    )
  ) INTO v_has_access;

  IF NOT v_has_access THEN RAISE EXCEPTION 'access denied'; END IF;

  RETURN QUERY
  SELECT
    ARRAY_AGG(DISTINCT c.city ORDER BY c.city) FILTER (WHERE c.city IS NOT NULL AND length(trim(c.city)) > 0) AS cities,
    ARRAY_AGG(DISTINCT c.canton ORDER BY c.canton) FILTER (WHERE c.canton IS NOT NULL AND length(trim(c.canton)) > 0) AS cantons,
    ARRAY_AGG(DISTINCT c.postal_code ORDER BY c.postal_code) FILTER (WHERE c.postal_code IS NOT NULL AND length(trim(c.postal_code)) > 0) AS postal_codes
  FROM public.clients c
  WHERE c.tenant_id = p_tenant_id
    AND (p_type_adresse IS NULL OR c.type_adresse = p_type_adresse);
END $$;

GRANT EXECUTE ON FUNCTION public.distinct_client_locations(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.count_clients_for_tenant(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) IS
  'Count clients par tenant avec filtres optionnels : type, search, city, canton, status, postal_code.';
COMMENT ON FUNCTION public.distinct_client_locations(UUID, TEXT) IS
  'Liste les villes/cantons/NPA uniques d''un tenant pour alimenter les dropdowns de filtre.';
