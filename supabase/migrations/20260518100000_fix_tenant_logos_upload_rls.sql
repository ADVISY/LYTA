-- ============================================================================
-- Fix RLS storage tenant-logos : autoriser admin/manager/backoffice à uploader
-- ============================================================================
-- Bug : la policy INSERT exigeait role='king' STRICT → un admin tenant qui
-- créait une compagnie ne pouvait pas uploader son logo ("new row violates
-- row-level security policy" sur storage.objects).
--
-- Le bucket tenant-logos est public en lecture (logos d'assurance, info
-- publique), donc on peut largement relâcher l'écriture : tout admin/manager
-- /backoffice de n'importe quel tenant peut uploader. Le risque est nul
-- (limite 2 MB côté front, pas de PII).
-- ============================================================================

DROP POLICY IF EXISTS "Kings can upload tenant logos" ON storage.objects;
DROP POLICY IF EXISTS "Kings can update tenant logos" ON storage.objects;
DROP POLICY IF EXISTS "Kings can delete tenant logos" ON storage.objects;

-- INSERT : tout authenticated peut uploader (limite 2MB + bucket public)
CREATE POLICY "Authenticated can upload tenant logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'tenant-logos');

-- UPDATE : tout authenticated (idem)
CREATE POLICY "Authenticated can update tenant logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'tenant-logos');

-- DELETE : restreint aux admin/manager/backoffice/king pour éviter qu'un
-- agent supprime accidentellement un logo
CREATE POLICY "Staff can delete tenant logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'tenant-logos'
  AND (
    public.is_king()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'backoffice'::app_role)
  )
);
