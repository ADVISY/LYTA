-- ============================================================================
-- Fix : ambiguïté column reference dans get_tenant_quota_usage
-- ============================================================================
-- Bug : la fonction déclare une colonne RETURNS TABLE 'auto_overage_enabled'
-- ce qui crée une variable PL/pgSQL implicite du même nom. Quand on fait
-- `SELECT auto_overage_enabled FROM public.tenants`, Postgres ne sait pas
-- si c'est la variable ou la colonne → ERROR 42702.
--
-- Effet visible : la fonction CRASH à chaque appel → widget tenant affiche
-- "Quota atteint" (interprétation par défaut de l'erreur RPC côté front).
--
-- Fix : qualifier le SELECT avec l'alias de table.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_tenant_quota_usage(p_tenant_id UUID DEFAULT NULL)
RETURNS TABLE (
  resource_type TEXT,
  used INT,
  monthly_limit INT,
  pct NUMERIC,
  overage_units INT,
  auto_overage_enabled BOOLEAN
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tenant UUID := COALESCE(p_tenant_id, public.get_user_tenant_id());
  v_auto BOOLEAN;
BEGIN
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'tenant required'; END IF;

  -- Fix : qualifier avec t.auto_overage_enabled pour lever l'ambiguïté avec la
  -- variable PL/pgSQL implicite de RETURNS TABLE.
  SELECT t.auto_overage_enabled INTO v_auto FROM public.tenants t WHERE t.id = v_tenant;

  RETURN QUERY
  SELECT
    'ai_docs'::TEXT,
    COALESCE(c.ai_docs_used, 0)::INT,
    COALESCE(l.ai_docs_limit_monthly, 0)::INT,
    CASE WHEN COALESCE(l.ai_docs_limit_monthly, 0) > 0
      THEN ROUND((c.ai_docs_used::NUMERIC / l.ai_docs_limit_monthly) * 100, 1)
      ELSE 0 END,
    GREATEST(0, COALESCE(c.ai_docs_used, 0) - COALESCE(l.ai_docs_limit_monthly, 0))::INT,
    v_auto
  FROM public.tenant_limits l
  LEFT JOIN public.tenant_consumption c ON c.tenant_id = l.tenant_id
  WHERE l.tenant_id = v_tenant

  UNION ALL
  SELECT 'sms'::TEXT, COALESCE(c.sms_used, 0)::INT, COALESCE(l.sms_limit_monthly, 0)::INT,
    CASE WHEN COALESCE(l.sms_limit_monthly, 0) > 0
      THEN ROUND((c.sms_used::NUMERIC / l.sms_limit_monthly) * 100, 1) ELSE 0 END,
    GREATEST(0, COALESCE(c.sms_used, 0) - COALESCE(l.sms_limit_monthly, 0))::INT,
    v_auto
  FROM public.tenant_limits l
  LEFT JOIN public.tenant_consumption c ON c.tenant_id = l.tenant_id
  WHERE l.tenant_id = v_tenant

  UNION ALL
  SELECT 'email'::TEXT, COALESCE(c.email_used, 0)::INT, COALESCE(l.email_limit_monthly, 0)::INT,
    CASE WHEN COALESCE(l.email_limit_monthly, 0) > 0
      THEN ROUND((c.email_used::NUMERIC / l.email_limit_monthly) * 100, 1) ELSE 0 END,
    GREATEST(0, COALESCE(c.email_used, 0) - COALESCE(l.email_limit_monthly, 0))::INT,
    v_auto
  FROM public.tenant_limits l
  LEFT JOIN public.tenant_consumption c ON c.tenant_id = l.tenant_id
  WHERE l.tenant_id = v_tenant;
END $$;

GRANT EXECUTE ON FUNCTION public.get_tenant_quota_usage(UUID) TO authenticated;
