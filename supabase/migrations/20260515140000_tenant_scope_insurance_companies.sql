-- ============================================================================
-- Tenant-scope insurance_companies (mirror of insurance_products scoping)
-- ============================================================================
-- Today insurance_companies is global : 1 row par compagnie, name UNIQUE.
-- On veut que :
--   - Les 24 compagnies actuelles restent "système" (tenant_id NULL)
--   - Chaque tenant puisse créer/éditer SES propres compagnies
--   - Aucun tenant ne puisse modifier les compagnies système
--   - 2 tenants différents peuvent avoir une compagnie "Mon Cabinet Local SA"
--     sans entrer en collision
--
-- Pattern exact identique à insurance_products (migration 20260512160000).
-- ============================================================================

-- 1. Ajout tenant_id
ALTER TABLE public.insurance_companies
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_insurance_companies_tenant_id
  ON public.insurance_companies(tenant_id);

COMMENT ON COLUMN public.insurance_companies.tenant_id IS
  'Tenant propriétaire. NULL = compagnie système partagée (verrouillée pour les tenants, modifiable seulement par king).';

-- 2. Adapter la contrainte UNIQUE
-- Ancienne : UNIQUE (name)        → un seul "AXA" possible toutes-tenants
-- Nouvelle : un "AXA" système     (tenant_id NULL)
--         + un "AXA" par tenant   (tenant_id = X)
ALTER TABLE public.insurance_companies
  DROP CONSTRAINT IF EXISTS insurance_companies_name_key;

-- Unicité globale pour la base système (un seul nom par compagnie système)
DROP INDEX IF EXISTS uniq_insurance_companies_system_name;
CREATE UNIQUE INDEX uniq_insurance_companies_system_name
  ON public.insurance_companies(lower(name))
  WHERE tenant_id IS NULL;

-- Unicité par tenant (un cabinet ne peut pas créer 2 fois la même compagnie)
DROP INDEX IF EXISTS uniq_insurance_companies_tenant_name;
CREATE UNIQUE INDEX uniq_insurance_companies_tenant_name
  ON public.insurance_companies(tenant_id, lower(name))
  WHERE tenant_id IS NOT NULL;

-- 3. RLS — copie du pattern insurance_products
ALTER TABLE public.insurance_companies ENABLE ROW LEVEL SECURITY;

-- Nettoyer les anciennes policies (au cas où)
DROP POLICY IF EXISTS "Insurance companies are viewable by all"   ON public.insurance_companies;
DROP POLICY IF EXISTS "Tenant staff can manage insurance companies" ON public.insurance_companies;
DROP POLICY IF EXISTS "Tenant users can view insurance companies"   ON public.insurance_companies;
DROP POLICY IF EXISTS "Tenant staff can insert insurance companies" ON public.insurance_companies;
DROP POLICY IF EXISTS "Tenant staff can update insurance companies" ON public.insurance_companies;
DROP POLICY IF EXISTS "Tenant staff can delete insurance companies" ON public.insurance_companies;

-- SELECT : king + compagnies système + ses propres compagnies
CREATE POLICY "Tenant users can view insurance companies" ON public.insurance_companies
  FOR SELECT TO authenticated
  USING (
    public.is_king()
    OR tenant_id IS NULL
    OR tenant_id = public.get_user_tenant_id()
  );

-- INSERT : king + (admin/manager/backoffice du tenant créant pour SON tenant)
CREATE POLICY "Tenant staff can insert insurance companies" ON public.insurance_companies
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

-- UPDATE : king (peut tout) + tenant staff sur ses propres compagnies seulement
CREATE POLICY "Tenant staff can update insurance companies" ON public.insurance_companies
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

-- DELETE : idem (tenant peut effacer ses compagnies, pas celles système)
CREATE POLICY "Tenant staff can delete insurance companies" ON public.insurance_companies
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

-- 4. Vérification finale
DO $$
DECLARE
  v_system INT;
  v_tenant INT;
BEGIN
  SELECT count(*) INTO v_system FROM public.insurance_companies WHERE tenant_id IS NULL;
  SELECT count(*) INTO v_tenant FROM public.insurance_companies WHERE tenant_id IS NOT NULL;
  RAISE NOTICE '';
  RAISE NOTICE '=== INSURANCE_COMPANIES après scoping ===';
  RAISE NOTICE '  Compagnies système (tenant_id NULL) : %', v_system;
  RAISE NOTICE '  Compagnies privées tenant           : %', v_tenant;
END $$;
