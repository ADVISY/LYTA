-- ============================================================================
-- tenant_product_commission_overrides
-- ============================================================================
-- Chaque tenant peut "écraser" la commission (type / value / description) d'un
-- produit système, SANS modifier la base partagée ni l'expérience des autres
-- tenants. L'override est strictement privé au tenant.
--
-- Règles métier :
--   - L'admin/manager/backoffice du tenant peut INSERT/UPDATE/DELETE ses overrides
--   - Aucun tenant ne voit ni ne peut modifier les overrides d'un autre tenant
--   - Le king voit/édite tout
--   - La commission effective côté UI = override(tenant, product) sinon insurance_products.commission_*
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tenant_product_commission_overrides (
  tenant_id  UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.insurance_products(id) ON DELETE CASCADE,

  commission_type        TEXT,        -- 'fixed' | 'multiplier' | 'percentage'
  commission_value       NUMERIC(12,4),
  commission_description TEXT,

  notes      TEXT,                    -- bloc-notes interne (ex: "négocié avec compagnie X mai 2026")
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (tenant_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_tpco_product
  ON public.tenant_product_commission_overrides(product_id);
CREATE INDEX IF NOT EXISTS idx_tpco_tenant
  ON public.tenant_product_commission_overrides(tenant_id);

COMMENT ON TABLE public.tenant_product_commission_overrides IS
  'Override par tenant des champs commission d''un produit. Permet à un cabinet d''avoir sa propre commission négociée sans toucher au produit partagé ni à celui des autres tenants.';

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_tpco()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_touch_tpco ON public.tenant_product_commission_overrides;
CREATE TRIGGER trg_touch_tpco
  BEFORE UPDATE ON public.tenant_product_commission_overrides
  FOR EACH ROW EXECUTE FUNCTION public.touch_tpco();

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE public.tenant_product_commission_overrides ENABLE ROW LEVEL SECURITY;

-- SELECT : king + son tenant uniquement
DROP POLICY IF EXISTS tpco_select ON public.tenant_product_commission_overrides;
CREATE POLICY tpco_select ON public.tenant_product_commission_overrides
  FOR SELECT TO authenticated
  USING (
    public.is_king()
    OR tenant_id = public.get_user_tenant_id()
  );

-- INSERT : admin/manager/backoffice du tenant créant pour SON tenant
DROP POLICY IF EXISTS tpco_insert ON public.tenant_product_commission_overrides;
CREATE POLICY tpco_insert ON public.tenant_product_commission_overrides
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

-- UPDATE : idem
DROP POLICY IF EXISTS tpco_update ON public.tenant_product_commission_overrides;
CREATE POLICY tpco_update ON public.tenant_product_commission_overrides
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

-- DELETE : idem (permet le "Réinitialiser au défaut système")
DROP POLICY IF EXISTS tpco_delete ON public.tenant_product_commission_overrides;
CREATE POLICY tpco_delete ON public.tenant_product_commission_overrides
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

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.tenant_product_commission_overrides TO authenticated;

-- ============================================================================
-- Helper RPC : commission effective d'un produit pour le tenant courant
-- (override si existe, sinon valeur native du produit)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_effective_commission(
  p_product_id UUID,
  p_tenant_id  UUID DEFAULT NULL
)
RETURNS TABLE (
  product_id             UUID,
  commission_type        TEXT,
  commission_value       NUMERIC,
  commission_description TEXT,
  is_overridden          BOOLEAN
)
LANGUAGE SQL STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    COALESCE(o.commission_type,        p.commission_type),
    COALESCE(o.commission_value,       p.commission_value),
    COALESCE(o.commission_description, p.commission_description),
    (o.tenant_id IS NOT NULL)
  FROM public.insurance_products p
  LEFT JOIN public.tenant_product_commission_overrides o
    ON o.product_id = p.id
   AND o.tenant_id  = COALESCE(p_tenant_id, public.get_user_tenant_id())
  WHERE p.id = p_product_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_effective_commission(UUID, UUID) TO authenticated;
