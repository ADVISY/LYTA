-- Ajouter les taux de commission spécifiques par type de produit
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS commission_rate_lca NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS commission_rate_vie NUMERIC DEFAULT 0;

-- Commentaires
COMMENT ON COLUMN public.clients.commission_rate_lca IS 'Taux de commission LCA (assurance complémentaire) en pourcentage';
COMMENT ON COLUMN public.clients.commission_rate_vie IS 'Taux de commission VIE (3ème pilier) en pourcentage';