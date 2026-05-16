-- READ-ONLY audit: catalogue companies / branches / products
-- Lists every incoherent row so Habib can decide what to fix.
-- No INSERT / UPDATE / DELETE — only RAISE NOTICE.
DO $$
DECLARE
  v_advisy UUID;
  v_count INT;
  r RECORD;
BEGIN
  SELECT id INTO v_advisy FROM public.tenants WHERE slug = 'advisy';

  -- ============================================================
  -- 1. PRODUITS 3A / 3B HORS BRANCHE VIE
  -- ============================================================
  RAISE NOTICE '=== [1] PRODUITS 3A / 3B HORS BRANCHE VIE ===';
  v_count := 0;
  FOR r IN
    SELECT p.id, p.name, c.name AS company, b.code AS branch_code,
           p.category, p.subcategory, p.tenant_id
    FROM public.insurance_products p
    LEFT JOIN public.insurance_companies c ON c.id = p.company_id
    LEFT JOIN public.tenant_branches b ON b.id = p.tenant_branch_id
    WHERE (p.name ~* '\m3\s?a\M' OR p.name ~* '\m3\s?b\M'
           OR p.name ~* 'pilier|prevoyance|prévoyance')
      AND COALESCE(b.code, '') <> 'VIE'
    ORDER BY c.name, p.name
  LOOP
    v_count := v_count + 1;
    RAISE NOTICE '  % | "%" (compagnie %, branche=%, cat=%, sub=%) tenant=%',
      r.id, r.name, r.company, r.branch_code, r.category, r.subcategory, r.tenant_id;
  END LOOP;
  RAISE NOTICE '  → % anomalie(s)', v_count;

  -- ============================================================
  -- 2. PRODUITS LAMAL HORS BRANCHE LAMAL
  -- ============================================================
  RAISE NOTICE '';
  RAISE NOTICE '=== [2] PRODUITS LAMAL HORS BRANCHE LAMAL ===';
  v_count := 0;
  FOR r IN
    SELECT p.id, p.name, c.name AS company, b.code AS branch_code, p.tenant_id
    FROM public.insurance_products p
    LEFT JOIN public.insurance_companies c ON c.id = p.company_id
    LEFT JOIN public.tenant_branches b ON b.id = p.tenant_branch_id
    WHERE p.name ~* '\m(lamal|aos|assurance.de.base|base.obligatoire)\M'
      AND COALESCE(b.code, '') NOT IN ('LAMAL')
    ORDER BY c.name, p.name
  LOOP
    v_count := v_count + 1;
    RAISE NOTICE '  % | "%" (% / branche=%) tenant=%',
      r.id, r.name, r.company, r.branch_code, r.tenant_id;
  END LOOP;
  RAISE NOTICE '  → % anomalie(s)', v_count;

  -- ============================================================
  -- 3. PRODUITS LCA / HOSPITALISATION HORS LCA
  -- ============================================================
  RAISE NOTICE '';
  RAISE NOTICE '=== [3] PRODUITS LCA / HOSPITALISATION HORS BRANCHE LCA ===';
  v_count := 0;
  FOR r IN
    SELECT p.id, p.name, c.name AS company, b.code AS branch_code, p.tenant_id
    FROM public.insurance_products p
    LEFT JOIN public.insurance_companies c ON c.id = p.company_id
    LEFT JOIN public.tenant_branches b ON b.id = p.tenant_branch_id
    WHERE p.name ~* '\m(hospi|hospital|complementaire|complémentaire|lca|ambulatoire)\M'
      AND COALESCE(b.code, '') NOT IN ('LCA','PGM')
    ORDER BY c.name, p.name
  LOOP
    v_count := v_count + 1;
    RAISE NOTICE '  % | "%" (% / branche=%) tenant=%',
      r.id, r.name, r.company, r.branch_code, r.tenant_id;
  END LOOP;
  RAISE NOTICE '  → % anomalie(s)', v_count;

  -- ============================================================
  -- 4. PRODUITS AUTO / MOTO HORS BRANCHE AUTO
  -- ============================================================
  RAISE NOTICE '';
  RAISE NOTICE '=== [4] PRODUITS AUTO / MOTO HORS BRANCHE AUTO ===';
  v_count := 0;
  FOR r IN
    SELECT p.id, p.name, c.name AS company, b.code AS branch_code, p.tenant_id
    FROM public.insurance_products p
    LEFT JOIN public.insurance_companies c ON c.id = p.company_id
    LEFT JOIN public.tenant_branches b ON b.id = p.tenant_branch_id
    WHERE p.name ~* '\m(casco|véhicule|vehicule|rc.auto|auto.casco|moto.casco)\M'
      AND COALESCE(b.code, '') <> 'AUTO'
    ORDER BY c.name, p.name
  LOOP
    v_count := v_count + 1;
    RAISE NOTICE '  % | "%" (% / branche=%) tenant=%',
      r.id, r.name, r.company, r.branch_code, r.tenant_id;
  END LOOP;
  RAISE NOTICE '  → % anomalie(s)', v_count;

  -- ============================================================
  -- 5. PRODUITS MÉNAGE / RC PRIVÉE HORS MENAGE_RC
  -- ============================================================
  RAISE NOTICE '';
  RAISE NOTICE '=== [5] PRODUITS MÉNAGE / RC PRIVÉE HORS MENAGE_RC ===';
  v_count := 0;
  FOR r IN
    SELECT p.id, p.name, c.name AS company, b.code AS branch_code, p.tenant_id
    FROM public.insurance_products p
    LEFT JOIN public.insurance_companies c ON c.id = p.company_id
    LEFT JOIN public.tenant_branches b ON b.id = p.tenant_branch_id
    WHERE p.name ~* '\m(ménage|menage|inventaire|rc.privee|rc.privée|hausrat|responsabilite.civile|responsabilité.civile)\M'
      AND COALESCE(b.code, '') NOT IN ('MENAGE_RC','ENTREPRISE')
    ORDER BY c.name, p.name
  LOOP
    v_count := v_count + 1;
    RAISE NOTICE '  % | "%" (% / branche=%) tenant=%',
      r.id, r.name, r.company, r.branch_code, r.tenant_id;
  END LOOP;
  RAISE NOTICE '  → % anomalie(s)', v_count;

  -- ============================================================
  -- 6. PROTECTION JURIDIQUE HORS JURIDIQUE
  -- ============================================================
  RAISE NOTICE '';
  RAISE NOTICE '=== [6] PROTECTION JURIDIQUE HORS JURIDIQUE ===';
  v_count := 0;
  FOR r IN
    SELECT p.id, p.name, c.name AS company, b.code AS branch_code, p.tenant_id
    FROM public.insurance_products p
    LEFT JOIN public.insurance_companies c ON c.id = p.company_id
    LEFT JOIN public.tenant_branches b ON b.id = p.tenant_branch_id
    WHERE p.name ~* '\m(juridique|legal.protection|rechtsschutz|protection.judiciaire)\M'
      AND COALESCE(b.code, '') <> 'JURIDIQUE'
    ORDER BY c.name, p.name
  LOOP
    v_count := v_count + 1;
    RAISE NOTICE '  % | "%" (% / branche=%) tenant=%',
      r.id, r.name, r.company, r.branch_code, r.tenant_id;
  END LOOP;
  RAISE NOTICE '  → % anomalie(s)', v_count;

  -- ============================================================
  -- 7. PRODUITS SANS BRANCHE
  -- ============================================================
  RAISE NOTICE '';
  RAISE NOTICE '=== [7] PRODUITS SANS BRANCHE (tenant_branch_id NULL) ===';
  v_count := 0;
  FOR r IN
    SELECT p.id, p.name, c.name AS company, p.category, p.status, p.tenant_id
    FROM public.insurance_products p
    LEFT JOIN public.insurance_companies c ON c.id = p.company_id
    WHERE p.tenant_branch_id IS NULL
      AND p.is_active = true
    ORDER BY c.name, p.name
    LIMIT 30
  LOOP
    v_count := v_count + 1;
    RAISE NOTICE '  % | "%" (% / cat=%, status=%) tenant=%',
      r.id, r.name, r.company, r.category, r.status, r.tenant_id;
  END LOOP;
  RAISE NOTICE '  → % anomalie(s) (max 30 affichés)', v_count;

  -- ============================================================
  -- 8. PRODUITS SANS COMPAGNIE
  -- ============================================================
  RAISE NOTICE '';
  RAISE NOTICE '=== [8] PRODUITS SANS COMPAGNIE (company_id NULL) ===';
  v_count := 0;
  FOR r IN
    SELECT p.id, p.name, p.category, p.status, p.tenant_id
    FROM public.insurance_products p
    WHERE p.company_id IS NULL
      AND p.is_active = true
    ORDER BY p.name
    LIMIT 30
  LOOP
    v_count := v_count + 1;
    RAISE NOTICE '  % | "%" (cat=%, status=%) tenant=%',
      r.id, r.name, r.category, r.status, r.tenant_id;
  END LOOP;
  RAISE NOTICE '  → % anomalie(s) (max 30 affichés)', v_count;

  -- ============================================================
  -- 9. COMPAGNIES NON UTILISÉES (orphan, peut-être doublons)
  -- ============================================================
  RAISE NOTICE '';
  RAISE NOTICE '=== [9] COMPAGNIES SANS AUCUN PRODUIT ===';
  v_count := 0;
  FOR r IN
    SELECT c.id, c.name
    FROM public.insurance_companies c
    WHERE NOT EXISTS (SELECT 1 FROM public.insurance_products p WHERE p.company_id = c.id)
    ORDER BY c.name
    LIMIT 30
  LOOP
    v_count := v_count + 1;
    RAISE NOTICE '  % | "%"', r.id, r.name;
  END LOOP;
  RAISE NOTICE '  → % anomalie(s) (max 30 affichés)', v_count;

  -- ============================================================
  -- 10. COMPAGNIES DOUBLONS (même nom normalisé)
  -- ============================================================
  RAISE NOTICE '';
  RAISE NOTICE '=== [10] COMPAGNIES DOUBLONS (même nom normalisé) ===';
  v_count := 0;
  FOR r IN
    SELECT lower(regexp_replace(name, '\s+(SA|AG|Holding|Assurance.maladie|Versicherung)\s*$', '', 'gi')) AS norm,
           array_agg(name ORDER BY name) AS names,
           array_agg(id ORDER BY id) AS ids,
           count(*) AS cnt
    FROM public.insurance_companies
    GROUP BY 1
    HAVING count(*) > 1
    ORDER BY cnt DESC
  LOOP
    v_count := v_count + 1;
    RAISE NOTICE '  "%" → % occurrence(s) : %', r.norm, r.cnt, r.names;
  END LOOP;
  RAISE NOTICE '  → % groupe(s) en doublon', v_count;

  -- ============================================================
  -- 11. PRODUITS DOUBLONS (même compagnie + nom normalisé)
  -- ============================================================
  RAISE NOTICE '';
  RAISE NOTICE '=== [11] PRODUITS DOUBLONS (même compagnie + nom normalisé) ===';
  v_count := 0;
  FOR r IN
    SELECT p.company_id, c.name AS company,
           lower(regexp_replace(p.name, '\s+', ' ', 'g')) AS norm_name,
           array_agg(p.name ORDER BY p.name) AS names,
           array_agg(p.id ORDER BY p.id) AS ids,
           count(*) AS cnt
    FROM public.insurance_products p
    LEFT JOIN public.insurance_companies c ON c.id = p.company_id
    WHERE p.is_active = true
    GROUP BY p.company_id, c.name, lower(regexp_replace(p.name, '\s+', ' ', 'g'))
    HAVING count(*) > 1
    ORDER BY cnt DESC
    LIMIT 30
  LOOP
    v_count := v_count + 1;
    RAISE NOTICE '  % / "%" → %x : %', r.company, r.norm_name, r.cnt, r.names;
  END LOOP;
  RAISE NOTICE '  → % groupe(s) doublon (max 30 affichés)', v_count;

  -- ============================================================
  -- 12. PRODUITS EN STATUS=pending TRAINANT
  -- ============================================================
  RAISE NOTICE '';
  RAISE NOTICE '=== [12] PRODUITS status=pending (candidats non validés) ===';
  v_count := 0;
  FOR r IN
    SELECT p.id, p.name, c.name AS company, p.created_at, p.tenant_id
    FROM public.insurance_products p
    LEFT JOIN public.insurance_companies c ON c.id = p.company_id
    WHERE p.status = 'pending'
    ORDER BY p.created_at DESC
    LIMIT 30
  LOOP
    v_count := v_count + 1;
    RAISE NOTICE '  % | "%" (% / créé %) tenant=%',
      r.id, r.name, r.company, r.created_at, r.tenant_id;
  END LOOP;
  RAISE NOTICE '  → % pending (max 30 affichés)', v_count;

  -- ============================================================
  -- 13. CATEGORY LEGACY vs BRANCHE — mismatch flagrant
  -- ============================================================
  RAISE NOTICE '';
  RAISE NOTICE '=== [13] MISMATCH category legacy ↔ branche ===';
  v_count := 0;
  FOR r IN
    SELECT p.id, p.name, c.name AS company, p.category, b.code AS branch_code, p.tenant_id
    FROM public.insurance_products p
    LEFT JOIN public.insurance_companies c ON c.id = p.company_id
    LEFT JOIN public.tenant_branches b ON b.id = p.tenant_branch_id
    WHERE p.is_active = true
      AND b.code IS NOT NULL
      AND (
        (b.code = 'AUTO'       AND p.category <> 'auto')
        OR (b.code = 'LAMAL'   AND p.category <> 'health')
        OR (b.code = 'LCA'     AND p.category <> 'health')
        OR (b.code = 'PGM'     AND p.category <> 'health')
        OR (b.code = 'ACCIDENT' AND p.category <> 'health')
        OR (b.code = 'VIE'     AND p.category <> 'life')
        OR (b.code = 'LPP'     AND p.category <> 'life')
        OR (b.code = 'JURIDIQUE' AND p.category <> 'legal')
        OR (b.code = 'ENTREPRISE' AND p.category <> 'rcpro')
      )
    ORDER BY b.code, c.name, p.name
    LIMIT 50
  LOOP
    v_count := v_count + 1;
    RAISE NOTICE '  % | "%" (% / branche=%, cat=%) tenant=%',
      r.id, r.name, r.company, r.branch_code, r.category, r.tenant_id;
  END LOOP;
  RAISE NOTICE '  → % mismatch (max 50 affichés)', v_count;

  -- ============================================================
  -- 14. RÉCAPITULATIF GLOBAL
  -- ============================================================
  RAISE NOTICE '';
  RAISE NOTICE '=== [14] RÉCAPITULATIF GLOBAL ===';
  SELECT count(*) INTO v_count FROM public.insurance_companies;
  RAISE NOTICE '  Total compagnies : %', v_count;
  SELECT count(*) INTO v_count FROM public.insurance_products WHERE is_active = true;
  RAISE NOTICE '  Total produits actifs : %', v_count;
  SELECT count(*) INTO v_count FROM public.insurance_products WHERE status = 'pending';
  RAISE NOTICE '  Total produits pending : %', v_count;
  SELECT count(*) INTO v_count FROM public.tenant_branches WHERE is_active = true;
  RAISE NOTICE '  Total branches actives : %', v_count;

  RAISE NOTICE '';
  RAISE NOTICE '=== FIN AUDIT ===';
END;
$$;
