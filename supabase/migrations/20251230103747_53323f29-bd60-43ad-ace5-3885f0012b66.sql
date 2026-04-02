-- Create a public function to get tenant branding by slug (for login page)
-- This function bypasses RLS and only returns public branding info
CREATE OR REPLACE FUNCTION public.get_tenant_branding_by_slug(p_slug text)
RETURNS TABLE (
  tenant_id uuid,
  tenant_name text,
  tenant_status text,
  display_name text,
  logo_url text,
  primary_color text,
  secondary_color text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id AS tenant_id,
    t.name AS tenant_name,
    t.status AS tenant_status,
    tb.display_name,
    tb.logo_url,
    tb.primary_color,
    tb.secondary_color
  FROM tenants t
  LEFT JOIN tenant_branding tb ON tb.tenant_id = t.id
  WHERE t.slug = p_slug
  LIMIT 1;
END;
$$;