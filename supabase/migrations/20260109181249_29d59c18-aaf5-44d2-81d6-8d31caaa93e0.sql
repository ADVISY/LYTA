-- Create a single RPC function that returns all login data in ONE call
-- This eliminates multiple round trips and makes login instant

CREATE OR REPLACE FUNCTION public.get_user_login_data(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
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
  
  -- Check if SMS verification is required (king or admin roles)
  v_requires_sms := v_role IN ('king', 'admin');
  
  -- Get phone number from profile if SMS is required
  IF v_requires_sms THEN
    SELECT phone INTO v_phone
    FROM public.profiles
    WHERE id = p_user_id;
  END IF;
  
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_login_data(uuid) TO authenticated;