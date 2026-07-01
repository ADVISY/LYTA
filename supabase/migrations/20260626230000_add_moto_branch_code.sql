-- ============================================================================
-- Séparation MOTO de la branche AUTO
-- ============================================================================
-- Habib (26 juin 2026) : "il manque MOTO etc" — actuellement AUTO regroupe
-- Auto + Moto (label "Auto / Moto"). Séparer permet :
--   · Filtrer les portefeuilles moto (différent risque/marché)
--   · Commissions distinctes chez certaines compagnies
--   · Statistiques pertinentes cabinet vs cabinet
--
-- Migration :
--   1. Étendre le CHECK constraint de insurance_products.branch_code pour
--      accepter MOTO en plus des 12 valeurs existantes.
--   2. Aucun backfill : les produits déjà catégorisés AUTO restent AUTO.
--      Les nouveaux produits Moto peuvent être créés avec MOTO.
--
-- Migration STRICTEMENT additive : élargit la contrainte sans invalider
-- de data existante.
--
-- Pour les tenants qui veulent tagger leurs propres branches personnalisées,
-- utiliser la table tenant_branches (déjà en place) via l'UI CRMParametres
-- → Catalogues (livrée dans le même commit front).
-- ============================================================================

-- Le pattern : DROP puis re-CREATE avec la nouvelle liste
ALTER TABLE public.insurance_products
  DROP CONSTRAINT IF EXISTS insurance_products_branch_code_check;

ALTER TABLE public.insurance_products
  ADD CONSTRAINT insurance_products_branch_code_check
  CHECK (branch_code IS NULL OR branch_code IN (
    'AUTO','MOTO','LAMAL','LCA','PGM','ACCIDENT','VIE','LPP',
    'HYPO_CREDIT','MENAGE_RC','JURIDIQUE','VOYAGE','ENTREPRISE'
  ));


-- Notification KING
INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
VALUES (
  '🏍️ Catalogue : nouvelle branche MOTO',
  'Ajout de MOTO au CHECK constraint de insurance_products.branch_code. Séparation Auto/Moto pour permettre commissions + stats distinctes. Migration additive : les produits AUTO existants restent AUTO. Pour tagger les nouveaux comme MOTO, les compagnies doivent créer un produit distinct. Les tenants peuvent aussi créer leurs propres branches via CRMParametres → Catalogues → Types d''assurances (nouvel onglet livré dans le même commit).',
  'system_info',
  'normal',
  jsonb_build_object(
    'migration', '20260626230000_add_moto_branch_code',
    'new_branch_code', 'MOTO',
    'total_branches', 13
  )
);
