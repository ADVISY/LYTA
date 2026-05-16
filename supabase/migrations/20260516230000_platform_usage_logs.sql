-- ============================================================================
-- platform_usage_logs — tracker tous les appels facturés par provider
-- ============================================================================
-- Permet de calculer en temps réel la marge LYTA (MRR - coûts) en agrégeant
-- les usages OpenAI, Resend, Twilio, etc. par mois / par tenant / par provider.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.platform_usage_logs (
  id BIGSERIAL PRIMARY KEY,

  provider TEXT NOT NULL
    CHECK (provider IN ('openai', 'resend', 'twilio', 'supabase', 'vercel', 'cloudflare', 'stripe')),
  event_type TEXT NOT NULL,        -- 'chat_completion', 'email_sent', 'sms_sent', 'storage_gb_month', ...
  model TEXT,                       -- 'gpt-5', 'gpt-5-mini', etc. (NULL si pas applicable)

  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,

  -- Volumes (au moins un des deux selon le provider)
  input_units BIGINT,               -- ex: tokens input, emails envoyés, sms envoyés
  output_units BIGINT,              -- ex: tokens output (pour LLM)

  -- Coût en CHF (calculé à l'insert selon la grille tarifaire)
  cost_chf NUMERIC(12,6) NOT NULL DEFAULT 0,

  -- Contexte facultatif
  external_ref TEXT,                -- ex: openai request_id, resend email_id
  metadata JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_usage_logs_period
  ON public.platform_usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_usage_logs_provider_period
  ON public.platform_usage_logs(provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_usage_logs_tenant
  ON public.platform_usage_logs(tenant_id, created_at DESC) WHERE tenant_id IS NOT NULL;

COMMENT ON TABLE public.platform_usage_logs IS
  'Trace tous les appels facturés (OpenAI tokens, Resend emails, Twilio SMS, ...) avec leur coût en CHF. Utilisé par KingCosts pour pilotage marge.';

-- RLS : king-only
ALTER TABLE public.platform_usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pul_king_select ON public.platform_usage_logs;
CREATE POLICY pul_king_select ON public.platform_usage_logs
  FOR SELECT TO authenticated
  USING (public.is_king());

DROP POLICY IF EXISTS pul_service_insert ON public.platform_usage_logs;
CREATE POLICY pul_service_insert ON public.platform_usage_logs
  FOR INSERT TO service_role
  WITH CHECK (true);

GRANT SELECT ON public.platform_usage_logs TO authenticated;
GRANT INSERT ON public.platform_usage_logs TO service_role;

-- ============================================================================
-- RPC get_platform_costs_summary — agrégats pour KingCosts
-- ============================================================================
-- Retourne le coût par provider sur une période donnée (par défaut mois courant).
-- Top tenants consommateurs, par provider.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_platform_costs_summary(
  p_from TIMESTAMPTZ DEFAULT date_trunc('month', now()),
  p_to   TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
  provider     TEXT,
  total_cost_chf NUMERIC,
  event_count  BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_king() THEN RAISE EXCEPTION 'king required'; END IF;
  RETURN QUERY
  SELECT
    l.provider::TEXT,
    SUM(l.cost_chf)::NUMERIC,
    count(*)::BIGINT
  FROM public.platform_usage_logs l
  WHERE l.created_at >= p_from AND l.created_at < p_to
  GROUP BY l.provider
  ORDER BY 2 DESC;
END $$;

GRANT EXECUTE ON FUNCTION public.get_platform_costs_summary(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- Top tenants par coût pour une période
CREATE OR REPLACE FUNCTION public.get_top_tenants_by_cost(
  p_from TIMESTAMPTZ DEFAULT date_trunc('month', now()),
  p_to   TIMESTAMPTZ DEFAULT now(),
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  tenant_id      UUID,
  tenant_name    TEXT,
  total_cost_chf NUMERIC,
  openai_cost_chf NUMERIC,
  resend_cost_chf NUMERIC,
  twilio_cost_chf NUMERIC,
  event_count    BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_king() THEN RAISE EXCEPTION 'king required'; END IF;
  RETURN QUERY
  SELECT
    t.id,
    t.name::TEXT,
    COALESCE(SUM(l.cost_chf), 0)::NUMERIC,
    COALESCE(SUM(l.cost_chf) FILTER (WHERE l.provider = 'openai'), 0)::NUMERIC,
    COALESCE(SUM(l.cost_chf) FILTER (WHERE l.provider = 'resend'), 0)::NUMERIC,
    COALESCE(SUM(l.cost_chf) FILTER (WHERE l.provider = 'twilio'), 0)::NUMERIC,
    count(l.id)::BIGINT
  FROM public.tenants t
  LEFT JOIN public.platform_usage_logs l
    ON l.tenant_id = t.id AND l.created_at >= p_from AND l.created_at < p_to
  GROUP BY t.id, t.name
  HAVING COALESCE(SUM(l.cost_chf), 0) > 0
  ORDER BY 3 DESC
  LIMIT p_limit;
END $$;

GRANT EXECUTE ON FUNCTION public.get_top_tenants_by_cost(TIMESTAMPTZ, TIMESTAMPTZ, INT) TO authenticated;

-- Évolution mensuelle des coûts (12 mois glissants)
CREATE OR REPLACE FUNCTION public.get_platform_costs_monthly()
RETURNS TABLE (
  month_iso TEXT,
  openai_cost_chf NUMERIC,
  resend_cost_chf NUMERIC,
  twilio_cost_chf NUMERIC,
  other_cost_chf NUMERIC,
  total_cost_chf NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_king() THEN RAISE EXCEPTION 'king required'; END IF;
  RETURN QUERY
  WITH months AS (
    SELECT generate_series(
      date_trunc('month', now()) - INTERVAL '11 months',
      date_trunc('month', now()),
      INTERVAL '1 month'
    ) AS m
  )
  SELECT
    to_char(m.m, 'YYYY-MM')::TEXT,
    COALESCE(SUM(l.cost_chf) FILTER (WHERE l.provider = 'openai'), 0)::NUMERIC,
    COALESCE(SUM(l.cost_chf) FILTER (WHERE l.provider = 'resend'), 0)::NUMERIC,
    COALESCE(SUM(l.cost_chf) FILTER (WHERE l.provider = 'twilio'), 0)::NUMERIC,
    COALESCE(SUM(l.cost_chf) FILTER (WHERE l.provider NOT IN ('openai','resend','twilio')), 0)::NUMERIC,
    COALESCE(SUM(l.cost_chf), 0)::NUMERIC
  FROM months m
  LEFT JOIN public.platform_usage_logs l
    ON l.created_at >= m.m
   AND l.created_at < m.m + INTERVAL '1 month'
  GROUP BY m.m
  ORDER BY m.m;
END $$;

GRANT EXECUTE ON FUNCTION public.get_platform_costs_monthly() TO authenticated;
