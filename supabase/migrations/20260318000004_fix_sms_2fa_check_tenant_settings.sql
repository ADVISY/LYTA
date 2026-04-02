-- Fix: get_user_login_data should check tenant_security_settings.enable_2fa_login
-- instead of always requiring SMS verification
CREATE OR REPLACE FUNCTION public.get_user_login_data(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_role text;
  v_tenant_slug text;
  v_tenant_id uuid;
  v_requires_sms boolean;
  v_phone text;
BEGIN
  -- Get user role
  SELECT role::text INTO v_role
  FROM public.user_roles
  WHERE user_id = p_user_id
  LIMIT 1;

  -- Default to 'client' if no role found
  v_role := COALESCE(v_role, 'client');

  -- Get tenant slug and id via assignment
  SELECT t.slug, t.id INTO v_tenant_slug, v_tenant_id
  FROM public.user_tenant_assignments uta
  JOIN public.tenants t ON t.id = uta.tenant_id
  WHERE uta.user_id = p_user_id
  LIMIT 1;

  -- Check tenant security settings for 2FA requirement
  -- Default to false if no settings found
  v_requires_sms := FALSE;
  IF v_tenant_id IS NOT NULL THEN
    SELECT COALESCE(tss.enable_2fa_login, false) INTO v_requires_sms
    FROM public.tenant_security_settings tss
    WHERE tss.tenant_id = v_tenant_id;
  END IF;

  -- Get phone number: first try profiles.phone, then clients.mobile, then clients.phone
  SELECT COALESCE(p.phone, c.mobile, c.phone) INTO v_phone
  FROM public.profiles p
  LEFT JOIN public.clients c ON c.user_id = p.id
  WHERE p.id = p_user_id;

  -- Build result
  v_result := jsonb_build_object(
    'role', v_role,
    'tenant_slug', v_tenant_slug,
    'requires_sms', v_requires_sms,
    'phone', v_phone
  );

  RETURN v_result;
END;
$$;
