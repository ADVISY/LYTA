-- ============================================================================
-- Tenant-scope insurance_products via RLS
-- ============================================================================
-- Until now insurance_products was a global table. Adding a per-tenant
-- catalog yesterday helped (Advisy got its 155 products via
-- tenant_branch_id), but a JCG user opening the Partners page would still
-- SEE Advisy's products in the global list — the SELECT had no per-tenant
-- filter beyond the strict admin role check.
--
-- We add an explicit `tenant_id` column, backfill it from the tenant of
-- the linked branch, and rewrite the RLS so a user sees:
--   - the king bypass, OR
--   - products with tenant_id = their tenant, OR
--   - products with tenant_id NULL (the legacy/global ones — keeps existing
--     contracts working and lets the IA-scan candidate flow surface
--     unknown products until a tenant claims them).
--
-- Existing FK-referenced products (e.g. used by old policies) are NEVER
-- deleted — they're just hidden from cross-tenant SELECT.
-- ============================================================================

-- 1. Add tenant_id column (nullable, so legacy rows stay valid)
ALTER TABLE public.insurance_products
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

CREATE INDEX IF NOT EXISTS idx_insurance_products_tenant_id
  ON public.insurance_products(tenant_id);

-- 2. Backfill tenant_id from tenant_branch_id (each branch belongs to a tenant)
UPDATE public.insurance_products p
SET tenant_id = tb.tenant_id
FROM public.tenant_branches tb
WHERE p.tenant_branch_id = tb.id
  AND p.tenant_id IS NULL;

-- 3. Tighten RLS: split the over-permissive 'FOR ALL' policy into per-action
--    policies that filter by tenant.

DROP POLICY IF EXISTS "Tenant staff can manage insurance products" ON public.insurance_products;

-- SELECT: tenant users see their own products + global (tenant_id NULL)
DROP POLICY IF EXISTS "Tenant users can view insurance products" ON public.insurance_products;
CREATE POLICY "Tenant users can view insurance products" ON public.insurance_products
  FOR SELECT TO authenticated
  USING (
    public.is_king()
    OR tenant_id IS NULL
    OR tenant_id = public.get_user_tenant_id()
  );

-- INSERT: only admin/manager/backoffice of the tenant can create products
--         (and they're forced to set tenant_id to their own tenant)
DROP POLICY IF EXISTS "Tenant staff can insert insurance products" ON public.insurance_products;
CREATE POLICY "Tenant staff can insert insurance products" ON public.insurance_products
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_king()
    OR (
      tenant_id = public.get_user_tenant_id()
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'manager'::app_role)
        OR public.has_role(auth.uid(), 'backoffice'::app_role)
      )
    )
  );

-- UPDATE: only admin/manager/backoffice of the owning tenant
DROP POLICY IF EXISTS "Tenant staff can update insurance products" ON public.insurance_products;
CREATE POLICY "Tenant staff can update insurance products" ON public.insurance_products
  FOR UPDATE TO authenticated
  USING (
    public.is_king()
    OR (
      tenant_id = public.get_user_tenant_id()
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'manager'::app_role)
        OR public.has_role(auth.uid(), 'backoffice'::app_role)
      )
    )
  )
  WITH CHECK (
    public.is_king()
    OR (
      tenant_id = public.get_user_tenant_id()
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'manager'::app_role)
        OR public.has_role(auth.uid(), 'backoffice'::app_role)
      )
    )
  );

-- DELETE: only admin/manager/backoffice of the owning tenant
DROP POLICY IF EXISTS "Tenant staff can delete insurance products" ON public.insurance_products;
CREATE POLICY "Tenant staff can delete insurance products" ON public.insurance_products
  FOR DELETE TO authenticated
  USING (
    public.is_king()
    OR (
      tenant_id = public.get_user_tenant_id()
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'manager'::app_role)
        OR public.has_role(auth.uid(), 'backoffice'::app_role)
      )
    )
  );

COMMENT ON COLUMN public.insurance_products.tenant_id IS
  'Owner tenant. NULL = legacy/global catalog row (kept visible to all to preserve old policies). New tenant-created products always set this.';
