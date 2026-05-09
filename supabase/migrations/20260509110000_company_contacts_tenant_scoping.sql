-- ============================================================================
-- SECURITY FIX + ARCHITECTURE — company_contacts is now tenant-scoped
-- ============================================================================
--
-- Same root cause as the leaks fixed earlier this morning (clients,
-- propositions, storage):
--
--   * The `company_contacts` table had no `tenant_id` column at all
--     (created by 20251230143746 with only `company_id` referencing the
--     GLOBAL `insurance_companies` table)
--   * RLS used standalone `has_role(auth.uid(), 'admin')` checks → any
--     admin from any tenant could read / write / delete every other
--     tenant's contacts.
--
-- BUSINESS REASON (from product owner):
--   "Each tenant configures its own companies, products and contacts —
--    they can all be different."
--
-- Different cabinets often have different account managers, regional
-- broker-service inboxes, or personal contacts at the same insurer
-- (e.g. Generali Geneva vs Generali Zurich). Storing those in a global
-- table means cabinet B overwrites cabinet A's data.
--
-- This migration:
--   1. Wipes the existing rows (product owner confirmed the table is
--      effectively empty: "c'est vide... yen a peut etre 1 ou 2... tu
--      peut tout supprimer si tu veux")
--   2. Adds a NOT NULL `tenant_id` column referencing `tenants`
--   3. Replaces the old global RLS with tenant-scoped policies that
--      mirror the pattern used on `clients` / `propositions` after the
--      morning's fixes.
-- ============================================================================


-- 1. WIPE — explicitly drop existing rows (1-2 orphan rows max, no
--    tenant attribution would be safe to keep). Easier to start clean.
DELETE FROM public.company_contacts;


-- 2. ADD `tenant_id` column. Set NOT NULL immediately since we just
--    cleared the table.
ALTER TABLE public.company_contacts
  ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL
    REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_company_contacts_tenant
  ON public.company_contacts(tenant_id);

CREATE INDEX IF NOT EXISTS idx_company_contacts_tenant_company
  ON public.company_contacts(tenant_id, company_id);


-- 3. DROP the legacy RLS policies — they leak across tenants.
DROP POLICY IF EXISTS "Anyone can view company contacts" ON public.company_contacts;
DROP POLICY IF EXISTS "Admins can manage company contacts" ON public.company_contacts;
DROP POLICY IF EXISTS "Staff can insert company contacts" ON public.company_contacts;
DROP POLICY IF EXISTS "Staff can update company contacts" ON public.company_contacts;


-- 4. NEW POLICIES — tenant-scoped. Mirrors the post-fix pattern used on
--    clients/propositions/storage.
--    NOTE: we don't gate on a fine-grained module permission yet because
--    the `permission_module` enum doesn't list company_contacts. Tenant
--    membership is the gate; finer roles can be added later via
--    has_tenant_permission once the enum gains the right module.

-- SELECT — any user of the tenant can read their own contacts.
CREATE POLICY "Tenant members can view their company contacts"
ON public.company_contacts FOR SELECT
TO authenticated
USING (
  public.is_king()
  OR tenant_id = public.get_user_tenant_id()
);

-- INSERT — must insert into the user's own tenant.
CREATE POLICY "Tenant members can add company contacts"
ON public.company_contacts FOR INSERT
TO authenticated
WITH CHECK (
  public.is_king()
  OR tenant_id = public.get_user_tenant_id()
);

-- UPDATE — must own the row.
CREATE POLICY "Tenant members can update their company contacts"
ON public.company_contacts FOR UPDATE
TO authenticated
USING (
  public.is_king()
  OR tenant_id = public.get_user_tenant_id()
)
WITH CHECK (
  public.is_king()
  OR tenant_id = public.get_user_tenant_id()
);

-- DELETE — must own the row.
CREATE POLICY "Tenant members can delete their company contacts"
ON public.company_contacts FOR DELETE
TO authenticated
USING (
  public.is_king()
  OR tenant_id = public.get_user_tenant_id()
);


-- 5. (Optional but useful) DEDUP CONSTRAINT — prevent the same tenant
--    from accidentally entering the same email/phone twice for the
--    same (company, contact_type, channel) pair.
--    Keeps `is_primary` flag meaningful by avoiding ambiguous duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS uq_company_contacts_tenant_company_channel_value
  ON public.company_contacts (tenant_id, company_id, contact_type, channel, lower(value));
