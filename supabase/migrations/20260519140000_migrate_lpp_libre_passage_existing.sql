-- ============================================================================
-- Migration : contrats LPP libre passage existants → repositionner premium en avoirTotal
-- ============================================================================
-- Avant le fix du form (commit "feat(lpp): champ Montant d'avoirs"), les brokers
-- mettaient le capital LPP dans le champ "Prime" faute d'autre option. Cette
-- migration corrige les contrats existants :
-- 1. Trouve toutes les policies où products_data contient un produit avec
--    "libre passage" dans le nom
-- 2. Pour chaque produit LPP libre passage, MOVE premium → avoirTotal
--    (si avoirTotal absent et premium > 0)
-- 3. Recalcule policies.premium_monthly et premium_yearly à partir du sum
--    des premiums RESTANTS (les LPP comptent désormais pour 0 dans le total)
-- ============================================================================

-- Étape 1 : update products_data pour chaque ligne LPP libre passage
UPDATE public.policies
   SET products_data = (
     SELECT jsonb_agg(
       CASE
         WHEN p->>'name' ~* 'libre[\s_-]?passage'
              AND (p->'avoirTotal' IS NULL OR p->>'avoirTotal' = '' OR p->>'avoirTotal' = 'null')
              AND COALESCE((p->>'premium')::numeric, 0) > 0
         THEN
           jsonb_set(
             jsonb_set(p, '{avoirTotal}', to_jsonb(COALESCE((p->>'premium')::numeric, 0))),
             '{premium}',
             '0'::jsonb
           )
         ELSE p
       END
     )
     FROM jsonb_array_elements(products_data) AS p
   )
 WHERE products_data IS NOT NULL
   AND jsonb_typeof(products_data) = 'array'
   AND EXISTS (
     SELECT 1
       FROM jsonb_array_elements(products_data) AS p
      WHERE p->>'name' ~* 'libre[\s_-]?passage'
        AND COALESCE((p->>'premium')::numeric, 0) > 0
        AND (p->'avoirTotal' IS NULL OR p->>'avoirTotal' = '' OR p->>'avoirTotal' = 'null')
   );

-- Étape 2 : recalculer premium_monthly / premium_yearly à partir des produits
-- (maintenant que les LPP libre passage ont premium=0, le total baisse)
UPDATE public.policies
   SET premium_monthly = COALESCE((
       SELECT SUM(COALESCE((p->>'premium')::numeric, 0))
         FROM jsonb_array_elements(products_data) AS p
     ), 0),
       premium_yearly = COALESCE((
       SELECT SUM(COALESCE((p->>'premium')::numeric, 0)) * 12
         FROM jsonb_array_elements(products_data) AS p
     ), 0),
       updated_at = NOW()
 WHERE products_data IS NOT NULL
   AND jsonb_typeof(products_data) = 'array'
   AND EXISTS (
     SELECT 1 FROM jsonb_array_elements(products_data) p
      WHERE p->>'name' ~* 'libre[\s_-]?passage'
   );

-- Étape 3 : log audit (king notification pour visibilité)
INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
SELECT
  '🔄 Migration LPP libre passage',
  format('%s contrat(s) LPP libre passage migré(s) : premium → avoirTotal',
         (SELECT COUNT(*) FROM public.policies
            WHERE products_data IS NOT NULL
              AND EXISTS (SELECT 1 FROM jsonb_array_elements(products_data) p
                           WHERE p->>'name' ~* 'libre[\s_-]?passage'))),
  'system_info', 'low',
  jsonb_build_object('migration', '20260519140000_migrate_lpp_libre_passage')
WHERE EXISTS (
  SELECT 1 FROM public.policies
    WHERE products_data IS NOT NULL
      AND EXISTS (SELECT 1 FROM jsonb_array_elements(products_data) p
                   WHERE p->>'name' ~* 'libre[\s_-]?passage')
);
