-- ============================================================================
-- Seed Advisy's product catalog (146 products across 22 active companies)
-- ============================================================================
-- Insurance_companies is a GLOBAL reference table (shared across all tenants).
-- We do NOT touch it here so we don't impact other/future tenants. Products
-- on the other hand are tenant-scoped — we only insert for tenant Advisy.
--
-- The 2 "ghost" companies (Dépôt générique, Helvetia Validation) are simply
-- skipped at insert time: we never create products against them for Advisy,
-- so they won't pollute Advisy's catalog. The frontend already filters
-- product lists by tenant_id when displaying for a tenant.
--
-- Resolution rules:
--   - company_id ← lookup by name in insurance_companies (global table)
--   - tenant_branch_id ← lookup by (tenant_id=advisy, code) in tenant_branches
--   - tenant_id ← Advisy
-- ============================================================================

-- Seed products
DO $$
DECLARE
  v_tenant_id UUID;
  v_inserted INTEGER := 0;
  v_skipped INTEGER := 0;
  r RECORD;
BEGIN
  SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = 'advisy' LIMIT 1;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant advisy not found';
  END IF;

  FOR r IN (
    SELECT * FROM (VALUES
      -- ============ LAMAL ============
      ('Assura',        'LAMAL', 'Assura Standard'),
      ('Assura',        'LAMAL', 'Assura Médecin de famille'),
      ('Assura',        'LAMAL', 'Assura PharMed'),
      ('Assura',        'LAMAL', 'Assura PreventoMed'),
      ('Assura',        'LAMAL', 'Assura Qualimed'),
      ('Assura',        'LAMAL', 'Assura Hausspital'),
      ('Atupri',        'LAMAL', 'Atupri Standard'),
      ('Atupri',        'LAMAL', 'Atupri CareMed'),
      ('Atupri',        'LAMAL', 'Atupri FlexCare'),
      ('Atupri',        'LAMAL', 'Atupri HMO'),
      ('Atupri',        'LAMAL', 'Atupri SmartCare'),
      ('Atupri',        'LAMAL', 'Atupri TelFirst'),
      ('Concordia',     'LAMAL', 'Concordia Standard'),
      ('Concordia',     'LAMAL', 'Concordia MyDoc'),
      ('Concordia',     'LAMAL', 'Concordia Telmed'),
      ('Concordia',     'LAMAL', 'Concordia HMO'),
      ('CSS Assurance', 'LAMAL', 'CSS Standard'),
      ('CSS Assurance', 'LAMAL', 'CSS Telmed'),
      ('CSS Assurance', 'LAMAL', 'CSS MyCSS'),
      ('CSS Assurance', 'LAMAL', 'CSS HMO'),
      ('Groupe Mutuel', 'LAMAL', 'GM Standard'),
      ('Groupe Mutuel', 'LAMAL', 'GM PrimaFlex'),
      ('Groupe Mutuel', 'LAMAL', 'GM OptiMed'),
      ('Groupe Mutuel', 'LAMAL', 'GM SanaTel'),
      ('Groupe Mutuel', 'LAMAL', 'GM PrimaPharma'),
      ('Helsana',       'LAMAL', 'Helsana Basis'),
      ('Helsana',       'LAMAL', 'Helsana BeneFit PLUS Flexmed'),
      ('Helsana',       'LAMAL', 'Helsana BeneFit PLUS Hausarzt'),
      ('Helsana',       'LAMAL', 'Helsana Telmed'),
      ('KPT/CPT',       'LAMAL', 'KPT Standard'),
      ('KPT/CPT',       'LAMAL', 'KPTwin.smart'),
      ('KPT/CPT',       'LAMAL', 'KPTwin.easy'),
      ('KPT/CPT',       'LAMAL', 'KPTwin.doc'),
      ('KPT/CPT',       'LAMAL', 'KPTwin.plus'),
      ('KPT/CPT',       'LAMAL', 'KPTwin.win'),
      ('Sanitas',       'LAMAL', 'Sanitas Basic'),
      ('Sanitas',       'LAMAL', 'Sanitas CallMed'),
      ('Sanitas',       'LAMAL', 'Sanitas Compact One'),
      ('Sanitas',       'LAMAL', 'Sanitas MultiAccess'),
      ('Sympany',       'LAMAL', 'Sympany casamed family doctor'),
      ('Sympany',       'LAMAL', 'Sympany casamed pharmacy'),
      ('Sympany',       'LAMAL', 'Sympany casamed HMO'),
      ('Sympany',       'LAMAL', 'Sympany CallMed24'),
      ('Swica',         'LAMAL', 'Swica Standard'),
      ('Swica',         'LAMAL', 'Swica Favorit Casa'),
      ('Swica',         'LAMAL', 'Swica Favorit Medica'),
      ('Swica',         'LAMAL', 'Swica Favorit Medpharm'),
      ('Swica',         'LAMAL', 'Swica Favorit Sante'),
      ('Swica',         'LAMAL', 'Swica Favorit Telmed'),
      ('Visana',        'LAMAL', 'Visana Traditionnel'),
      ('Visana',        'LAMAL', 'Visana Managed Care HAM'),
      ('Visana',        'LAMAL', 'Visana Managed Care HMO'),
      ('Visana',        'LAMAL', 'Visana Med Direct'),
      ('Visana',        'LAMAL', 'Visana Tel Doc'),
      ('Visana',        'LAMAL', 'Visana Med Call'),
      ('Visana',        'LAMAL', 'Visana Tel Care'),
      ('Visana',        'LAMAL', 'Visana VIVA'),

      -- ============ LCA santé ============
      ('Atupri',        'LCA', 'Atupri Mivita Reala'),
      ('Atupri',        'LCA', 'Atupri Mivita Extensa'),
      ('Atupri',        'LCA', 'Atupri Denta'),
      ('Atupri',        'LCA', 'Atupri Comforta'),
      ('Atupri',        'LCA', 'Atupri Hôpital'),
      ('Atupri',        'LCA', 'Atupri ADI'),
      ('Concordia',     'LCA', 'Concordia NATURA'),
      ('Concordia',     'LCA', 'Concordia NATURA PLUS'),
      ('Concordia',     'LCA', 'Concordia NATURA TOP'),
      ('Concordia',     'LCA', 'Concordia HOSPITA Private'),
      ('Concordia',     'LCA', 'Concordia HOSPITA Semi-Private'),
      ('Concordia',     'LCA', 'Concordia HOSPITA Common'),
      ('Concordia',     'LCA', 'Concordia HOSPITA LIBERO'),
      ('CSS Assurance', 'LCA', 'CSS myFlex Economy'),
      ('CSS Assurance', 'LCA', 'CSS myFlex Balance'),
      ('CSS Assurance', 'LCA', 'CSS myFlex Premium'),
      ('CSS Assurance', 'LCA', 'CSS myFlex Hospi Economy'),
      ('CSS Assurance', 'LCA', 'CSS myFlex Hospi Balance'),
      ('CSS Assurance', 'LCA', 'CSS myFlex Hospi Premium'),
      ('CSS Assurance', 'LCA', 'CSS myFlex Dentaire'),
      ('CSS Assurance', 'LCA', 'CSS myFlex Médecine alternative'),
      ('CSS Assurance', 'LCA', 'CSS Livo'),
      ('Helsana',       'LCA', 'Helsana TOP'),
      ('Helsana',       'LCA', 'Helsana SANA'),
      ('Helsana',       'LCA', 'Helsana COMPLETA'),
      ('Helsana',       'LCA', 'Helsana WORLD'),
      ('Helsana',       'LCA', 'Helsana PRIMEO'),
      ('KPT/CPT',       'LCA', 'KPT Pulse Eco'),
      ('KPT/CPT',       'LCA', 'KPT Pulse Top'),
      ('KPT/CPT',       'LCA', 'KPT Pulse Premium'),
      ('Sanitas',       'LCA', 'Sanitas Vital'),
      ('Sanitas',       'LCA', 'Sanitas Easy'),
      ('Sanitas',       'LCA', 'Sanitas Dental Basic'),
      ('Sanitas',       'LCA', 'Sanitas Hospital Standard Liberty'),
      ('Sanitas',       'LCA', 'Sanitas Hospital Extra Liberty'),
      ('Sanitas',       'LCA', 'Sanitas Hospital Top Liberty'),
      ('Swica',         'LCA', 'Swica Completa Top'),
      ('Swica',         'LCA', 'Swica Hospita Flex'),
      ('Swica',         'LCA', 'Swica Optima'),
      ('Swica',         'LCA', 'Swica Denta'),

      -- ============ VIE & Prévoyance ============
      ('Swiss Life',         'VIE', 'Swiss Life FlexSave Duo'),
      ('Swiss Life',         'VIE', 'Swiss Life Dynamic Elements'),
      ('Swiss Life',         'VIE', 'Swiss Life Opportunities Elements'),
      ('Swiss Life',         'VIE', 'Swiss Life Immo Elements'),
      ('Swiss Life',         'VIE', 'Swiss Life Premium Comfort Duo'),
      ('Swiss Life',         'VIE', 'Swiss Life Premium Vitality Duo'),
      ('Helvetia',           'VIE', 'Helvetia Plan de Prévoyance'),
      ('Helvetia',           'VIE', 'Helvetia Plan de Garantie'),
      ('Helvetia',           'VIE', 'Helvetia Plan de Performance'),
      ('Helvetia',           'VIE', 'Helvetia 3P'),
      ('Helvetia',           'VIE', 'Helvetia Fonds de placement'),
      ('Baloise',            'VIE', 'Baloise Safe Plan'),
      ('Baloise',            'VIE', 'Baloise Safe Plan 100'),
      ('Baloise',            'VIE', 'Baloise Safe Invest'),
      ('Baloise',            'VIE', 'Baloise Fonds Plan'),
      ('Baloise',            'VIE', 'Baloise Fonds Plan Kids'),
      ('Baloise',            'VIE', 'Baloise LIFEPlus Switzerland'),
      ('Generali',           'VIE', 'Generali Previflex'),
      ('Generali',           'VIE', 'Generali Previgarant'),
      ('Generali',           'VIE', 'Generali Previplan'),
      ('Generali',           'VIE', 'Generali Tomorrow Invest'),
      ('Pax',                'VIE', 'Pax Assurance-vie épargne'),
      ('Pax',                'VIE', 'Pax FondsStar'),
      ('Pax',                'VIE', 'Pax Incapacité de gain'),
      ('Liechtenstein Life', 'VIE', 'Liechtenstein Life Prosperity 3a'),
      ('Liechtenstein Life', 'VIE', 'Liechtenstein Life Prosperity Plus'),
      ('Liechtenstein Life', 'VIE', 'Liechtenstein Life Prosperity Junior'),
      ('AXA',                'VIE', 'AXA Vie 3a'),
      ('AXA',                'VIE', 'AXA Plan investissement'),
      ('Zurich Assurances',  'VIE', 'Zurich Vie épargne flexible 3a'),
      ('Zurich Assurances',  'VIE', 'Zurich Vie épargne flexible 3b'),

      -- ============ AUTO ============
      ('AXA',               'AUTO', 'AXA Strada Auto'),
      ('La Mobilière',      'AUTO', 'Mobilière Auto'),
      ('La Vaudoise',       'AUTO', 'Vaudoise Auto'),
      ('Zurich Assurances', 'AUTO', 'Zurich Auto'),
      ('Generali',          'AUTO', 'Generali Auto'),
      ('Helvetia',          'AUTO', 'Helvetia Auto'),
      ('Baloise',           'AUTO', 'Baloise Auto'),

      -- ============ MENAGE_RC ============
      ('AXA',               'MENAGE_RC', 'AXA Ménage'),
      ('AXA',               'MENAGE_RC', 'AXA RC privée'),
      ('La Mobilière',      'MENAGE_RC', 'Mobilière Ménage'),
      ('La Mobilière',      'MENAGE_RC', 'Mobilière RC privée'),
      ('La Mobilière',      'MENAGE_RC', 'Mobilière Bâtiment'),
      ('La Vaudoise',       'MENAGE_RC', 'Vaudoise Ménage'),
      ('La Vaudoise',       'MENAGE_RC', 'Vaudoise RC privée'),
      ('La Vaudoise',       'MENAGE_RC', 'Vaudoise Bâtiment'),
      ('Zurich Assurances', 'MENAGE_RC', 'Zurich Ménage'),
      ('Zurich Assurances', 'MENAGE_RC', 'Zurich RC privée'),
      ('Generali',          'MENAGE_RC', 'Generali Ménage'),
      ('Helvetia',          'MENAGE_RC', 'Helvetia Ménage'),
      ('Baloise',           'MENAGE_RC', 'Baloise Ménage'),

      -- ============ JURIDIQUE ============
      ('AXA',          'JURIDIQUE', 'AXA Sans souci'),
      ('La Mobilière', 'JURIDIQUE', 'Mobilière Protection juridique'),
      ('La Vaudoise',  'JURIDIQUE', 'Vaudoise Protection juridique'),

      -- ============ HYPO_CREDIT ============
      ('Zugerberg Finanz', 'HYPO_CREDIT', 'Zugerberg Finanz 3a'),
      ('Zugerberg Finanz', 'HYPO_CREDIT', 'Zugerberg Finanz 3a Revo'),
      ('Zugerberg Finanz', 'HYPO_CREDIT', 'Zugerberg LPP individualisé'),
      ('Zugerberg Finanz', 'HYPO_CREDIT', 'Zugerberg Gestion patrimoine')
    ) AS t(company_name, branch_code, product_name)
  ) LOOP
    DECLARE
      v_company_id UUID;
      v_branch_id UUID;
      v_legacy_category TEXT;
    BEGIN
      SELECT id INTO v_company_id
      FROM public.insurance_companies
      WHERE LOWER(name) = LOWER(r.company_name)
      LIMIT 1;

      IF v_company_id IS NULL THEN
        RAISE NOTICE 'Skip (company not found): % / %', r.company_name, r.product_name;
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      SELECT id INTO v_branch_id
      FROM public.tenant_branches
      WHERE tenant_id = v_tenant_id AND code = r.branch_code
      LIMIT 1;

      IF v_branch_id IS NULL THEN
        RAISE NOTICE 'Skip (branch not found): %', r.branch_code;
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      -- Map branch_code → legacy category enum (NOT NULL on insurance_products)
      v_legacy_category := CASE r.branch_code
        WHEN 'LAMAL'       THEN 'health'
        WHEN 'LCA'         THEN 'health'
        WHEN 'LAMAL_LCA'   THEN 'health'
        WHEN 'PGM'         THEN 'health'
        WHEN 'ACCIDENT'    THEN 'health'
        WHEN 'VIE'         THEN 'life'
        WHEN 'LPP'         THEN 'life'
        WHEN 'AUTO'        THEN 'auto'
        WHEN 'MENAGE_RC'   THEN 'home'
        WHEN 'JURIDIQUE'   THEN 'legal'
        WHEN 'VOYAGE'      THEN 'home'
        WHEN 'ENTREPRISE'  THEN 'rcpro'
        WHEN 'HYPO_CREDIT' THEN 'life'
        ELSE 'home'
      END;

      -- insurance_products is global (no tenant_id column). Advisy scoping
      -- comes from tenant_branch_id which references Advisy's branches.
      INSERT INTO public.insurance_products (
        company_id, name, category, tenant_branch_id
      ) VALUES (
        v_company_id, r.product_name, v_legacy_category, v_branch_id
      )
      ON CONFLICT (company_id, name) DO UPDATE
        SET tenant_branch_id = EXCLUDED.tenant_branch_id;

      v_inserted := v_inserted + 1;
    END;
  END LOOP;

  RAISE NOTICE '=== Advisy product catalog seeded ===';
  RAISE NOTICE 'Inserted/updated: % | Skipped: %', v_inserted, v_skipped;
END;
$$;
