-- ============================================================================
-- PHASE 1 — Catalogue partenaires "parfait"
-- ============================================================================
-- Objectif : que chaque produit du catalogue porte une branche claire
-- (AUTO / LAMAL / LCA / PGM / ACCIDENT / VIE / LPP / HYPO_CREDIT /
-- MENAGE_RC / JURIDIQUE / VOYAGE / ENTREPRISE), indépendamment du tenant.
--
-- Aujourd'hui la branche est portée par `tenant_branch_id` (FK par-tenant),
-- ce qui rend impossible la classification des ~380 produits globaux
-- (tenant_id NULL). On ajoute donc un champ `branch_code` directement sur
-- la table, source de vérité pour le scan et le formulaire contrat.
-- ============================================================================

-- 1. Ajout colonne avec CHECK constraint
ALTER TABLE public.insurance_products
  ADD COLUMN IF NOT EXISTS branch_code TEXT;

ALTER TABLE public.insurance_products
  DROP CONSTRAINT IF EXISTS insurance_products_branch_code_check;

ALTER TABLE public.insurance_products
  ADD CONSTRAINT insurance_products_branch_code_check
  CHECK (branch_code IS NULL OR branch_code IN (
    'AUTO','LAMAL','LCA','PGM','ACCIDENT','VIE','LPP',
    'HYPO_CREDIT','MENAGE_RC','JURIDIQUE','VOYAGE','ENTREPRISE'
  ));

COMMENT ON COLUMN public.insurance_products.branch_code IS
  'Branche métier canonique du produit. Source de vérité pour le scan et le contrat. Indépendant du tenant (tenant_branch_id reste pour les overrides spécifiques tenant).';

-- 2. Backfill depuis l'existant : produits qui ont déjà tenant_branch_id
UPDATE public.insurance_products p
SET branch_code = b.code
FROM public.tenant_branches b
WHERE p.branch_code IS NULL
  AND p.tenant_branch_id = b.id
  AND b.code IN (
    'AUTO','LAMAL','LCA','PGM','ACCIDENT','VIE','LPP',
    'HYPO_CREDIT','MENAGE_RC','JURIDIQUE','VOYAGE','ENTREPRISE'
  );

-- 3. Heuristique nom → branche (ordre = du plus spécifique au plus générique)
-- Note : on utilise des motifs robustes (accents, espaces, ponctuation tolérés)

-- LAMAL (assurance de base obligatoire)
UPDATE public.insurance_products SET branch_code = 'LAMAL'
WHERE branch_code IS NULL
  AND (name ~* '\mlamal\M'
       OR name ~* '\maos\M'
       OR name ~* 'assurance.{0,3}de.{0,3}base'
       OR name ~* 'base.{0,3}obligatoire'
       OR name ~* 'assurance.{0,3}maladie.{0,3}de.{0,3}base'
       OR name ~* 'assurance.{0,3}obligatoire.{0,3}des.{0,3}soins');

-- LCA (hospitalisation, complémentaire, ambulatoire, dentaire, médecine alternative)
UPDATE public.insurance_products SET branch_code = 'LCA'
WHERE branch_code IS NULL
  AND (name ~* '\mlca\M'
       OR name ~* '\mhospi\M' OR name ~* 'hospital'
       OR name ~* 'complementaire' OR name ~* 'complémentaire'
       OR name ~* 'ambulatoire'
       OR name ~* 'dentaire' OR name ~* 'dental'
       OR name ~* 'maternite' OR name ~* 'maternité'
       OR name ~* 'medecine.{0,3}(alternative|naturelle)' OR name ~* 'médecine.{0,3}(alternative|naturelle)'
       OR name ~* 'compl[eé]t[eé]e'
       OR name ~* 'spital');

-- PGM (perte de gain maladie)
UPDATE public.insurance_products SET branch_code = 'PGM'
WHERE branch_code IS NULL
  AND (name ~* 'perte.{0,3}de.{0,3}gain'
       OR name ~* '\mpgm\M'
       OR name ~* 'indemnit[eé].{0,3}journali[eè]re'
       OR name ~* 'krankentaggeld');

-- ACCIDENT (LAA, accident)
UPDATE public.insurance_products SET branch_code = 'ACCIDENT'
WHERE branch_code IS NULL
  AND (name ~* '\maccident\M'
       OR name ~* '\munfall\M'
       OR name ~* '\mlaa\M');

-- LPP (2e pilier, prévoyance professionnelle)
UPDATE public.insurance_products SET branch_code = 'LPP'
WHERE branch_code IS NULL
  AND (name ~* '\mlpp\M'
       OR name ~* '\mbvg\M'
       OR name ~* '2e.{0,3}pilier' OR name ~* '2[eè]me.{0,3}pilier' OR name ~* 'deuxi[eè]me.{0,3}pilier'
       OR name ~* 'pr[eé]voyance.{0,3}professionnelle');

-- VIE (3e pilier A/B, risque décès, mixte, rente, vie individuelle)
UPDATE public.insurance_products SET branch_code = 'VIE'
WHERE branch_code IS NULL
  AND (name ~* '\m3.?[ab]\M'
       OR name ~* 'pilier'
       OR name ~* 'pr[eé]voyance'
       OR name ~* 'smartflex'
       OR name ~* 'prosperity'
       OR name ~* 'd[eé]c[eè]s'
       OR name ~* 'risque.{0,3}d[eé]c[eè]s'
       OR name ~* '\mvie\M'
       OR name ~* 'leben'
       OR name ~* 'rente');

-- AUTO (casco, RC auto, véhicule, moto)
UPDATE public.insurance_products SET branch_code = 'AUTO'
WHERE branch_code IS NULL
  AND (name ~* 'casco'
       OR name ~* 'v[eé]hicule'
       OR name ~* 'automobile'
       OR name ~* '\mauto\M'
       OR name ~* 'moto'
       OR name ~* 'voiture'
       OR name ~* 'rc.{0,3}auto'
       OR name ~* 'auto.{0,3}rc');

-- JURIDIQUE (protection juridique, rechtsschutz)
UPDATE public.insurance_products SET branch_code = 'JURIDIQUE'
WHERE branch_code IS NULL
  AND (name ~* 'juridique'
       OR name ~* 'rechtsschutz'
       OR name ~* 'legal.{0,3}protection'
       OR name ~* 'protection.{0,3}judiciaire');

-- VOYAGE (assurance voyage)
UPDATE public.insurance_products SET branch_code = 'VOYAGE'
WHERE branch_code IS NULL
  AND (name ~* 'voyage'
       OR name ~* '\mreise\M'
       OR name ~* 'travel'
       OR name ~* '\massistance\M');

-- ENTREPRISE (RC pro, entreprise, professionnel)
UPDATE public.insurance_products SET branch_code = 'ENTREPRISE'
WHERE branch_code IS NULL
  AND (name ~* 'entreprise'
       OR name ~* 'professionnel'
       OR name ~* 'rc.{0,3}pro'
       OR name ~* '\mrcpro\M'
       OR name ~* 'unternehmen'
       OR name ~* 'business');

-- HYPO_CREDIT (hypothèque, crédit, SARON, LIBOR, amortissement)
UPDATE public.insurance_products SET branch_code = 'HYPO_CREDIT'
WHERE branch_code IS NULL
  AND (name ~* 'hypoth[eè]que'
       OR name ~* 'hypothek'
       OR name ~* 'cr[eé]dit'
       OR name ~* 'kredit'
       OR name ~* 'saron'
       OR name ~* 'libor'
       OR name ~* 'taux.{0,3}fixe'
       OR name ~* 'taux.{0,3}variable'
       OR name ~* 'amortissement');

-- MENAGE_RC (ménage, RC privée, inventaire, hausrat) — placé en dernier
-- car "RC" tout court peut être ambigu, on traite après les cas spécifiques.
UPDATE public.insurance_products SET branch_code = 'MENAGE_RC'
WHERE branch_code IS NULL
  AND (name ~* 'm[eé]nage'
       OR name ~* 'inventaire'
       OR name ~* 'hausrat'
       OR name ~* 'rc.{0,3}priv[eé]e'
       OR name ~* 'rc.{0,3}m[eé]nage'
       OR name ~* 'responsabilit[eé].{0,3}civile'
       OR name ~* '\mrc\M');

-- 4. Fallback par main_category pour ce qui reste
-- (couvre les noms exotiques qu'on n'a pas su matcher)
UPDATE public.insurance_products SET branch_code = 'VIE'
  WHERE branch_code IS NULL AND main_category = 'VIE';
UPDATE public.insurance_products SET branch_code = 'LCA'
  WHERE branch_code IS NULL AND main_category = 'LCA';
UPDATE public.insurance_products SET branch_code = 'MENAGE_RC'
  WHERE branch_code IS NULL AND main_category = 'NON_VIE';
UPDATE public.insurance_products SET branch_code = 'HYPO_CREDIT'
  WHERE branch_code IS NULL AND main_category = 'HYPO';

-- 5. Corrections explicites des 4 anomalies identifiées dans l'audit
-- (re-applique au cas où l'heuristique aurait été imprécise)
UPDATE public.insurance_products
SET branch_code = 'VIE'
WHERE name IN ('Zugerberg Finanz 3a', 'Zugerberg Finanz 3a Revo');

UPDATE public.insurance_products
SET branch_code = 'LCA', tenant_branch_id = NULL
WHERE id IN (
  'a3790a73-91f7-4706-881b-754cbe46579f', -- Assurance ambulatoire myFlex (LCA)
  'c6a9c323-ec42-4361-89de-99642a23be6a'  -- Assurance pour médecine alternative (LCA)
);

-- 6. Index pour les filtres rapides côté UI Partenaires et scan
CREATE INDEX IF NOT EXISTS idx_insurance_products_branch_code
  ON public.insurance_products(branch_code)
  WHERE is_active = true;

-- 7. Rapport : produits NON CLASSÉS (Habib les corrige à la main dans l'UI)
DO $$
DECLARE
  r RECORD;
  v_count INT := 0;
  v_total INT;
  v_classified INT;
BEGIN
  SELECT count(*) INTO v_total FROM public.insurance_products WHERE is_active = true;
  SELECT count(*) INTO v_classified FROM public.insurance_products
    WHERE is_active = true AND branch_code IS NOT NULL;

  RAISE NOTICE '';
  RAISE NOTICE '=== RÉCAP BACKFILL ===';
  RAISE NOTICE '  Total produits actifs       : %', v_total;
  RAISE NOTICE '  Classés avec branch_code    : % (%%%)',
    v_classified, ROUND(100.0 * v_classified / NULLIF(v_total,0), 1);
  RAISE NOTICE '  NON classés (à corriger UI) : %', v_total - v_classified;
  RAISE NOTICE '';

  IF v_total - v_classified > 0 THEN
    RAISE NOTICE '=== PRODUITS NON CLASSÉS (max 50) ===';
    FOR r IN
      SELECT p.id, p.name, c.name AS company, p.main_category
      FROM public.insurance_products p
      LEFT JOIN public.insurance_companies c ON c.id = p.company_id
      WHERE p.is_active = true AND p.branch_code IS NULL
      ORDER BY c.name, p.name
      LIMIT 50
    LOOP
      v_count := v_count + 1;
      RAISE NOTICE '  % | "%" (% / main=%)', r.id, r.name, r.company, r.main_category;
    END LOOP;
  END IF;

  -- Distribution par branche pour validation visuelle
  RAISE NOTICE '';
  RAISE NOTICE '=== DISTRIBUTION PAR BRANCHE ===';
  FOR r IN
    SELECT branch_code, count(*) AS cnt
    FROM public.insurance_products
    WHERE is_active = true
    GROUP BY branch_code
    ORDER BY cnt DESC
  LOOP
    RAISE NOTICE '  % : % produits', COALESCE(r.branch_code, '(NULL)'), r.cnt;
  END LOOP;
END;
$$;
