-- ============================================================================
-- count_clients_for_tenant — ajout filtre p_assigned_agent
-- ============================================================================
-- Pour le filtre "Sans agent" et la sélection par agent assigné dans la
-- liste Adresses. Le compteur doit refléter ce filtre, sinon les totaux
-- affichés à côté de la pagination sont incohérents.
--
-- Valeurs acceptées :
--   - NULL          → pas de filtre
--   - 'unassigned'  → assigned_agent_id IS NULL
--   - <UUID>        → assigned_agent_id = <UUID> (fiche collaborateur)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.count_clients_for_tenant(
  p_tenant_id uuid,
  p_type_adresse text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_canton text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_postal_code text DEFAULT NULL,
  p_is_company boolean DEFAULT NULL,
  p_assigned_agent text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_search_pattern text;
  v_agent_uuid uuid;
BEGIN
  v_search_pattern := CASE
    WHEN p_search IS NULL OR length(trim(p_search)) = 0 THEN NULL
    ELSE '%' || regexp_replace(p_search, '[%,()]', ' ', 'g') || '%'
  END;

  -- Parse UUID si p_assigned_agent ressemble à un UUID (sinon on traite
  -- comme keyword 'unassigned' ou aucun filtre).
  BEGIN
    v_agent_uuid := CASE
      WHEN p_assigned_agent IS NULL THEN NULL
      WHEN p_assigned_agent = 'unassigned' THEN NULL
      ELSE p_assigned_agent::uuid
    END;
  EXCEPTION WHEN invalid_text_representation THEN
    v_agent_uuid := NULL;
  END;

  SELECT COUNT(*) INTO v_count
  FROM public.clients c
  WHERE c.tenant_id = p_tenant_id
    AND (p_type_adresse IS NULL OR c.type_adresse = p_type_adresse)
    AND (p_status       IS NULL OR c.status       = p_status)
    AND (p_canton       IS NULL OR c.canton ILIKE p_canton)
    AND (p_city         IS NULL OR c.city ILIKE '%' || p_city || '%')
    AND (p_postal_code  IS NULL OR c.postal_code ILIKE p_postal_code || '%')
    AND (
      p_is_company IS NULL
      OR (p_is_company = true  AND c.is_company = true)
      OR (p_is_company = false AND (c.is_company = false OR c.is_company IS NULL))
    )
    AND (
      p_assigned_agent IS NULL
      OR (p_assigned_agent = 'unassigned' AND c.assigned_agent_id IS NULL)
      OR (v_agent_uuid IS NOT NULL AND c.assigned_agent_id = v_agent_uuid)
    )
    AND (
      v_search_pattern IS NULL
      OR c.first_name   ILIKE v_search_pattern
      OR c.last_name    ILIKE v_search_pattern
      OR c.email        ILIKE v_search_pattern
      OR c.company_name ILIKE v_search_pattern
      OR c.phone        ILIKE v_search_pattern
    );

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.count_clients_for_tenant(uuid, text, text, text, text, text, text, boolean, text) TO authenticated;
