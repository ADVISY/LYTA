-- ============================================================================
-- tenant_branding : split company_address → adresse / NPA / localité
-- ============================================================================
-- Avant : tenant_branding.company_address = un seul champ texte libre, ex:
--   "Route de Denges 28D 1027 Lonay"  ou  "Av. de la Gare 12, 1003 Lausanne"
--
-- Conséquences :
-- 1. UX : pas de validation NPA, pas de séparation propre
-- 2. QR-bill : QRInvoicePreview tentait un parse fragile via split(',') puis
--    regex /^(\d{4})\s*(.*)$/ — qui échoue quand l'admin ne met pas de virgule
--    (cas JCG : "Route de Denges 28D 1027 Lonay" → NPA non extrait → QR
--    invalide ou rejeté par la banque).
--
-- Fix : ajout de 2 colonnes structurées + backfill best-effort + future-proof
-- (le front saisit séparément, mais la column company_address est gardée pour
-- compat back-end lecture).
-- ============================================================================

-- 1. Ajout des nouvelles colonnes
ALTER TABLE public.tenant_branding
  ADD COLUMN IF NOT EXISTS company_postal_code text,
  ADD COLUMN IF NOT EXISTS company_city text;

-- 2. Backfill : on essaie d'extraire NPA (4 chiffres) + ville depuis l'existant
--    Formats supportés :
--      "Rue X 12, 1003 Lausanne"
--      "Rue X 12 1003 Lausanne"
--      "Rue X 12, Lausanne 1003"  (rare)
DO $$
DECLARE
  r RECORD;
  v_npa text;
  v_city text;
  v_rest text;
BEGIN
  FOR r IN SELECT tenant_id, company_address FROM public.tenant_branding
           WHERE company_address IS NOT NULL
             AND length(trim(company_address)) > 0
             AND (company_postal_code IS NULL OR company_city IS NULL)
  LOOP
    -- Cherche un NPA de 4 chiffres dans l'adresse
    v_npa := (regexp_match(r.company_address, '\m(\d{4})\M'))[1];

    IF v_npa IS NOT NULL THEN
      -- Extrait ce qui suit le NPA comme ville (jusqu'à fin de chaîne)
      v_city := trim((regexp_match(r.company_address, '\m\d{4}\s+([A-Za-zÀ-ÿ\-\.\s]+)$'))[1]);

      UPDATE public.tenant_branding
      SET company_postal_code = v_npa,
          company_city = NULLIF(v_city, '')
      WHERE tenant_id = r.tenant_id
        AND (company_postal_code IS NULL OR company_city IS NULL);
    END IF;
  END LOOP;
END $$;

-- 3. Index utile sur (tenant_id, company_postal_code) — peu d'écritures, lecture
--    fréquente pour QR-bill / factures.
CREATE INDEX IF NOT EXISTS idx_tenant_branding_postal_code
  ON public.tenant_branding (company_postal_code)
  WHERE company_postal_code IS NOT NULL;

-- ============================================================================
-- King notification
-- ============================================================================
INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
VALUES (
  'tenant_branding : split adresse cabinet (rue / NPA / localite)',
  'Ajout des colonnes company_postal_code + company_city. Backfill best-effort sur les fiches existantes via regex. Cabinet info UI a separer aussi en 3 champs.',
  'system_info', 'low',
  jsonb_build_object(
    'migration', '20260527180000_tenant_branding_split_address',
    'columns_added', ARRAY['company_postal_code', 'company_city']
  )
);
