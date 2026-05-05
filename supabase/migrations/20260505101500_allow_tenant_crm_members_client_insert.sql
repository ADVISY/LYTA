-- Final safety net for client creation: the CRM route already requires a
-- tenant assignment or tenant role. Keep INSERT scoped to authenticated users
-- linked to the target tenant, without relying on admin permission backfills.

CREATE OR REPLACE FUNCTION public.is_crm_member_of_tenant(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_tenant_id IS NOT NULL
    AND auth.uid() IS NOT NULL
    AND (
      public.is_king()
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR EXISTS (
        SELECT 1
        FROM public.user_tenant_assignments uta
        WHERE uta.user_id = auth.uid()
          AND uta.tenant_id = p_tenant_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.user_tenant_roles utr
        JOIN public.tenant_roles tr ON tr.id = utr.role_id
        WHERE utr.user_id = auth.uid()
          AND tr.tenant_id = p_tenant_id
          AND tr.is_active = true
          AND (
            utr.tenant_id = p_tenant_id
            OR utr.tenant_id IS NULL
          )
      )
    )
$$;

GRANT EXECUTE ON FUNCTION public.is_crm_member_of_tenant(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_create_client_in_tenant(
  p_tenant_id uuid,
  p_type_adresse text DEFAULT 'client'
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_crm_member_of_tenant(p_tenant_id)
$$;

GRANT EXECUTE ON FUNCTION public.can_create_client_in_tenant(uuid, text) TO authenticated;

DROP POLICY IF EXISTS "Tenant staff can create clients" ON public.clients;

CREATE POLICY "Tenant staff can create clients"
ON public.clients
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_crm_member_of_tenant(tenant_id)
);
