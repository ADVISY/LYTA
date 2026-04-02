-- Fix SMS gate: only require SMS for privileged roles when no recent successful verification exists
CREATE OR REPLACE FUNCTION public.requires_sms_verification(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH is_privileged AS (
    SELECT EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = p_user_id
        AND role IN ('king', 'admin')
    ) AS v
  ),
  has_recent_verification AS (
    SELECT EXISTS (
      SELECT 1
      FROM public.sms_verifications
      WHERE user_id = p_user_id
        AND verification_type = 'login'
        AND verified_at IS NOT NULL
        AND verified_at > (now() - interval '12 hours')
    ) AS v
  )
  SELECT (SELECT v FROM is_privileged)
     AND NOT (SELECT v FROM has_recent_verification);
$$;

-- Performance: speed up lookup of recent verifications
CREATE INDEX IF NOT EXISTS idx_sms_verifications_user_type_verified_at
ON public.sms_verifications (user_id, verification_type, verified_at);
