-- ============================================================================
-- Perf : drop duplicate indexes signalés par les Supabase advisors
-- ============================================================================
-- 3 cas de doublons identifiés. Chaque écriture sur ces tables maintenait
-- 2 indexes identiques pour rien (CPU + I/O gaspillés sur INSERT/UPDATE).
--
-- Note : sur tenant_limits, les DEUX indexes backent une constraint UNIQUE
-- distincte (tenant_limits_tenant_id_key + tenant_limits_tenant_unique).
-- Avoir 2 unique constraints sur la même colonne est aberrant — on drop
-- la 2ème constraint (qui drop aussi son index automatiquement).
-- ============================================================================

-- audit_logs : 2 indexes identiques sur (created_at)
DROP INDEX IF EXISTS public.idx_audit_logs_created;
-- on garde idx_audit_logs_created_at (convention <table>_<col>_at)

-- audit_logs : 2 indexes identiques sur (entity)
DROP INDEX IF EXISTS public.idx_audit_entity;
-- on garde idx_audit_logs_entity (préfixé du nom de table)

-- tenant_limits : 2 constraints UNIQUE identiques sur (tenant_id)
ALTER TABLE public.tenant_limits DROP CONSTRAINT IF EXISTS tenant_limits_tenant_unique;
-- on garde tenant_limits_tenant_id_key (convention <table>_<col>_key)

-- tenants : idx_tenants_slug fait doublon avec tenants_slug_key (constraint UNIQUE)
DROP INDEX IF EXISTS public.idx_tenants_slug;
-- on garde tenants_slug_key (généré auto par la contrainte UNIQUE)
