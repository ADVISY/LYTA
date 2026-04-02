-- Update get_user_login_data to also look for phone in clients table
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
  
  -- Get tenant slug via assignment
  SELECT t.slug INTO v_tenant_slug
  FROM public.user_tenant_assignments uta
  JOIN public.tenants t ON t.id = uta.tenant_id
  WHERE uta.user_id = p_user_id
  LIMIT 1;
  
  -- SECURITY: SMS verification required for ALL roles (including client)
  v_requires_sms := TRUE;
  
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