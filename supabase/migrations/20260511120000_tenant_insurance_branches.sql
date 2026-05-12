-- ============================================================================
-- Tenant-scoped insurance branches
-- ============================================================================
-- Goal: replace the rigid product_main_category enum (VIE/LCA/NON_VIE/HYPO)
-- with per-tenant editable branches. Each tenant gets the Swiss standard
-- taxonomy on creation, can rename / disable / add custom branches.
--
-- Hierarchy: Company → Branch → Product (with parameters)
-- No sub-branches — the product name carries the specifics.
--
-- The legacy main_category enum + subcategory text column on insurance_products
-- are kept for backward compatibility during the transition. New code reads
-- tenant_branch_id.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. tenant_branches: per-tenant insurance branches
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,                       -- LAMAL, LCA, VIE, AUTO, etc.
  name TEXT NOT NULL,                       -- display label
  description TEXT,
  icon TEXT,                                -- lucide icon name (Heart, Activity, Car, …)
  color TEXT,                               -- hex color for chip
  is_system BOOLEAN NOT NULL DEFAULT false, -- seeded from Swiss standard
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_tenant_branches_tenant
  ON public.tenant_branches(tenant_id) WHERE is_active;

ALTER TABLE public.tenant_branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_branches_select" ON public.tenant_branches;
CREATE POLICY "tenant_branches_select" ON public.tenant_branches
FOR SELECT USING (
  public.is_king()
  OR tenant_id = public.get_user_tenant_id()
);

DROP POLICY IF EXISTS "tenant_branches_insert" ON public.tenant_branches;
CREATE POLICY "tenant_branches_insert" ON public.tenant_branches
FOR INSERT WITH CHECK (
  public.is_king()
  OR tenant_id = public.get_user_tenant_id()
);

DROP POLICY IF EXISTS "tenant_branches_update" ON public.tenant_branches;
CREATE POLICY "tenant_branches_update" ON public.tenant_branches
FOR UPDATE USING (
  public.is_king()
  OR tenant_id = public.get_user_tenant_id()
);

DROP POLICY IF EXISTS "tenant_branches_delete" ON public.tenant_branches;
CREATE POLICY "tenant_branches_delete" ON public.tenant_branches
FOR DELETE USING (
  public.is_king()
  OR (tenant_id = public.get_user_tenant_id() AND is_system = false)
);


-- ----------------------------------------------------------------------------
-- 2. Add tenant_branch_id + parameters to insurance_products
-- ----------------------------------------------------------------------------
ALTER TABLE public.insurance_products
  ADD COLUMN IF NOT EXISTS tenant_branch_id UUID REFERENCES public.tenant_branches(id),
  -- Per-product parameters (franchises possibles, niveaux, options, …)
  ADD COLUMN IF NOT EXISTS parameters JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_insurance_products_tenant_branch
  ON public.insurance_products(tenant_branch_id);


-- ----------------------------------------------------------------------------
-- 3. Seeder function: populate Swiss standard branches for a given tenant
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_tenant_branches(p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.tenant_branches (tenant_id, code, name, description, icon, color, is_system, sort_order)
  VALUES
    (p_tenant_id, 'LAMAL',        'LAMal',                  'Assurance maladie obligatoire (KVG)',                         'Heart',       '#10b981', true, 10),
    (p_tenant_id, 'LCA',          'LCA santé',              'Assurance maladie complémentaire (VVG) — hospi, ambu, dentaire', 'HeartPulse', '#06b6d4', true, 20),
    (p_tenant_id, 'PGM',          'Indemnités journalières', 'Perte de gain maladie / accident',                            'Activity',    '#f59e0b', true, 30),
    (p_tenant_id, 'ACCIDENT',     'Accident (LAA + compl.)', 'LAA obligatoire + complémentaires accident',                  'ShieldAlert', '#ef4444', true, 40),
    (p_tenant_id, 'VIE',          'Vie & Prévoyance',        'Vie individuelle, 3e pilier A/B, risque, mixte, rente',       'Sparkles',    '#8b5cf6', true, 50),
    (p_tenant_id, 'LPP',          'LPP (2e pilier)',         'Prévoyance professionnelle',                                  'Briefcase',   '#6366f1', true, 60),
    (p_tenant_id, 'AUTO',         'Véhicules',               'Auto, moto, bateau, camping-car (RC + Casco)',                'Car',         '#3b82f6', true, 70),
    (p_tenant_id, 'MENAGE_RC',    'Ménage & RC privée',      'RC privée, ménage, bâtiment, animaux',                        'Home',        '#ec4899', true, 80),
    (p_tenant_id, 'JURIDIQUE',    'Protection juridique',    'Privée, circulation, entreprise',                             'Scale',       '#64748b', true, 90),
    (p_tenant_id, 'VOYAGE',       'Voyage & Assistance',     'Annulation, assistance, long séjour',                         'Plane',       '#0ea5e9', true, 100),
    (p_tenant_id, 'ENTREPRISE',   'Entreprise PME',          'RC pro, choses, pertes expl., D&O, cyber, construction, transport', 'Building2', '#475569', true, 110),
    (p_tenant_id, 'HYPO_CREDIT',  'Hypothèque & Crédit',     'Hypothèque, crédit personnel, leasing',                       'Landmark',    '#f97316', true, 120)
  ON CONFLICT (tenant_id, code) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_tenant_branches(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_tenant_branches(UUID) TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 4. Trigger: auto-seed on new tenant creation
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_seed_tenant_branches()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_tenant_branches(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenants_seed_branches_after_insert ON public.tenants;
CREATE TRIGGER tenants_seed_branches_after_insert
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_seed_tenant_branches();


-- ----------------------------------------------------------------------------
-- 5. Backfill: seed all existing tenants
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_tenant RECORD;
BEGIN
  FOR v_tenant IN SELECT id FROM public.tenants LOOP
    PERFORM public.seed_tenant_branches(v_tenant.id);
  END LOOP;
END;
$$;


-- ----------------------------------------------------------------------------
-- 6. NO AUTO-BACKFILL — existing contracts/products are preserved as-is.
-- ----------------------------------------------------------------------------
-- We intentionally do NOT touch existing insurance_products rows here.
-- Their tenant_branch_id stays NULL and the legacy main_category +
-- subcategory + category columns are left untouched.
--
-- This means:
--   - Existing contracts/policies render exactly as before (the UI falls
--     back to the legacy category when tenant_branch_id is NULL).
--   - New contracts created via ContractForm will set tenant_branch_id.
--   - New IA-scanned candidates will set tenant_branch_id automatically.
--   - Existing products can be re-categorised manually from the Partenaires
--     UI (edit product → choose Branch), one at a time, on the broker's
--     own schedule.
--
-- If/when you want to bulk-reclassify your existing products, run the
-- helper function public.backfill_products_to_branches() (see migration
-- 20260511120100_backfill_products_to_branches.sql). It is NOT called
-- automatically; it must be invoked explicitly.
-- ----------------------------------------------------------------------------


-- ----------------------------------------------------------------------------
-- 7. updated_at trigger
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_tenant_branches_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenant_branches_touch ON public.tenant_branches;
CREATE TRIGGER trg_tenant_branches_touch
  BEFORE UPDATE ON public.tenant_branches
  FOR EACH ROW EXECUTE FUNCTION public.touch_tenant_branches_updated_at();


-- ----------------------------------------------------------------------------
-- 8. Documentation
-- ----------------------------------------------------------------------------
COMMENT ON TABLE public.tenant_branches IS
  'Per-tenant insurance branches (categories). Seeded with Swiss standard on tenant creation. Tenant can rename / disable / add custom branches.';

COMMENT ON COLUMN public.insurance_products.tenant_branch_id IS
  'New branch reference. Replaces legacy main_category enum + subcategory text.';

COMMENT ON COLUMN public.insurance_products.parameters IS
  'Per-product parameters (franchises possibles, niveaux, options spécifiques). JSONB schema depends on branch.';
