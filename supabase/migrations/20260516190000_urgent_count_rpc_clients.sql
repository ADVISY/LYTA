-- ============================================================================
-- URGENT — Bypass RLS pour le count clients (timeout 8s atteint)
-- ============================================================================
-- "canceling statement due to statement timeout" → Postgres tue la query à
-- 8s (statement_timeout par défaut PostgREST). count: "exact" + 3 EXISTS du
-- RLS clients dépasse ce timeout sur 1000+ rows même avec indexes.
--
-- Fix double :
-- 1. RPC SECURITY DEFINER `count_clients_for_tenant` : retourne le count
--    instantanément en bypass RLS, après vérification d'accès au tenant.
-- 2. Augmenter le statement_timeout du rôle authenticated à 30s en filet.
-- ============================================================================

-- 1. Augmenter le timeout au cas où d'autres queries sont concernées
ALTER ROLE authenticated SET statement_timeout = '30s';
ALTER ROLE anon SET statement_timeout = '30s';
NOTIFY pgrst, 'reload config';

-- 2. RPC count rapide qui bypass le RLS
CREATE OR REPLACE FUNCTION public.count_clients_for_tenant(
  p_tenant_id UUID,
  p_type_adresse TEXT DEFAULT NULL
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
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  -- Vérification d'accès au tenant (équivalent du RLS clients SELECT)
  SELECT (
    public.is_king()
    OR EXISTS (
      SELECT 1 FROM public.user_tenant_assignments uta
      WHERE uta.user_id = v_user AND uta.tenant_id = p_tenant_id
    )
    OR EXISTS (
      SELECT 1 FROM public.user_tenant_roles utr
      JOIN public.tenant_roles tr ON tr.id = utr.role_id
      WHERE utr.user_id = v_user
        AND tr.tenant_id = p_tenant_id
        AND tr.is_active = true
    )
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'access denied to tenant %', p_tenant_id;
  END IF;

  -- Count direct sans RLS (l'accès est déjà vérifié)
  IF p_type_adresse IS NOT NULL THEN
    SELECT count(*) INTO v_count FROM public.clients
    WHERE tenant_id = p_tenant_id AND type_adresse = p_type_adresse;
  ELSE
    SELECT count(*) INTO v_count FROM public.clients
    WHERE tenant_id = p_tenant_id;
  END IF;

  RETURN v_count;
END $$;

GRANT EXECUTE ON FUNCTION public.count_clients_for_tenant(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.count_clients_for_tenant IS
  'Count rapide des clients d''un tenant (bypass RLS via SECURITY DEFINER). Vérifie l''accès au tenant avant. Utilisé par useClients pour éviter le timeout RLS 8s sur les gros tenants.';
