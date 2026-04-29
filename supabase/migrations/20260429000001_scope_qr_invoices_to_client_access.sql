-- Scope QR invoices with the same client visibility rules used by CRM addresses.
-- Agents should not see every invoice from the tenant, only invoices tied to
-- clients they can access, plus their own manually-created invoices.

DROP POLICY IF EXISTS "Anyone can view invoices" ON public.qr_invoices;
DROP POLICY IF EXISTS "Public can view invoices" ON public.qr_invoices;
DROP POLICY IF EXISTS "Users can view invoices from their tenant" ON public.qr_invoices;
DROP POLICY IF EXISTS "Tenant users can view their invoices" ON public.qr_invoices;
DROP POLICY IF EXISTS "Users can create invoices for their tenant" ON public.qr_invoices;
DROP POLICY IF EXISTS "Users can update invoices from their tenant" ON public.qr_invoices;
DROP POLICY IF EXISTS "Users can delete invoices from their tenant" ON public.qr_invoices;
DROP POLICY IF EXISTS "King can view all invoices" ON public.qr_invoices;

CREATE POLICY "Tenant users can view scoped QR invoices"
ON public.qr_invoices
FOR SELECT
TO authenticated
USING (
  public.is_king()
  OR (
    tenant_id = public.get_user_tenant_id()
    AND (
      public.user_has_global_client_scope(tenant_id)
      OR (client_id IS NOT NULL AND public.can_access_client(client_id))
      OR (client_id IS NULL AND created_by = auth.uid())
    )
  )
);

CREATE POLICY "Tenant users can create scoped QR invoices"
ON public.qr_invoices
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_king()
  OR (
    tenant_id = public.get_user_tenant_id()
    AND COALESCE(created_by, auth.uid()) = auth.uid()
    AND (
      public.user_has_global_client_scope(tenant_id)
      OR client_id IS NULL
      OR public.can_access_client(client_id)
    )
  )
);

CREATE POLICY "Tenant users can update scoped QR invoices"
ON public.qr_invoices
FOR UPDATE
TO authenticated
USING (
  public.is_king()
  OR (
    tenant_id = public.get_user_tenant_id()
    AND (
      public.user_has_global_client_scope(tenant_id)
      OR (client_id IS NOT NULL AND public.can_access_client(client_id))
      OR (client_id IS NULL AND created_by = auth.uid())
    )
  )
)
WITH CHECK (
  public.is_king()
  OR (
    tenant_id = public.get_user_tenant_id()
    AND (
      public.user_has_global_client_scope(tenant_id)
      OR (client_id IS NOT NULL AND public.can_access_client(client_id))
      OR (client_id IS NULL AND created_by = auth.uid())
    )
  )
);

CREATE POLICY "Tenant users can delete scoped QR invoices"
ON public.qr_invoices
FOR DELETE
TO authenticated
USING (
  public.is_king()
  OR (
    tenant_id = public.get_user_tenant_id()
    AND (
      public.user_has_global_client_scope(tenant_id)
      OR (client_id IS NOT NULL AND public.can_access_client(client_id))
      OR (client_id IS NULL AND created_by = auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "Users can view invoice logs from their tenant" ON public.qr_invoice_logs;
DROP POLICY IF EXISTS "Users can create invoice logs" ON public.qr_invoice_logs;
DROP POLICY IF EXISTS "Tenant users can view scoped QR invoice logs" ON public.qr_invoice_logs;
DROP POLICY IF EXISTS "Tenant users can create scoped QR invoice logs" ON public.qr_invoice_logs;

CREATE POLICY "Tenant users can view scoped QR invoice logs"
ON public.qr_invoice_logs
FOR SELECT
TO authenticated
USING (
  public.is_king()
  OR EXISTS (
    SELECT 1
    FROM public.qr_invoices i
    WHERE i.id = invoice_id
      AND i.tenant_id = public.get_user_tenant_id()
      AND (
        public.user_has_global_client_scope(i.tenant_id)
        OR (i.client_id IS NOT NULL AND public.can_access_client(i.client_id))
        OR (i.client_id IS NULL AND i.created_by = auth.uid())
      )
  )
);

CREATE POLICY "Tenant users can create scoped QR invoice logs"
ON public.qr_invoice_logs
FOR INSERT
TO authenticated
WITH CHECK (
  (
    public.is_king()
    OR performed_by IS NULL
    OR performed_by = auth.uid()
  )
  AND (
    public.is_king()
    OR EXISTS (
      SELECT 1
      FROM public.qr_invoices i
      WHERE i.id = invoice_id
        AND i.tenant_id = public.get_user_tenant_id()
        AND (
          public.user_has_global_client_scope(i.tenant_id)
          OR (i.client_id IS NOT NULL AND public.can_access_client(i.client_id))
          OR (i.client_id IS NULL AND i.created_by = auth.uid())
        )
    )
  )
);

CREATE OR REPLACE FUNCTION public.get_next_invoice_number(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year text;
  v_count integer;
  v_number text;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant is required to generate an invoice number';
  END IF;

  IF NOT public.is_king()
    AND p_tenant_id IS DISTINCT FROM public.get_user_tenant_id()
  THEN
    RAISE EXCEPTION 'Not allowed to generate an invoice number for this tenant';
  END IF;

  v_year := to_char(CURRENT_DATE, 'YYYY');

  SELECT COUNT(*) + 1 INTO v_count
  FROM public.qr_invoices
  WHERE tenant_id = p_tenant_id
    AND invoice_number LIKE 'FAC-' || v_year || '-%';

  v_number := 'FAC-' || v_year || '-' || LPAD(v_count::text, 4, '0');

  RETURN v_number;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_next_invoice_number(uuid) TO authenticated;
