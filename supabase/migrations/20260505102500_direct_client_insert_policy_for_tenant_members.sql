-- Direct INSERT policy without helper indirection. This protects the tenant
-- boundary while avoiding any mismatch in SECURITY DEFINER helper evaluation.

DROP POLICY IF EXISTS "Direct tenant members can create clients" ON public.clients;

CREATE POLICY "Direct tenant members can create clients"
ON public.clients
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id IS NOT NULL
  AND auth.uid() IS NOT NULL
  AND (
    public.is_king()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.user_tenant_assignments uta
      WHERE uta.user_id = auth.uid()
        AND uta.tenant_id = clients.tenant_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_tenant_roles utr
      JOIN public.tenant_roles tr ON tr.id = utr.role_id
      WHERE utr.user_id = auth.uid()
        AND tr.tenant_id = clients.tenant_id
        AND tr.is_active = true
        AND (
          utr.tenant_id = clients.tenant_id
          OR utr.tenant_id IS NULL
        )
    )
  )
);
