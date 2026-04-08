CREATE OR REPLACE FUNCTION public.reserve_tenant_quota(
  p_tenant_id UUID,
  p_type TEXT,
  p_amount INTEGER DEFAULT 1
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
  v_month INTEGER := EXTRACT(MONTH FROM CURRENT_DATE);
  v_limits public.tenant_limits%ROWTYPE;
  v_consumption public.tenant_consumption%ROWTYPE;
  v_limit_value INTEGER;
  v_used_value INTEGER;
BEGIN
  IF p_tenant_id IS NULL OR p_amount IS NULL OR p_amount <= 0 THEN
    RETURN TRUE;
  END IF;

  PERFORM public.get_or_create_tenant_consumption(p_tenant_id);

  INSERT INTO public.tenant_limits (tenant_id)
  VALUES (p_tenant_id)
  ON CONFLICT (tenant_id) DO NOTHING;

  SELECT *
  INTO v_limits
  FROM public.tenant_limits
  WHERE tenant_id = p_tenant_id;

  SELECT *
  INTO v_consumption
  FROM public.tenant_consumption
  WHERE tenant_id = p_tenant_id
    AND period_year = v_year
    AND period_month = v_month
  FOR UPDATE;

  IF p_type = 'sms' THEN
    v_limit_value := COALESCE(v_limits.sms_limit_monthly, 0);
    v_used_value := COALESCE(v_consumption.sms_used, 0);

    IF v_used_value + p_amount > v_limit_value THEN
      RAISE EXCEPTION 'Quota SMS mensuel atteint pour ce cabinet (%/%).', v_used_value, v_limit_value;
    END IF;

    UPDATE public.tenant_consumption
    SET sms_used = sms_used + p_amount,
        updated_at = now()
    WHERE id = v_consumption.id;
  ELSIF p_type = 'email' THEN
    v_limit_value := COALESCE(v_limits.email_limit_monthly, 0);
    v_used_value := COALESCE(v_consumption.email_used, 0);

    IF v_used_value + p_amount > v_limit_value THEN
      RAISE EXCEPTION 'Quota email mensuel atteint pour ce cabinet (%/%).', v_used_value, v_limit_value;
    END IF;

    UPDATE public.tenant_consumption
    SET email_used = email_used + p_amount,
        updated_at = now()
    WHERE id = v_consumption.id;
  ELSIF p_type = 'ai_docs' THEN
    IF COALESCE(v_limits.ai_enabled, true) = false THEN
      RAISE EXCEPTION 'Le scan IA est desactive pour ce cabinet.';
    END IF;

    v_limit_value := COALESCE(v_limits.ai_docs_limit_monthly, 0);
    v_used_value := COALESCE(v_consumption.ai_docs_used, 0);

    IF v_used_value + p_amount > v_limit_value THEN
      RAISE EXCEPTION 'Quota IA mensuel atteint pour ce cabinet (%/%).', v_used_value, v_limit_value;
    END IF;

    UPDATE public.tenant_consumption
    SET ai_docs_used = ai_docs_used + p_amount,
        updated_at = now()
    WHERE id = v_consumption.id;
  ELSE
    RAISE EXCEPTION 'Type de quota non supporte: %', p_type;
  END IF;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_tenant_quota(
  p_tenant_id UUID,
  p_type TEXT,
  p_amount INTEGER DEFAULT 1
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
  v_month INTEGER := EXTRACT(MONTH FROM CURRENT_DATE);
BEGIN
  IF p_tenant_id IS NULL OR p_amount IS NULL OR p_amount <= 0 THEN
    RETURN TRUE;
  END IF;

  PERFORM public.get_or_create_tenant_consumption(p_tenant_id);

  IF p_type = 'sms' THEN
    UPDATE public.tenant_consumption
    SET sms_used = GREATEST(0, sms_used - p_amount),
        updated_at = now()
    WHERE tenant_id = p_tenant_id
      AND period_year = v_year
      AND period_month = v_month;
  ELSIF p_type = 'email' THEN
    UPDATE public.tenant_consumption
    SET email_used = GREATEST(0, email_used - p_amount),
        updated_at = now()
    WHERE tenant_id = p_tenant_id
      AND period_year = v_year
      AND period_month = v_month;
  ELSIF p_type = 'ai_docs' THEN
    UPDATE public.tenant_consumption
    SET ai_docs_used = GREATEST(0, ai_docs_used - p_amount),
        updated_at = now()
    WHERE tenant_id = p_tenant_id
      AND period_year = v_year
      AND period_month = v_month;
  ELSE
    RAISE EXCEPTION 'Type de quota non supporte: %', p_type;
  END IF;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_tenant_quota(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_tenant_quota(UUID, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_tenant_quota(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_tenant_quota(UUID, TEXT, INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_tenant_active_users_from_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.tenant_id IS NOT NULL THEN
    PERFORM public.get_or_create_tenant_consumption(NEW.tenant_id);
  END IF;

  IF TG_OP IN ('DELETE', 'UPDATE')
     AND OLD.tenant_id IS NOT NULL
     AND (TG_OP = 'DELETE' OR OLD.tenant_id IS DISTINCT FROM NEW.tenant_id) THEN
    PERFORM public.get_or_create_tenant_consumption(OLD.tenant_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_tenant_active_users_on_assignment_change ON public.user_tenant_assignments;

CREATE TRIGGER trg_refresh_tenant_active_users_on_assignment_change
AFTER INSERT OR UPDATE OR DELETE ON public.user_tenant_assignments
FOR EACH ROW
EXECUTE FUNCTION public.refresh_tenant_active_users_from_assignment();

CREATE OR REPLACE FUNCTION public.enforce_tenant_storage_limit_on_document_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_limit_gb NUMERIC(10, 2);
  v_limit_bytes NUMERIC;
  v_current_bytes BIGINT;
  v_next_bytes BIGINT;
  v_next_used_gb NUMERIC(10, 2);
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  v_tenant_id := NEW.tenant_id;

  IF v_tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.tenant_limits (tenant_id)
  VALUES (v_tenant_id)
  ON CONFLICT (tenant_id) DO NOTHING;

  SELECT COALESCE(storage_limit_gb, 5.00)
  INTO v_limit_gb
  FROM public.tenant_limits
  WHERE tenant_id = v_tenant_id;

  v_limit_bytes := GREATEST(0, COALESCE(v_limit_gb, 0) * 1024 * 1024 * 1024);

  SELECT COALESCE(SUM(d.size_bytes), 0)
  INTO v_current_bytes
  FROM public.documents d
  WHERE d.tenant_id = v_tenant_id
    AND (TG_OP <> 'UPDATE' OR d.id <> NEW.id);

  v_next_bytes := v_current_bytes + COALESCE(NEW.size_bytes, 0);

  IF v_next_bytes > v_limit_bytes THEN
    v_next_used_gb := ROUND((v_next_bytes::NUMERIC / (1024 * 1024 * 1024)), 2);
    RAISE EXCEPTION 'Quota de stockage depasse pour ce cabinet (%.2f/%.2f Go).', v_next_used_gb, v_limit_gb;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_tenant_storage_limit_on_document_change ON public.documents;

CREATE TRIGGER trg_enforce_tenant_storage_limit_on_document_change
BEFORE INSERT OR UPDATE OF size_bytes, tenant_id ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.enforce_tenant_storage_limit_on_document_change();
