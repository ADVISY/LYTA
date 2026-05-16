-- ============================================================================
-- URGENT — Performance clients RLS pour les gros tenants (1000+ adresses)
-- ============================================================================
-- JCG Consulting a importé 1000 contacts et ne peut plus accéder à l'onglet
-- Adresses (timeout 12s). Cause : RLS clients SELECT fait 3 EXISTS croisés
-- sur user_tenant_assignments et user_tenant_roles. Sans index composé sur
-- (user_id, tenant_id), Postgres scan la table à chaque check.
--
-- Fix : ajout index composés qui accélèrent les 3 EXISTS du RLS clients.
-- Effet attendu : query 12s+ → < 500ms.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_user_tenant_assignments_user_tenant
  ON public.user_tenant_assignments(user_id, tenant_id);

-- Index composé sur user_tenant_roles (utilisé dans la 3e EXISTS du RLS)
CREATE INDEX IF NOT EXISTS idx_user_tenant_roles_user_role
  ON public.user_tenant_roles(user_id, role_id, tenant_id);

-- Statistiques actualisées sur la table clients pour le planner
ANALYZE public.clients;
ANALYZE public.user_tenant_assignments;
ANALYZE public.user_tenant_roles;

DO $$
DECLARE v_jcg_count INT;
BEGIN
  SELECT count(*) INTO v_jcg_count
  FROM public.clients
  WHERE tenant_id = '7af2904e-a965-443b-9e21-7b7136cc0eaa';
  RAISE NOTICE 'JCG Consulting : % clients en base', v_jcg_count;
END $$;
