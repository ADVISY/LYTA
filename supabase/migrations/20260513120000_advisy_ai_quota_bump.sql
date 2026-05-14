-- Bump Advisy's IA scan quota + reset the current month consumption.
-- Habib hit 48/50 while iterating on Smartflow today. Bumping to 500
-- gives plenty of room for the remaining tests + early production usage.

DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = 'advisy' LIMIT 1;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant advisy not found';
  END IF;

  -- Raise the monthly limit
  INSERT INTO public.tenant_limits (tenant_id, ai_docs_limit_monthly, ai_enabled)
  VALUES (v_tenant_id, 500, true)
  ON CONFLICT (tenant_id)
  DO UPDATE SET ai_docs_limit_monthly = 500, ai_enabled = true;

  -- Reset the current month's counter so Habib can retest immediately
  UPDATE public.tenant_consumption
  SET ai_docs_used = 0, updated_at = now()
  WHERE tenant_id = v_tenant_id
    AND period_year = EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
    AND period_month = EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER;

  RAISE NOTICE 'Advisy IA quota: 500/mois, compteur courant remis à 0';
END;
$$;
