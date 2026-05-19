-- ============================================================================
-- Fix : 2 bugs critiques qui bloquent TOUS les scans Smartflow depuis le 17 mai
-- ============================================================================
-- Bug #1 (MAJEUR) : reserve_tenant_quota référence column period_start qui
-- n'existe pas (la vraie table tenant_consumption a period_year+period_month).
-- → CHAQUE scan plante avec "column period_start does not exist"
-- → quota.ts normalise en "Quota du cabinet atteint" (générique)
-- → tous les tenants impactés, pas juste Advisy
--
-- Bug #2 : tenant_limits a des lignes dupliquées (Advisy = 4 lignes).
-- → SELECT INTO sans STRICT prend une ligne au hasard → comportement chaotique
-- ============================================================================

-- ============ FIX #1 : reserve_tenant_quota avec colonnes correctes ============
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
  v_now TIMESTAMPTZ := now();
  v_period_year INT;
  v_period_month INT;
  v_auto_overage BOOLEAN;
  v_plan TEXT;
  v_overage_price INTEGER;
  v_overage_units INTEGER;
BEGIN
  IF p_tenant_id IS NULL OR p_amount <= 0 THEN RETURN; END IF;
  IF p_type NOT IN ('sms', 'email', 'ai_docs') THEN
    RAISE EXCEPTION 'Type quota invalide: %', p_type;
  END IF;

  v_period_year := EXTRACT(YEAR FROM v_now)::INT;
  v_period_month := EXTRACT(MONTH FROM v_now)::INT;

  -- Fetch tenant config (qualifier t. pour éviter l'ambiguïté column/variable)
  SELECT t.auto_overage_enabled, t.plan::TEXT INTO v_auto_overage, v_plan
    FROM public.tenants t WHERE t.id = p_tenant_id;

  -- S'assure qu'une ligne tenant_consumption existe pour ce mois (idempotent)
  INSERT INTO public.tenant_consumption (tenant_id, period_year, period_month, sms_used, email_used, ai_docs_used)
  VALUES (p_tenant_id, v_period_year, v_period_month, 0, 0, 0)
  ON CONFLICT (tenant_id, period_year, period_month) DO NOTHING;

  -- Récup limit + used pour ce type
  EXECUTE format('SELECT %I FROM public.tenant_limits WHERE tenant_id = $1 LIMIT 1', p_type || '_limit_monthly')
    INTO v_limit USING p_tenant_id;
  EXECUTE format(
    'SELECT %I FROM public.tenant_consumption WHERE tenant_id = $1 AND period_year = $2 AND period_month = $3',
    p_type || '_used'
  ) INTO v_used USING p_tenant_id, v_period_year, v_period_month;

  v_used := COALESCE(v_used, 0);
  v_limit := COALESCE(v_limit, 0);

  -- Check si dépassement
  IF v_used + p_amount > v_limit THEN
    IF NOT COALESCE(v_auto_overage, FALSE) THEN
      RAISE EXCEPTION 'Quota % atteint pour ce cabinet (%/%). Active l''overage auto ou upgrade ton plan.',
        p_type, v_used, v_limit;
    END IF;

    -- Overage : track event facturable (units en dépassement uniquement)
    v_overage_units := (v_used + p_amount) - v_limit;
    IF v_overage_units > 0 THEN
      -- Récup prix unitaire overage depuis plan_quotas
      SELECT overage_price_chf_cents INTO v_overage_price
        FROM public.plan_quotas
       WHERE plan_id = v_plan AND resource_type = p_type;

      INSERT INTO public.tenant_overage_events (
        tenant_id, resource_type, period_year, period_month,
        units, unit_price_chf_cents, status
      )
      VALUES (
        p_tenant_id, p_type, v_period_year, v_period_month,
        v_overage_units, COALESCE(v_overage_price, 20), 'pending'
      );
    END IF;
  END IF;

  -- Incrémente la consommation
  EXECUTE format(
    'UPDATE public.tenant_consumption SET %I = %I + $1, updated_at = now() WHERE tenant_id = $2 AND period_year = $3 AND period_month = $4',
    p_type || '_used', p_type || '_used'
  ) USING p_amount, p_tenant_id, v_period_year, v_period_month;
END $$;

GRANT EXECUTE ON FUNCTION public.reserve_tenant_quota(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_tenant_quota(UUID, TEXT, INTEGER) TO service_role;

-- ============ FIX #2 : Déduplique tenant_limits + UNIQUE constraint ============
WITH ranked AS (
  SELECT
    id,
    tenant_id,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id
      ORDER BY
        COALESCE(ai_docs_limit_monthly, 0) DESC,
        COALESCE(sms_limit_monthly, 0) DESC,
        COALESCE(email_limit_monthly, 0) DESC,
        updated_at DESC NULLS LAST
    ) AS rn
  FROM public.tenant_limits
)
DELETE FROM public.tenant_limits
 WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'tenant_limits_tenant_id_key'
       AND conrelid = 'public.tenant_limits'::regclass
  ) THEN
    ALTER TABLE public.tenant_limits
      ADD CONSTRAINT tenant_limits_tenant_id_key UNIQUE (tenant_id);
  END IF;
END $$;
