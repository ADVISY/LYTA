-- Fix admin tenant access for support@loopus.tech
DO $$
DECLARE
  v_user_id uuid;
  v_tenant_id uuid;
  v_admin_role_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'support@loopus.tech';
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'loopus-test';

  IF v_user_id IS NULL OR v_tenant_id IS NULL THEN
    RAISE NOTICE 'User or tenant not found, user=%, tenant=%', v_user_id, v_tenant_id;
    RETURN;
  END IF;

  -- Ensure assignment exists with is_platform_admin
  INSERT INTO user_tenant_assignments (user_id, tenant_id, is_platform_admin)
  VALUES (v_user_id, v_tenant_id, true)
  ON CONFLICT DO NOTHING;

  UPDATE user_tenant_assignments
  SET is_platform_admin = true
  WHERE user_id = v_user_id AND tenant_id = v_tenant_id;

  -- Get or create admin role for tenant
  SELECT id INTO v_admin_role_id FROM tenant_roles
  WHERE tenant_id = v_tenant_id AND name = 'admin'
  LIMIT 1;

  IF v_admin_role_id IS NULL THEN
    INSERT INTO tenant_roles (tenant_id, name, description)
    VALUES (v_tenant_id, 'admin', 'Administrateur du cabinet')
    RETURNING id INTO v_admin_role_id;
  END IF;

  -- Assign admin role
  INSERT INTO user_tenant_roles (user_id, role_id, tenant_id)
  VALUES (v_user_id, v_admin_role_id, v_tenant_id)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Done: user=%, tenant=%, role=%', v_user_id, v_tenant_id, v_admin_role_id;
END;
$$;
