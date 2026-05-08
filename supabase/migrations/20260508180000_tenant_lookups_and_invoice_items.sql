-- ============================================================================
-- Tenant catalogs + multi-line invoices
-- ============================================================================
--
-- Adds 3 tables in one shot to support:
--   1. Custom document types per tenant (Sprint 2 — Documents)
--   2. Custom billable services per tenant (Sprint 4 — Compta)
--   3. Multi-line invoices via invoice_items (Sprint 4 — Compta)
--
-- Convention:
--   - tenant_id NULL  → system row, visible to all tenants, immutable in UI
--   - tenant_id <set>  → tenant-specific custom row, CRUD by tenant admin
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. tenant_document_types — catalog of document types
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tenant_document_types (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,
  label       TEXT NOT NULL,
  is_system   BOOLEAN NOT NULL DEFAULT false,
  sort_order  INT NOT NULL DEFAULT 0,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tenant_document_types_tenant_code_uq UNIQUE (tenant_id, code)
);

-- Unique system codes (since tenant_id NULL is "distinct" in UNIQUE constraints)
CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_document_types_system_code
  ON public.tenant_document_types (code) WHERE tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_document_types_tenant
  ON public.tenant_document_types (tenant_id);

ALTER TABLE public.tenant_document_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can view document types" ON public.tenant_document_types;
CREATE POLICY "Tenant members can view document types"
ON public.tenant_document_types
FOR SELECT
TO authenticated
USING (
  public.is_king()
  OR tenant_id IS NULL
  OR tenant_id = public.get_user_tenant_id()
);

DROP POLICY IF EXISTS "Tenant admins can manage document types" ON public.tenant_document_types;
CREATE POLICY "Tenant admins can manage document types"
ON public.tenant_document_types
FOR ALL
TO authenticated
USING (
  public.is_king()
  OR (
    tenant_id IS NOT NULL
    AND tenant_id = public.get_user_tenant_id()
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
    AND NOT is_system
  )
)
WITH CHECK (
  public.is_king()
  OR (
    tenant_id IS NOT NULL
    AND tenant_id = public.get_user_tenant_id()
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
    AND NOT is_system
  )
);


-- ----------------------------------------------------------------------------
-- 2. tenant_billable_services — catalog of services that can be billed
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tenant_billable_services (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  code            TEXT NOT NULL,
  label           TEXT NOT NULL,
  description     TEXT,
  default_amount  NUMERIC(12, 2),
  default_unit    TEXT,
  is_system       BOOLEAN NOT NULL DEFAULT false,
  sort_order      INT NOT NULL DEFAULT 0,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tenant_billable_services_tenant_code_uq UNIQUE (tenant_id, code)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_billable_services_system_code
  ON public.tenant_billable_services (code) WHERE tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_billable_services_tenant
  ON public.tenant_billable_services (tenant_id);

ALTER TABLE public.tenant_billable_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can view billable services" ON public.tenant_billable_services;
CREATE POLICY "Tenant members can view billable services"
ON public.tenant_billable_services
FOR SELECT
TO authenticated
USING (
  public.is_king()
  OR tenant_id IS NULL
  OR tenant_id = public.get_user_tenant_id()
);

DROP POLICY IF EXISTS "Tenant admins can manage billable services" ON public.tenant_billable_services;
CREATE POLICY "Tenant admins can manage billable services"
ON public.tenant_billable_services
FOR ALL
TO authenticated
USING (
  public.is_king()
  OR (
    tenant_id IS NOT NULL
    AND tenant_id = public.get_user_tenant_id()
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
    AND NOT is_system
  )
)
WITH CHECK (
  public.is_king()
  OR (
    tenant_id IS NOT NULL
    AND tenant_id = public.get_user_tenant_id()
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
    AND NOT is_system
  )
);


-- ----------------------------------------------------------------------------
-- 3. Seed system rows
-- ----------------------------------------------------------------------------

INSERT INTO public.tenant_document_types (tenant_id, code, label, is_system, sort_order) VALUES
  (NULL, 'police_assurance', 'Police d''assurance',  true,  10),
  (NULL, 'piece_identite',   'Pièce d''identité',     true,  20),
  (NULL, 'resiliation',      'Résiliation',           true,  30),
  (NULL, 'attestation',      'Attestation',           true,  40),
  (NULL, 'facture',          'Facture',               true,  50),
  (NULL, 'justificatif',     'Justificatif',          true,  60),
  (NULL, 'contrat',          'Contrat signé',         true,  70),
  (NULL, 'autre',            'Autre',                 true, 999)
ON CONFLICT DO NOTHING;

INSERT INTO public.tenant_billable_services (tenant_id, code, label, is_system, sort_order) VALUES
  (NULL, 'declaration_impot', 'Déclaration d''impôt',  true,  10),
  (NULL, 'demande_subside',   'Demande de subsides',    true,  20),
  (NULL, 'conseil_financier', 'Conseil financier',      true,  30),
  (NULL, 'domiciliation',     'Domiciliation',          true,  40),
  (NULL, 'autre',             'Autre prestation',       true, 999)
ON CONFLICT DO NOTHING;


-- ----------------------------------------------------------------------------
-- 4. invoice_items — multi-line invoices
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   UUID NOT NULL REFERENCES public.qr_invoices(id) ON DELETE CASCADE,
  service_id   UUID REFERENCES public.tenant_billable_services(id) ON DELETE SET NULL,
  description  TEXT NOT NULL,
  quantity     NUMERIC(10, 2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price   NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  line_total   NUMERIC(12, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice
  ON public.invoice_items (invoice_id);

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can view invoice items" ON public.invoice_items;
CREATE POLICY "Tenant members can view invoice items"
ON public.invoice_items
FOR SELECT
TO authenticated
USING (
  public.is_king()
  OR EXISTS (
    SELECT 1 FROM public.qr_invoices qi
    WHERE qi.id = invoice_items.invoice_id
      AND qi.tenant_id = public.get_user_tenant_id()
  )
);

DROP POLICY IF EXISTS "Tenant members can manage invoice items" ON public.invoice_items;
CREATE POLICY "Tenant members can manage invoice items"
ON public.invoice_items
FOR ALL
TO authenticated
USING (
  public.is_king()
  OR EXISTS (
    SELECT 1 FROM public.qr_invoices qi
    WHERE qi.id = invoice_items.invoice_id
      AND qi.tenant_id = public.get_user_tenant_id()
  )
)
WITH CHECK (
  public.is_king()
  OR EXISTS (
    SELECT 1 FROM public.qr_invoices qi
    WHERE qi.id = invoice_items.invoice_id
      AND qi.tenant_id = public.get_user_tenant_id()
  )
);


-- ----------------------------------------------------------------------------
-- 5. Backfill: ensure every existing qr_invoice has at least one invoice_item
-- ----------------------------------------------------------------------------

INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, sort_order)
SELECT
  qi.id,
  COALESCE(NULLIF(qi.service_description, ''), qi.service_type, 'Prestation'),
  1,
  COALESCE(qi.amount_ht, 0),
  0
FROM public.qr_invoices qi
WHERE NOT EXISTS (
  SELECT 1 FROM public.invoice_items ii WHERE ii.invoice_id = qi.id
);
