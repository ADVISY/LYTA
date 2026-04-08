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
    RAISE EXCEPTION 'Quota de stockage depasse pour ce cabinet (%/% Go).', v_next_used_gb, ROUND(v_limit_gb, 2);
  END IF;

  RETURN NEW;
END;
$$;
