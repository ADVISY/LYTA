-- ============================================
-- Étape 2 : Storage policies — Isolation tenant
-- ============================================
-- Remplace l'isolation par user_id par une isolation tenant
-- via get_user_tenant_id() et les tables documents/document_scans

-- ============================
-- BUCKET documents — users authentifiés
-- ============================

-- DROP anciennes policies user-based
DROP POLICY IF EXISTS "Users can view own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own documents" ON storage.objects;

-- SELECT : king OU admin OU dossier user OU fichier lié au tenant
CREATE POLICY "Tenant users can view documents" ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND (
    public.is_king() OR
    public.has_role(auth.uid(), 'admin') OR
    auth.uid()::text = (storage.foldername(name))[1] OR
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.file_key = name
      AND d.tenant_id = public.get_user_tenant_id()
    ) OR
    EXISTS (
      SELECT 1 FROM public.document_scans ds
      WHERE ds.original_file_key = name
      AND ds.tenant_id = public.get_user_tenant_id()
    )
  )
);

-- INSERT : king OU admin OU dossier user
CREATE POLICY "Tenant users can upload documents" ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND (
    public.is_king() OR
    public.has_role(auth.uid(), 'admin') OR
    auth.uid()::text = (storage.foldername(name))[1]
  )
);

-- UPDATE : idem INSERT
CREATE POLICY "Tenant users can update documents" ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents' AND (
    public.is_king() OR
    public.has_role(auth.uid(), 'admin') OR
    auth.uid()::text = (storage.foldername(name))[1]
  )
);

-- DELETE : idem
CREATE POLICY "Tenant users can delete documents" ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND (
    public.is_king() OR
    public.has_role(auth.uid(), 'admin') OR
    auth.uid()::text = (storage.foldername(name))[1]
  )
);

-- ============================
-- BUCKET documents — public-deposits (restreindre)
-- ============================

-- DROP les policies trop permissives
DROP POLICY IF EXISTS "Allow public uploads for contract deposits" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read on public-deposits" ON storage.objects;

-- INSERT public-deposits : garder pour formulaires publics (dépôt client)
CREATE POLICY "Allow deposit uploads to public-deposits" ON storage.objects
FOR INSERT TO anon, authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = 'public-deposits'
);

-- SELECT public-deposits : authentifiés du bon tenant seulement (via document_scans)
CREATE POLICY "Authenticated users can read public-deposits via scans" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = 'public-deposits'
  AND (
    public.is_king() OR
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (
      SELECT 1 FROM public.document_scans ds
      WHERE ds.original_file_key = name
      AND ds.tenant_id = public.get_user_tenant_id()
    )
  )
);
