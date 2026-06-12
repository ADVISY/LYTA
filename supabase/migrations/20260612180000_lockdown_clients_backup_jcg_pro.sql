-- ============================================================================
-- lockdown_clients_backup_jcg_pro
-- ============================================================================
-- Table orpheline créée à la main le 25 mai 2026 lors du nettoyage des
-- 709 prospects Pro JCG mal importés (rue tronquée au seul numéro).
-- Backup conservé pour permettre une éventuelle récupération via :
--   INSERT INTO clients SELECT * FROM clients_backup_jcg_pro_20260525
--
-- Problème identifié par Supabase Advisor (12 juin 2026) :
-- 🔴 CRITICAL — RLS disabled + colonne `iban` exposée via API
--    Tout user authentifié peut faire SELECT * sur cette table et
--    récupérer les 709 IBAN + identités JCG.
--
-- Fix : lock down strict
--   1. REVOKE tous droits API (authenticated + anon + PUBLIC)
--   2. ENABLE RLS (double sécurité — même si quelqu'un re-grant
--      par erreur plus tard, aucune row n'est visible sans policy)
--   3. Aucune policy créée → personne ne SELECT, sauf service_role
--      qui bypass RLS (réservé aux edge functions admin)
--
-- Décision DROP table : reportée. La table reste pour récupération
-- éventuelle. Aucun risque tant que RLS strict + REVOKE sont actifs.
-- Quand JCG aura confirmé que tout est OK : DROP TABLE en migration
-- dédiée.
-- ============================================================================

-- Sécurité par ordre de criticité
REVOKE ALL ON public.clients_backup_jcg_pro_20260525 FROM authenticated;
REVOKE ALL ON public.clients_backup_jcg_pro_20260525 FROM anon;
REVOKE ALL ON public.clients_backup_jcg_pro_20260525 FROM PUBLIC;

-- RLS strict — aucune policy = aucune row visible (sauf service_role)
ALTER TABLE public.clients_backup_jcg_pro_20260525 ENABLE ROW LEVEL SECURITY;

-- Marque visuelle qu'il s'agit d'une table en attente de DROP.
COMMENT ON TABLE public.clients_backup_jcg_pro_20260525 IS
  '[BACKUP À DROPPER] Snapshot des 709 prospects Pro JCG du 25 mai 2026 — fenêtre de récupération expirée, à supprimer définitivement après confirmation Habib. RLS strict + REVOKE API actifs (juin 2026).';
