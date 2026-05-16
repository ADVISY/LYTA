-- ============================================================================
-- Phase 5 — Monitoring santé + vue cross-tenant globale
-- ============================================================================

-- Vue agrégée des incidents (basée sur king_notifications kind = 'sync_ambiguous',
-- 'payment_failed', etc. + edge_function_errors si existe).
-- Pour Health, on utilise pour l'instant king_notifications + on prépare un
-- compteur d'événements par type.

-- Cross-tenant clients
CREATE OR REPLACE FUNCTION public.list_all_clients_cross_tenant(
  p_search TEXT DEFAULT NULL,
  p_tenant_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 100,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  tenant_name TEXT,
  first_name TEXT,
  last_name TEXT,
  company_name TEXT,
  email TEXT,
  phone TEXT,
  type_adresse TEXT,
  status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_pattern TEXT;
BEGIN
  IF NOT public.is_king() THEN RAISE EXCEPTION 'king required'; END IF;
  v_pattern := CASE WHEN p_search IS NULL OR length(trim(p_search)) = 0 THEN NULL
                    ELSE '%' || trim(p_search) || '%' END;

  RETURN QUERY
  SELECT
    c.id, c.tenant_id, t.name::TEXT,
    c.first_name::TEXT, c.last_name::TEXT, c.company_name::TEXT,
    c.email::TEXT, c.phone::TEXT, c.type_adresse::TEXT,
    c.status::TEXT, c.created_at
  FROM public.clients c
  LEFT JOIN public.tenants t ON t.id = c.tenant_id
  WHERE (p_tenant_id IS NULL OR c.tenant_id = p_tenant_id)
    AND (v_pattern IS NULL
      OR c.first_name   ILIKE v_pattern
      OR c.last_name    ILIKE v_pattern
      OR c.email        ILIKE v_pattern
      OR c.company_name ILIKE v_pattern
      OR c.phone        ILIKE v_pattern)
  ORDER BY c.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END $$;

GRANT EXECUTE ON FUNCTION public.list_all_clients_cross_tenant(TEXT, UUID, INT, INT) TO authenticated;

-- Cross-tenant policies
CREATE OR REPLACE FUNCTION public.list_all_policies_cross_tenant(
  p_search TEXT DEFAULT NULL,
  p_tenant_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 100,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  tenant_name TEXT,
  client_id UUID,
  client_name TEXT,
  policy_number TEXT,
  category TEXT,
  premium_amount NUMERIC,
  premium_frequency TEXT,
  signature_status TEXT,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_pattern TEXT;
BEGIN
  IF NOT public.is_king() THEN RAISE EXCEPTION 'king required'; END IF;
  v_pattern := CASE WHEN p_search IS NULL OR length(trim(p_search)) = 0 THEN NULL
                    ELSE '%' || trim(p_search) || '%' END;

  RETURN QUERY
  SELECT
    p.id, p.tenant_id, t.name::TEXT,
    p.client_id,
    (COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, COALESCE(c.company_name, '')))::TEXT,
    p.policy_number::TEXT,
    p.category::TEXT,
    p.premium_amount::NUMERIC,
    p.premium_frequency::TEXT,
    p.signature_status::TEXT,
    p.start_date, p.end_date, p.created_at
  FROM public.policies p
  LEFT JOIN public.tenants t ON t.id = p.tenant_id
  LEFT JOIN public.clients c ON c.id = p.client_id
  WHERE (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
    AND (v_pattern IS NULL
      OR p.policy_number ILIKE v_pattern
      OR c.first_name    ILIKE v_pattern
      OR c.last_name     ILIKE v_pattern
      OR c.company_name  ILIKE v_pattern)
  ORDER BY p.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END $$;

GRANT EXECUTE ON FUNCTION public.list_all_policies_cross_tenant(TEXT, UUID, INT, INT) TO authenticated;

-- Health summary : agrège les notifs king d'erreur des dernières 24h
CREATE OR REPLACE FUNCTION public.get_health_summary()
RETURNS TABLE (
  kind TEXT,
  count_24h BIGINT,
  count_7d BIGINT,
  last_at TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_king() THEN RAISE EXCEPTION 'king required'; END IF;
  RETURN QUERY
  SELECT
    n.kind::TEXT,
    count(*) FILTER (WHERE n.created_at >= now() - INTERVAL '24 hours')::BIGINT,
    count(*) FILTER (WHERE n.created_at >= now() - INTERVAL '7 days')::BIGINT,
    max(n.created_at)
  FROM public.king_notifications n
  WHERE n.created_at >= now() - INTERVAL '7 days'
    AND (n.priority IN ('high', 'urgent')
      OR n.kind ILIKE '%error%'
      OR n.kind ILIKE '%fail%'
      OR n.kind ILIKE '%ambiguous%')
  GROUP BY n.kind
  ORDER BY 2 DESC, 3 DESC;
END $$;

GRANT EXECUTE ON FUNCTION public.get_health_summary() TO authenticated;
