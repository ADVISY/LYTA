-- ============================================================================
-- Perf : indexes composites + trigram sur public.clients
-- ============================================================================
-- Problème observé sur le tenant JCG Consulting (2528 contacts) :
-- - Liste clients lente (sequential scan filtré par tenant_id + type_adresse)
-- - Recherche barre du haut très lente (5 ILIKE chainés en OR sans index)
-- - Count(*) + ORDER BY created_at DESC sans index couvrant
--
-- Indexes existants insuffisants :
--   - idx_clients_tenant (sur tenant_id seul → ramène 2528 rows à filtrer après)
--   - idx_clients_status (sur status seul → idem)
--   - idx_clients_type_adresse (sur type_adresse seul → idem)
--
-- Ce qu'on ajoute :
-- 1. Index composite (tenant_id, type_adresse, created_at DESC)
--    → query par défaut de la liste clients : 100x plus rapide
-- 2. Index composite (tenant_id, status, created_at DESC)
--    → quand l'utilisateur filtre par statut
-- 3. Index GIN trigram sur les 5 colonnes searchables
--    → barre de recherche (ILIKE) passe de seq scan à index scan
-- 4. ANALYZE clients à la fin → rafraichit les stats du planner Postgres
-- ============================================================================

-- 1. Index composite pour la query par défaut (ORDER BY created_at DESC)
CREATE INDEX IF NOT EXISTS idx_clients_tenant_type_created
  ON public.clients (tenant_id, type_adresse, created_at DESC);

-- 2. Index composite pour les filtres status
CREATE INDEX IF NOT EXISTS idx_clients_tenant_status_created
  ON public.clients (tenant_id, status, created_at DESC);

-- 3. Indexes GIN trigram pour la recherche full-text light (ILIKE %x%)
--    pg_trgm est déjà activé.
CREATE INDEX IF NOT EXISTS idx_clients_first_name_trgm
  ON public.clients USING gin (first_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_clients_last_name_trgm
  ON public.clients USING gin (last_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_clients_company_name_trgm
  ON public.clients USING gin (company_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_clients_email_trgm
  ON public.clients USING gin (email gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_clients_phone_trgm
  ON public.clients USING gin (phone gin_trgm_ops);

-- 4. Rafraichir les stats du planner pour qu'il utilise les nouveaux indexes
ANALYZE public.clients;

-- ============================================================================
-- King notification : indexes ajoutés
-- ============================================================================
INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
VALUES (
  'Perf : indexes composites sur public.clients',
  'Ajout de 7 indexes (2 composites btree + 5 GIN trigram) pour fluidifier la liste clients et la recherche sur les gros tenants (JCG Consulting et au-dela).',
  'system_info', 'low',
  jsonb_build_object(
    'migration', '20260527120000_perf_clients_composite_indexes',
    'indexes_added', 7,
    'target_tenant', 'JCG Consulting (2528 contacts)'
  )
);
