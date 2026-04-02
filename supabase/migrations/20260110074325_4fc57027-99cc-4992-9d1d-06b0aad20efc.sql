-- Drop the existing function first, then recreate with plan
DROP FUNCTION IF EXISTS public.get_tenant_branding_by_slug(text);

CREATE FUNCTION public.get_tenant_branding_by_slug(p_slug text)
RETURNS TABLE(
  tenant_id uuid,
  tenant_name text,
  tenant_status text,
  tenant_plan text,
  display_name text,
  logo_url text,
  primary_color text,
  secondary_color text,
  company_address text,
  company_phone text,
  company_email text,
  company_website text
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
    t.plan AS tenant_plan,
    tb.display_name,
    tb.logo_url,
    tb.primary_color,
    tb.secondary_color,
    tb.company_address,
    tb.company_phone,
    tb.company_email,
    tb.company_website
  FROM tenants t
  LEFT JOIN tenant_branding tb ON tb.tenant_id = t.id
  WHERE t.slug = p_slug
  LIMIT 1;
END;
$$;