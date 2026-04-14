-- Make King SMS 2FA follow the platform-level switch.
-- When platform_settings.king_2fa_required is false, King users can log in
-- without being blocked by the SMS challenge.
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
  -- Prefer King when a user has multiple role rows.
  SELECT role::text INTO v_role
  FROM public.user_roles
  WHERE user_id = p_user_id
  ORDER BY CASE role::text
    WHEN 'king' THEN 1
    WHEN 'admin' THEN 2
    ELSE 3
  END
  LIMIT 1;

  v_role := COALESCE(v_role, 'client');

  SELECT t.slug, t.id INTO v_tenant_slug, v_tenant_id
  FROM public.user_tenant_assignments uta
  JOIN public.tenants t ON t.id = uta.tenant_id
  WHERE uta.user_id = p_user_id
  LIMIT 1;

  v_requires_sms := false;

  IF v_role = 'king' THEN
    SELECT COALESCE((value #>> '{}')::boolean, false) INTO v_requires_sms
    FROM public.platform_settings
    WHERE key = 'king_2fa_required';

    v_requires_sms := COALESCE(v_requires_sms, false);
  ELSIF v_tenant_id IS NOT NULL THEN
    SELECT COALESCE(tss.enable_2fa_login, false) INTO v_requires_sms
    FROM public.tenant_security_settings tss
    WHERE tss.tenant_id = v_tenant_id;

    v_requires_sms := COALESCE(v_requires_sms, false);
  END IF;

  SELECT COALESCE(p.phone, c.mobile, c.phone) INTO v_phone
  FROM public.profiles p
  LEFT JOIN public.clients c ON c.user_id = p.id
  WHERE p.id = p_user_id;

  v_result := jsonb_build_object(
    'role', v_role,
    'tenant_slug', v_tenant_slug,
    'requires_sms', v_requires_sms,
    'phone', v_phone
  );

  RETURN v_result;
END;
$$;
