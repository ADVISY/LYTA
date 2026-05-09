-- ============================================================================
-- SECURITY FIX — Storage RLS was leaking files cross-tenant
-- ============================================================================
--
-- BUG (introduced 2026-03-15 in migration 20260315000001_storage_tenant_isolation.sql)
-- ----------------------------------------------------------------------------
-- 5 storage policies on storage.objects bucket=documents used:
--
--   public.has_role(auth.uid(), 'admin')
--
-- as a STANDALONE clause without tenant scoping. Same root cause as the
-- clients/propositions leaks fixed yesterday: has_role() only checks the
-- global app_role and is not scoped to a tenant. The role 'admin' in
-- public.user_roles has no tenant_id, so ANY user marked as admin on ANY
-- tenant could SELECT / INSERT / UPDATE / DELETE files across ALL tenants.
--
-- That includes signed contracts, ID scans, claim documents, broker mandate
-- copies, etc. — sensitive PII for every cabinet on the platform.
--
-- Affected policies (all on storage.objects, bucket_id='documents'):
--   1. "Tenant users can view documents"             (SELECT)
--   2. "Tenant users can upload documents"           (INSERT)
--   3. "Tenant users can update documents"           (UPDATE)
--   4. "Tenant users can delete documents"           (DELETE)
--   5. "Authenticated users can read public-deposits via scans" (SELECT, public-deposits subfolder)
--
-- FIX
-- ----------------------------------------------------------------------------
-- Remove the standalone has_role(..., 'admin') condition from each. The
-- remaining clauses cover all legitimate access:
--
--   - is_king()                                   → super-admin
--   - auth.uid()::text = folder[1]                → user uploads in their own folder
--   - EXISTS documents WHERE tenant_id matches    → tenant member views their docs
--   - EXISTS document_scans WHERE tenant matches  → tenant member views their scans
--
-- Tenant admins are NOT losing legitimate access:
--   - They can SELECT files of their tenant via the EXISTS documents check
--     (their docs are linked to documents.tenant_id which equals their tenant).
--   - They can INSERT into their own personal folder (auth.uid() == folder[1]).
--   - For multi-user upload flows (admin uploading on behalf of agent), the
--     existing app code goes through Edge Functions with service_role which
--     bypass RLS entirely — unaffected.
--
-- Verified: same fix pattern as 20260508140000 (clients) and 20260508150000
-- (propositions), both validated in production yesterday.
-- ============================================================================


-- ----- 1. SELECT documents -----
DROP POLICY IF EXISTS "Tenant users can view documents" ON storage.objects;

CREATE POLICY "Tenant users can view documents" ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    public.is_king()
    OR auth.uid()::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.file_key = name
        AND d.tenant_id = public.get_user_tenant_id()
    )
    OR EXISTS (
      SELECT 1 FROM public.document_scans ds
      WHERE ds.original_file_key = name
        AND ds.tenant_id = public.get_user_tenant_id()
    )
  )
);


-- ----- 2. INSERT documents -----
DROP POLICY IF EXISTS "Tenant users can upload documents" ON storage.objects;

CREATE POLICY "Tenant users can upload documents" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (
    public.is_king()
    OR auth.uid()::text = (storage.foldername(name))[1]
  )
);


-- ----- 3. UPDATE documents -----
DROP POLICY IF EXISTS "Tenant users can update documents" ON storage.objects;

CREATE POLICY "Tenant users can update documents" ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    public.is_king()
    OR auth.uid()::text = (storage.foldername(name))[1]
  )
);


-- ----- 4. DELETE documents -----
DROP POLICY IF EXISTS "Tenant users can delete documents" ON storage.objects;

CREATE POLICY "Tenant users can delete documents" ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    public.is_king()
    OR auth.uid()::text = (storage.foldername(name))[1]
  )
);


-- ----- 5. SELECT public-deposits via scans -----
DROP POLICY IF EXISTS "Authenticated users can read public-deposits via scans" ON storage.objects;

CREATE POLICY "Authenticated users can read public-deposits via scans" ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = 'public-deposits'
  AND (
    public.is_king()
    OR EXISTS (
      SELECT 1 FROM public.document_scans ds
      WHERE ds.original_file_key = name
        AND ds.tenant_id = public.get_user_tenant_id()
    )
  )
);
