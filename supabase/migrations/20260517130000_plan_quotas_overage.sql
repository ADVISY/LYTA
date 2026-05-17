-- ============================================================================
-- Quotas par plan + overage auto via Stripe
-- ============================================================================

-- 1. Table plan_quotas (référence par plan)
CREATE TABLE IF NOT EXISTS public.plan_quotas (
  plan_id TEXT NOT NULL,
  resource_type TEXT NOT NULL
    CHECK (resource_type IN ('ai_docs', 'sms', 'email')),

  included_quantity INTEGER NOT NULL DEFAULT 0,
  overage_price_chf_cents INTEGER NOT NULL DEFAULT 0,    -- prix en centimes par unité
  stripe_overage_price_id TEXT,                          -- price metered Stripe (optionnel)

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (plan_id, resource_type)
);

COMMENT ON TABLE public.plan_quotas IS
  'Quotas mensuels inclus + prix overage (centimes CHF par unité) par plan et resource. SMS et emails systèmes ne sont pas comptés (seulement campagnes marketing).';

-- 2. Seed des quotas validés Habib (2026-05-17)
INSERT INTO public.plan_quotas (plan_id, resource_type, included_quantity, overage_price_chf_cents) VALUES
  ('start',    'ai_docs',  0,     0),
  ('start',    'sms',      0,     0),
  ('start',    'email',    0,     0),
  ('pro',      'ai_docs',  0,     0),
  ('pro',      'sms',      200,   20),
  ('pro',      'email',    2000,  0),  -- email overage : 0 ct (négligeable, gratuit pour Pro)
  ('prime',    'ai_docs',  400,   20),
  ('prime',    'sms',      400,   20),
  ('prime',    'email',    10000, 0),
  ('founder',  'ai_docs',  400,   20),
  ('founder',  'sms',      400,   20),
  ('founder',  'email',    10000, 0)
ON CONFLICT (plan_id, resource_type) DO UPDATE
  SET included_quantity = EXCLUDED.included_quantity,
      overage_price_chf_cents = EXCLUDED.overage_price_chf_cents,
      updated_at = now();

ALTER TABLE public.plan_quotas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS plan_quotas_read ON public.plan_quotas;
CREATE POLICY plan_quotas_read ON public.plan_quotas
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS plan_quotas_king_manage ON public.plan_quotas;
CREATE POLICY plan_quotas_king_manage ON public.plan_quotas
  FOR ALL TO authenticated
  USING (public.is_king()) WITH CHECK (public.is_king());

GRANT SELECT ON public.plan_quotas TO authenticated;
GRANT ALL ON public.plan_quotas TO service_role;

-- 3. Colonne auto_overage_enabled sur tenants (approche C : mix)
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS auto_overage_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tenants.auto_overage_enabled IS
  'Si TRUE : la consommation est autorisée au-delà du quota et facturée en fin de mois via Stripe invoice items. Si FALSE : bloqué dès quota atteint.';

-- Default = true pour les plans payants (Pro/Prime/Founder), false pour Start
UPDATE public.tenants SET auto_overage_enabled = true
WHERE plan IN ('pro', 'prime', 'founder')
  AND auto_overage_enabled = false;

-- 4. Table tenant_overage_events (1 row par event facturable)
CREATE TABLE IF NOT EXISTS public.tenant_overage_events (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('ai_docs', 'sms', 'email')),

  period_year INT NOT NULL,
  period_month INT NOT NULL,

  units INTEGER NOT NULL DEFAULT 1,
  unit_price_chf_cents INTEGER NOT NULL,
  total_amount_chf NUMERIC(10,2) GENERATED ALWAYS AS ((units * unit_price_chf_cents) / 100.0) STORED,

  -- Facturation Stripe
  stripe_invoice_item_id TEXT,
  invoiced_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'invoiced', 'cancelled')),

  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_overage_period
  ON public.tenant_overage_events(tenant_id, period_year, period_month, resource_type);
CREATE INDEX IF NOT EXISTS idx_tenant_overage_status
  ON public.tenant_overage_events(status, period_year, period_month);

ALTER TABLE public.tenant_overage_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS toe_king_select ON public.tenant_overage_events;
CREATE POLICY toe_king_select ON public.tenant_overage_events
  FOR SELECT TO authenticated USING (public.is_king());
GRANT SELECT ON public.tenant_overage_events TO authenticated;
GRANT ALL ON public.tenant_overage_events TO service_role;

-- 5. RPC sync_tenant_limits_from_plan : applique les quotas du plan au tenant
CREATE OR REPLACE FUNCTION public.sync_tenant_limits_from_plan(p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_plan TEXT;
  v_ai INTEGER; v_sms INTEGER; v_email INTEGER;
BEGIN
  SELECT plan::TEXT INTO v_plan FROM public.tenants WHERE id = p_tenant_id;
  IF v_plan IS NULL THEN RETURN; END IF;

  SELECT included_quantity INTO v_ai    FROM public.plan_quotas WHERE plan_id = v_plan AND resource_type = 'ai_docs';
  SELECT included_quantity INTO v_sms   FROM public.plan_quotas WHERE plan_id = v_plan AND resource_type = 'sms';
  SELECT included_quantity INTO v_email FROM public.plan_quotas WHERE plan_id = v_plan AND resource_type = 'email';

  INSERT INTO public.tenant_limits (tenant_id, sms_limit_monthly, email_limit_monthly, ai_docs_limit_monthly)
  VALUES (p_tenant_id, COALESCE(v_sms, 0), COALESCE(v_email, 0), COALESCE(v_ai, 0))
  ON CONFLICT (tenant_id) DO UPDATE SET
    sms_limit_monthly = COALESCE(v_sms, 0),
    email_limit_monthly = COALESCE(v_email, 0),
    ai_docs_limit_monthly = COALESCE(v_ai, 0),
    updated_at = now();
END $$;

GRANT EXECUTE ON FUNCTION public.sync_tenant_limits_from_plan(UUID) TO authenticated, service_role;

-- 6. Trigger : si plan change sur un tenant → resync limits
CREATE OR REPLACE FUNCTION public.trg_tenants_sync_quotas()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.plan IS DISTINCT FROM OLD.plan THEN
    PERFORM public.sync_tenant_limits_from_plan(NEW.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tenants_sync_quotas ON public.tenants;
CREATE TRIGGER tenants_sync_quotas
  AFTER UPDATE OF plan ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.trg_tenants_sync_quotas();

-- 7. Resync tous les tenants existants une fois pour aligner avec la nouvelle grille
DO $$
DECLARE r RECORD; v_count INT := 0;
BEGIN
  FOR r IN SELECT id FROM public.tenants WHERE plan IS NOT NULL LOOP
    PERFORM public.sync_tenant_limits_from_plan(r.id);
    v_count := v_count + 1;
  END LOOP;
  RAISE NOTICE 'Tenants resyncés avec nouvelle grille quotas : %', v_count;
END $$;

-- 8. Modifier reserve_tenant_quota pour gérer auto_overage_enabled
-- Si OFF → bloque comme avant
-- Si ON → autorise + crée un tenant_overage_event (status=pending)
-- DROP nécessaire car on garde la signature mais Postgres refuse les changements de body
-- si signature identique avec OR REPLACE selon contexte.
DROP FUNCTION IF EXISTS public.reserve_tenant_quota(UUID, TEXT, INTEGER);
CREATE OR REPLACE FUNCTION public.reserve_tenant_quota(
  p_tenant_id UUID,
  p_type TEXT,
  p_amount INTEGER
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_used INTEGER;
  v_limit INTEGER;
  v_period_start TIMESTAMPTZ;
  v_now TIMESTAMPTZ := now();
  v_auto_overage BOOLEAN;
  v_plan TEXT;
  v_overage_price INTEGER;
  v_overage_units INTEGER;
  v_period_year INT;
  v_period_month INT;
BEGIN
  IF p_tenant_id IS NULL OR p_amount <= 0 THEN RETURN; END IF;
  IF p_type NOT IN ('sms', 'email', 'ai_docs') THEN
    RAISE EXCEPTION 'Type quota invalide: %', p_type;
  END IF;

  v_period_year := EXTRACT(YEAR FROM v_now)::INT;
  v_period_month := EXTRACT(MONTH FROM v_now)::INT;

  -- Fetch limits + tenant config
  SELECT auto_overage_enabled, plan::TEXT INTO v_auto_overage, v_plan
  FROM public.tenants WHERE id = p_tenant_id;

  -- Reset consommation si nouveau mois
  SELECT period_start INTO v_period_start FROM public.tenant_consumption WHERE tenant_id = p_tenant_id;
  IF v_period_start IS NULL OR date_trunc('month', v_period_start) < date_trunc('month', v_now) THEN
    INSERT INTO public.tenant_consumption (tenant_id, period_start, sms_used, email_used, ai_docs_used)
    VALUES (p_tenant_id, date_trunc('month', v_now), 0, 0, 0)
    ON CONFLICT (tenant_id) DO UPDATE SET
      period_start = date_trunc('month', v_now),
      sms_used = 0, email_used = 0, ai_docs_used = 0, updated_at = v_now;
  END IF;

  -- Récup limit + used pour ce type
  EXECUTE format('SELECT %I FROM public.tenant_limits WHERE tenant_id = $1', p_type || '_limit_monthly')
    INTO v_limit USING p_tenant_id;
  EXECUTE format('SELECT %I FROM public.tenant_consumption WHERE tenant_id = $1', p_type || '_used')
    INTO v_used USING p_tenant_id;
  v_used := COALESCE(v_used, 0);
  v_limit := COALESCE(v_limit, 0);

  -- Check si dépassement
  IF v_used + p_amount > v_limit THEN
    -- Dépassement : soit overage soit bloque
    IF NOT v_auto_overage THEN
      RAISE EXCEPTION 'Quota % atteint pour ce cabinet (%/%). Active l''overage auto ou upgrade ton plan.',
        p_type, v_used, v_limit;
    END IF;

    -- Overage autorisé → on track l'event facturable (seulement les units en dépassement)
    v_overage_units := v_used + p_amount - GREATEST(v_used, v_limit);
    IF v_overage_units < 0 THEN v_overage_units := 0; END IF;

    SELECT overage_price_chf_cents INTO v_overage_price
    FROM public.plan_quotas WHERE plan_id = v_plan AND resource_type = p_type;

    IF COALESCE(v_overage_price, 0) > 0 AND v_overage_units > 0 THEN
      INSERT INTO public.tenant_overage_events (
        tenant_id, resource_type, period_year, period_month,
        units, unit_price_chf_cents, status
      ) VALUES (
        p_tenant_id, p_type, v_period_year, v_period_month,
        v_overage_units, v_overage_price, 'pending'
      );
    END IF;
  END IF;

  -- Incrémente le compteur (tout passe)
  EXECUTE format('UPDATE public.tenant_consumption SET %I = COALESCE(%I, 0) + $1, updated_at = $2 WHERE tenant_id = $3',
                 p_type || '_used', p_type || '_used')
  USING p_amount, v_now, p_tenant_id;
END $$;

GRANT EXECUTE ON FUNCTION public.reserve_tenant_quota(UUID, TEXT, INTEGER) TO authenticated, service_role;
