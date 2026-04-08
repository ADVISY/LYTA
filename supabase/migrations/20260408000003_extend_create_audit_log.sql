DROP FUNCTION IF EXISTS public.create_audit_log(UUID, TEXT, TEXT, UUID, JSONB);

CREATE FUNCTION public.create_audit_log(
  p_user_id UUID,
  p_action TEXT,
  p_entity TEXT,
  p_entity_id UUID,
  p_metadata JSONB DEFAULT NULL,
  p_tenant_id UUID DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id BIGINT;
BEGIN
  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata, tenant_id)
  VALUES (p_user_id, p_action, p_entity, p_entity_id, p_metadata, p_tenant_id)
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_audit_log(UUID, TEXT, TEXT, UUID, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_audit_log(UUID, TEXT, TEXT, UUID, JSONB, UUID) TO service_role;
