-- ============================================================================
-- get_signature_request_by_token : ajout signature_zone dans le résultat
-- ============================================================================
-- Pour que Signer.tsx puisse récupérer la zone définie par le broker et
-- l'afficher en overlay sur le PDF + l'utiliser pour incruster la signature
-- aux coordonnées exactes.
-- ============================================================================

-- DROP préalable car la RETURNS TABLE change de structure
DROP FUNCTION IF EXISTS public.get_signature_request_by_token(uuid);

CREATE FUNCTION public.get_signature_request_by_token(p_token uuid)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  client_id uuid,
  document_kind text,
  payload jsonb,
  preview_file_key text,
  status text,
  expires_at timestamp with time zone,
  client_first_name text,
  client_last_name text,
  client_company_name text,
  tenant_name text,
  tenant_logo_url text,
  tenant_primary_color text,
  signature_zone jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    sr.id,
    sr.tenant_id,
    sr.client_id,
    sr.document_kind,
    sr.payload,
    sr.preview_file_key,
    sr.status,
    sr.expires_at,
    c.first_name,
    c.last_name,
    c.company_name,
    COALESCE(tb.display_name, t.name),
    tb.logo_url,
    tb.primary_color,
    sr.signature_zone
  FROM public.signature_requests sr
  JOIN public.clients c ON c.id = sr.client_id
  JOIN public.tenants t ON t.id = sr.tenant_id
  LEFT JOIN public.tenant_branding tb ON tb.tenant_id = t.id
  WHERE sr.access_token = p_token
    AND sr.status NOT IN ('cancelled')
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_signature_request_by_token(uuid) TO anon, authenticated;
