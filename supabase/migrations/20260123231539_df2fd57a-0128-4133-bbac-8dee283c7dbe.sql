-- Expose only safe advisor fields to the authenticated client via a controlled function
CREATE OR REPLACE FUNCTION public.get_assigned_advisor_public()
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  email text,
  phone text,
  mobile text,
  photo_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT c.id, c.tenant_id, c.assigned_agent_id
    FROM public.clients c
    WHERE c.user_id = auth.uid()
    LIMIT 1
  )
  SELECT a.id, a.first_name, a.last_name, a.email, a.phone, a.mobile, a.photo_url
  FROM me
  JOIN public.clients a ON a.id = me.assigned_agent_id
  WHERE me.assigned_agent_id IS NOT NULL
    AND a.tenant_id = me.tenant_id;
$$;

REVOKE ALL ON FUNCTION public.get_assigned_advisor_public() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_assigned_advisor_public() TO authenticated;