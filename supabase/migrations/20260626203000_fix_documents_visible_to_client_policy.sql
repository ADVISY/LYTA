-- ============================================================================
-- Fix : policy RLS documents ne filtrait pas visible_to_client
-- ============================================================================
-- La migration précédente (20260626200000_documents_visible_to_client) a
-- ajouté la colonne + créé une NEW policy "Users can view their own
-- documents". Problème : la policy ACTIVE en prod est
-- "Tenant users can view their documents" (créée dans 20251230155945
-- avec le refactor tenant_id sur documents). Les 2 policies SELECT
-- coexistent en UNION → si l'une accorde l'accès, ça passe. Ma nouvelle
-- policy avec le filtre `visible_to_client = true` est donc INEFFICACE.
--
-- Fix : on supprime la policy que j'ai créée (redondante avec l'ancien
-- pattern) et on MODIFIE la vraie policy tenant-scoped pour ajouter le
-- filtre client. Le broker/admin/backoffice continue à tout voir, le
-- client final ne voit que les docs visible_to_client=true.
-- ============================================================================

-- 1. Cleanup : supprimer la policy redondante créée dans 20260626200000
DROP POLICY IF EXISTS "Users can view their own documents" ON public.documents;

-- 2. Récrire la policy tenant-scoped avec le filtre visible_to_client pour
-- les clients finaux uniquement.
DROP POLICY IF EXISTS "Tenant users can view their documents" ON public.documents;

CREATE POLICY "Tenant users can view their documents"
ON public.documents FOR SELECT
USING (
  tenant_id = get_user_tenant_id()
  AND (
    -- Admin cabinet : voit tout, y compris les docs masqués
    has_role(auth.uid(), 'admin'::app_role)
    -- Back-office : voit tout aussi
    OR has_role(auth.uid(), 'backoffice'::app_role)
    -- Créateur du doc (broker qui a uploadé) : voit tout, c'est lui
    -- qui bascule le flag, il doit continuer à voir même après avoir
    -- masqué le doc
    OR created_by = auth.uid()
    -- Client final : ne voit QUE les docs avec visible_to_client = true.
    -- C'est le seul cas où on filtre — les rôles staff ci-dessus
    -- gardent leur vue totale.
    OR (
      owner_type = 'client'
      AND visible_to_client = true
      AND EXISTS (
        SELECT 1 FROM clients c
        WHERE c.id = documents.owner_id AND c.user_id = auth.uid()
      )
    )
  )
);
