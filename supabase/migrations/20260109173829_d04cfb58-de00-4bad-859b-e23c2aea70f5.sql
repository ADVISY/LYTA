
-- Update the requires_sms_verification function to reduce cache time for testing
-- and fix potential issues with role checking
CREATE OR REPLACE FUNCTION public.requires_sms_verification(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_last_verified timestamptz;
BEGIN
  -- Get user's role from user_roles table
  SELECT ur.role::text INTO v_role
  FROM user_roles ur
  WHERE ur.user_id = p_user_id
  LIMIT 1;
  
  -- Only require SMS verification for privileged roles (king, admin)
  IF v_role IS NULL OR v_role NOT IN ('king', 'admin') THEN
    RETURN false;
  END IF;
  
  -- Check if there's a successful verification in the last 30 minutes (reduced from 2 hours)
  SELECT verified_at INTO v_last_verified
  FROM sms_verifications
  WHERE user_id = p_user_id
    AND verification_type = 'login'
    AND verified_at IS NOT NULL
    AND verified_at > (now() - interval '30 minutes')
  ORDER BY verified_at DESC
  LIMIT 1;
  
  -- If verified within the window, no need for SMS
  IF v_last_verified IS NOT NULL THEN
    RETURN false;
  END IF;
  
  -- Require SMS verification for privileged roles without recent verification
  RETURN true;
END;
$$;
