-- ============================================================================
-- affiliates.ref_code — code court partagable (ex: HABIB, ALEX, ...)
-- pour les liens lyta.ch?ref=CODE
-- ============================================================================

ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS ref_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_affiliates_ref_code
  ON public.affiliates(lower(ref_code))
  WHERE ref_code IS NOT NULL;

COMMENT ON COLUMN public.affiliates.ref_code IS
  'Code court partagable (3-30 chars alphanum). Utilisé dans les liens public lyta.ch?ref=CODE pour tracker les signups.';

-- Période d'éligibilité par défaut : 12 mois
ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS default_eligibility_months INT NOT NULL DEFAULT 12
    CHECK (default_eligibility_months > 0 AND default_eligibility_months <= 60);

-- ============================================================================
-- RPC : génère un PDF data pour facture affilié mensuelle
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_affiliate_invoice_data(
  p_affiliate_id UUID,
  p_period_start TIMESTAMPTZ,
  p_period_end   TIMESTAMPTZ
)
RETURNS TABLE (
  affiliate_id UUID,
  affiliate_name TEXT,
  affiliate_email TEXT,
  period_start TIMESTAMPTZ,
  period_end   TIMESTAMPTZ,
  commission_id UUID,
  tenant_id UUID,
  tenant_name TEXT,
  payment_id TEXT,
  payment_date TIMESTAMPTZ,
  payment_amount NUMERIC,
  commission_rate NUMERIC,
  commission_amount NUMERIC,
  status TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_king() THEN RAISE EXCEPTION 'king required'; END IF;

  RETURN QUERY
  SELECT
    a.id,
    (a.first_name || ' ' || a.last_name)::TEXT,
    a.email::TEXT,
    p_period_start,
    p_period_end,
    ac.id,
    ac.tenant_id,
    t.name::TEXT,
    ac.payment_id::TEXT,
    ac.payment_date,
    ac.payment_amount,
    ac.commission_rate,
    ac.commission_amount,
    ac.status::TEXT
  FROM public.affiliates a
  LEFT JOIN public.affiliate_commissions ac ON ac.affiliate_id = a.id
    AND ac.payment_date >= p_period_start
    AND ac.payment_date <  p_period_end
    AND ac.status IN ('due', 'paid')
  LEFT JOIN public.tenants t ON t.id = ac.tenant_id
  WHERE a.id = p_affiliate_id
  ORDER BY ac.payment_date ASC;
END $$;

GRANT EXECUTE ON FUNCTION public.get_affiliate_invoice_data(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ============================================================================
-- RPC : marquer toutes les commissions due d'un affilié sur une période = paid
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mark_affiliate_commissions_paid(
  p_affiliate_id UUID,
  p_period_start TIMESTAMPTZ,
  p_period_end   TIMESTAMPTZ,
  p_notes        TEXT DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_count INT;
BEGIN
  IF NOT public.is_king() THEN RAISE EXCEPTION 'king required'; END IF;

  UPDATE public.affiliate_commissions
  SET status = 'paid',
      paid_at = now(),
      notes = COALESCE(notes, '') || CASE WHEN p_notes IS NOT NULL THEN E'\n' || p_notes ELSE '' END,
      updated_at = now()
  WHERE affiliate_id = p_affiliate_id
    AND payment_date >= p_period_start
    AND payment_date <  p_period_end
    AND status = 'due';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

GRANT EXECUTE ON FUNCTION public.mark_affiliate_commissions_paid(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated;
