-- ============================================================================
-- Type de pilier par produit dans le catalogue (3A / 3B / Vie classique)
-- ============================================================================
-- Feedback Habib (26 juin 2026) : "les noms des produits peuvent être 3A ou
-- 3B il faut pouvoir distinguer pour la visualisation rapide".
--
-- 1re itération : détection auto regex sur le nom (lib/lifePillar) → couvre
-- les noms explicites genre "Helsana Vita 3a", "Säule 3b Mobilière".
-- Mais BEAUCOUP de produits de prévoyance ont des noms commerciaux qui ne
-- contiennent ni "3a" ni "3b" :
--   · "Swiss Life Dynamic Elements" — souscrit en 3A ou 3B selon client
--   · "AXA Smart Vorsorge"
--   · "Generali EasyFlex"
-- → l'auto-detect n'arrive pas à conclure et le badge ne s'affiche pas.
--
-- Solution structurelle : on ajoute une colonne `life_pillar` nullable sur
-- `insurance_products`. L'admin/king va sur le produit dans le catalogue
-- et tag manuellement son type par défaut. Tous les nouveaux contrats
-- héritent. Le courtier peut overrider sur un contrat particulier via le
-- selector du ContractForm (la valeur stockée sur le contrat dans
-- products_data.pillarType prime).
--
-- Migration STRICTEMENT additive : nouvelle colonne nullable, valeur NULL
-- par défaut → aucun produit existant n'est modifié. La détection regex
-- sur le nom reste comme fallback de 2e niveau.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'insurance_products'
      AND column_name = 'life_pillar'
  ) THEN
    ALTER TABLE public.insurance_products
      ADD COLUMN life_pillar TEXT NULL;

    -- CHECK constraint : valeurs autorisées seulement
    -- (on accepte NULL = "non applicable / pas un produit Vie")
    ALTER TABLE public.insurance_products
      ADD CONSTRAINT insurance_products_life_pillar_check
      CHECK (life_pillar IS NULL OR life_pillar IN ('pilier_3a', 'pilier_3b', 'vie_classique'));

    COMMENT ON COLUMN public.insurance_products.life_pillar IS
      'Type de pilier pour les produits Vie/Prévoyance. NULL = non applicable ou non taggé. '
      'Valeurs : pilier_3a (lié, déductible fiscal), pilier_3b (libre), vie_classique. '
      'Le courtier peut overrider à la souscription via products_data.pillarType sur le contrat.';
  END IF;
END $$;

-- Index partiel : seuls les produits Vie/Prévoyance taggés sont consultés
-- en grand volume (filtre catalogue, badges fiche contrat, etc.)
CREATE INDEX IF NOT EXISTS idx_insurance_products_life_pillar
  ON public.insurance_products(life_pillar)
  WHERE life_pillar IS NOT NULL;


-- ============================================================================
-- Notification KING
-- ============================================================================
INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
VALUES (
  '🏷️ Catalogue : tag Pilier 3A/3B par produit',
  'Ajout d''une colonne nullable `insurance_products.life_pillar` (CHECK pilier_3a/pilier_3b/vie_classique). Permet à l''admin/king de tagger explicitement un produit de prévoyance par son type par défaut, pour les cas où le nom commercial ne suffit pas (ex: "Swiss Life Dynamic Elements"). Le badge dans le catalogue + ContractForm + fiche contrat utilisent maintenant priorité : (1) pillarType saisi sur le contrat > (2) product.life_pillar du catalogue > (3) détection auto regex sur le nom. Migration additive zéro impact data.',
  'system_info',
  'normal',
  jsonb_build_object(
    'migration', '20260626180000_insurance_products_life_pillar',
    'new_column', 'insurance_products.life_pillar',
    'priority_chain', jsonb_build_array('contract.pillarType', 'product.life_pillar', 'detect_from_name')
  )
);
