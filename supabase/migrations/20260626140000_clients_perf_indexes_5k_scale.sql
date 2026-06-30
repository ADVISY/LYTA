-- ============================================================================
-- Perf clients pour tenants à 5000+ contacts
-- ============================================================================
-- Feedback Habib (26 juin 2026) : 'les perfs car avoir 5000 client dans un
-- crm c'est normal'. JCG est déjà à ~1000. On doit scaler.
--
-- Inventaire des indexes existants sur public.clients :
--   ✓ tenant_id, type_adresse, status, assigned_agent_id, email, phone
--   ✓ trigram : first_name, last_name, company_name, email, phone (ILIKE)
--   ✓ composite (tenant_id, type_adresse, created_at DESC)
--   ✓ composite (tenant_id, status, created_at DESC)
--   ✓ composite (tenant_id, city), (tenant_id, canton), (tenant_id, postal_code)
--
-- Manquant pour la liste clients à grande échelle :
--   ✗ (tenant_id, created_at DESC) → cas SANS filtre = le plus fréquent
--     ouverture /crm/clients. Avant : idx_clients_tenant + sort en mémoire.
--   ✗ (tenant_id, is_company, created_at DESC) → filtre Pro/Privé. Sans, on
--     fallback sur idx_clients_tenant + filter + sort = O(n) sur 5000+.
--   ✗ (tenant_id, assigned_agent_id, created_at DESC) → scope-aware
--     Agent/Manager. Le OR avec id complique mais ce composite couvre la
--     branche assigned_agent_id = X qui est la majoritaire.
--
-- Migration STRICTEMENT additive : que des CREATE INDEX IF NOT EXISTS, aucun
-- DROP, aucune contrainte changée, aucune data touchée. Création
-- non-CONCURRENTLY (Supabase migrations sont en transaction, CONCURRENTLY
-- interdit) mais sur 1000-5000 lignes c'est instantané.
-- ============================================================================

-- 1. (tenant_id, created_at DESC) — cas par défaut, page liste sans filtre
CREATE INDEX IF NOT EXISTS idx_clients_tenant_created_at
  ON public.clients (tenant_id, created_at DESC);

-- 2. (tenant_id, is_company, created_at DESC) — filtre Pro / Privé
-- Note : is_company peut être NULL (fiches legacy avant la colonne), le
-- planner gère ça correctement avec un BTree multi-colonnes.
CREATE INDEX IF NOT EXISTS idx_clients_tenant_company_created
  ON public.clients (tenant_id, is_company, created_at DESC);

-- 3. (tenant_id, assigned_agent_id, created_at DESC) — scope-aware Agent
-- Couvre la branche assigned_agent_id = X (la plus fréquente côté Agent qui
-- ne voit que ses fiches assignées). La branche OR id = X bénéficie déjà du
-- PK auto-index.
CREATE INDEX IF NOT EXISTS idx_clients_tenant_agent_created
  ON public.clients (tenant_id, assigned_agent_id, created_at DESC);


-- ============================================================================
-- ANALYZE pour rafraîchir les stats du planner — sinon les nouveaux indexes
-- sont là mais pas utilisés tant que Postgres n'a pas re-compté les stats.
-- ============================================================================
ANALYZE public.clients;


-- ============================================================================
-- Notification KING
-- ============================================================================
INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
VALUES (
  '⚡ Perf clients : indexes pour scale 5000+ contacts',
  'Ajout de 3 indexes composites manquants sur public.clients : (tenant_id, created_at DESC) pour le cas sans filtre, (tenant_id, is_company, created_at DESC) pour le filtre Pro/Privé, et (tenant_id, assigned_agent_id, created_at DESC) pour le scope-aware Agent. ANALYZE en fin de migration pour activer immédiatement le nouveau plan. Combiné avec le cache React Query côté front, devrait tenir les tenants à 5000+ contacts sans dégradation perçue.',
  'system_info',
  'high',
  jsonb_build_object(
    'migration', '20260626140000_clients_perf_indexes_5k_scale',
    'target_scale', '5000_contacts',
    'new_indexes', jsonb_build_array(
      'idx_clients_tenant_created_at',
      'idx_clients_tenant_company_created',
      'idx_clients_tenant_agent_created'
    )
  )
);
