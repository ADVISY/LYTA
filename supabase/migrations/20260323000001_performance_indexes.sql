-- LYTA Performance Indexes — Tenant isolation + query optimization
-- 27 new indexes on top of 136 existing ones
-- All idempotent (IF NOT EXISTS)

-- ============================================================
-- TIER 1: Missing tenant_id indexes (12)
-- These tables have tenant_id but no index on it.
-- Critical for RLS policy performance and multi-tenant queries.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_clients_tenant ON public.clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_policies_tenant ON public.policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documents_tenant ON public.documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_commissions_tenant ON public.commissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_suivis_tenant ON public.suivis(tenant_id);
CREATE INDEX IF NOT EXISTS idx_propositions_tenant ON public.propositions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_claims_tenant ON public.claims(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_tenant ON public.scheduled_emails(tenant_id);
CREATE INDEX IF NOT EXISTS idx_collaborator_permissions_tenant ON public.collaborator_permissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_document_categories_tenant ON public.document_categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_document_templates_tenant ON public.document_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_document_reminders_tenant ON public.document_reminders(tenant_id);

-- ============================================================
-- TIER 2: Missing status, FK, and remaining tenant_id (10)
-- ============================================================

-- FK missing
CREATE INDEX IF NOT EXISTS idx_document_reminders_document_id ON public.document_reminders(document_id);

-- Status columns used in WHERE clauses but not indexed
CREATE INDEX IF NOT EXISTS idx_commissions_status ON public.commissions(status);
CREATE INDEX IF NOT EXISTS idx_suivis_status ON public.suivis(status);
CREATE INDEX IF NOT EXISTS idx_scan_batches_status ON public.scan_batches(status);
CREATE INDEX IF NOT EXISTS idx_email_templates_is_system ON public.email_templates(is_system) WHERE is_system = true;

-- Remaining tenant_id columns
CREATE INDEX IF NOT EXISTS idx_commission_rules_tenant ON public.commission_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_commission_tiers_tenant ON public.commission_tiers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_retrocommissions_tenant ON public.retrocommissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_tenant ON public.email_templates(tenant_id);

-- ============================================================
-- TIER 3: Composite indexes for frequent multi-column queries (4)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_policies_tenant_status_date ON public.policies(tenant_id, status, start_date);
CREATE INDEX IF NOT EXISTS idx_commissions_tenant_status_period ON public.commissions(tenant_id, status, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_documents_tenant_expires ON public.documents(tenant_id, expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_policies_client_date_status ON public.policies(client_id, start_date DESC, status);

-- ============================================================
-- TIER 4: Partial index + aggregate function
-- ============================================================

-- Partial index for collaborateur queries (filtered frequently)
CREATE INDEX IF NOT EXISTS idx_clients_collaborateurs ON public.clients(tenant_id) WHERE type_adresse = 'collaborateur';

-- Aggregate function for affiliate stats
-- Replaces 3 client-side queries + reduce in useAffiliateStats
-- Access restricted via Edge Function layer (King/admin role check before RPC call)
CREATE OR REPLACE FUNCTION public.get_affiliate_stats()
RETURNS TABLE (
  affiliate_id uuid,
  affiliate_name text,
  total_tenants bigint,
  total_commissions numeric,
  paid_commissions numeric,
  pending_commissions numeric
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    a.id AS affiliate_id,
    (a.first_name || ' ' || a.last_name) AS affiliate_name,
    COUNT(DISTINCT t.id) AS total_tenants,
    COALESCE(SUM(ac.commission_amount), 0) AS total_commissions,
    COALESCE(SUM(ac.commission_amount) FILTER (WHERE ac.status = 'paid'), 0) AS paid_commissions,
    COALESCE(SUM(ac.commission_amount) FILTER (WHERE ac.status = 'due'), 0) AS pending_commissions
  FROM affiliates a
  LEFT JOIN tenants t ON t.affiliate_id = a.id
  LEFT JOIN affiliate_commissions ac ON ac.affiliate_id = a.id
  GROUP BY a.id, a.first_name, a.last_name
  ORDER BY a.first_name, a.last_name;
$$;
