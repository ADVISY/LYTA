-- ============================================================================
-- count_clients_for_tenant — ajout du paramètre search pour matcher le SELECT
-- ============================================================================
-- La barre de recherche front filtrait localement (50 rows visibles) → JCG
-- ne retrouvait pas ses contacts au-delà de la page courante. Fix : la
-- recherche est portée côté serveur (ilike sur first/last/email/company).
-- Le count doit appliquer le même filtre pour que la pagination soit juste.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.count_clients_for_tenant(
  p_tenant_id     UUID,
  p_type_adresse  TEXT DEFAULT NULL,
  p_search        TEXT DEFAULT NULL
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
    AND (v_pattern IS NULL
      OR c.first_name   ILIKE v_pattern
      OR c.last_name    ILIKE v_pattern
      OR c.email        ILIKE v_pattern
      OR c.company_name ILIKE v_pattern
      OR c.phone        ILIKE v_pattern
    );

  RETURN v_count;
END $$;

GRANT EXECUTE ON FUNCTION public.count_clients_for_tenant(UUID, TEXT, TEXT) TO authenticated;
