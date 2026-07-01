-- ============================================================================
-- Fix définitif : policy documents SELECT avec visible_to_client
-- ============================================================================
-- Les 2 migrations précédentes (20260626200000 + 20260626203000) essayaient
-- de modifier des policies qui n'existaient plus sous leurs noms d'origine.
-- La policy réellement ACTIVE en prod est "Tenant users can view scoped
-- documents" (créée dans 20260428000002).
--
-- Le problème structurel : la policy actuelle utilise `can_access_client()`
-- qui UNIFIE les cas staff et client final. Impossible de filtrer sur
-- visible_to_client au niveau de la sous-branche "client final" sans
-- distinguer les 2 rôles explicitement.
--
-- Fix : on récrit la policy avec 2 branches distinctes :
--   · Branche STAFF (admin/backoffice/compta/partner/agent + créateur +
--     king + global scope) → accès complet, MÊME aux docs masqués
--   · Branche CLIENT FINAL (owner_type='client' avec user_id=auth.uid())
--     → accès seulement si visible_to_client = true
-- ============================================================================

-- 1. Cleanup des policies redondantes créées dans les 2 migrations précédentes
DROP POLICY IF EXISTS "Users can view their own documents" ON public.documents;
DROP POLICY IF EXISTS "Tenant users can view their documents" ON public.documents;

-- 2. Remplace la vraie policy active par une version qui filtre pour clients
DROP POLICY IF EXISTS "Tenant users can view scoped documents" ON public.documents;

CREATE POLICY "Tenant users can view scoped documents"
ON public.documents
FOR SELECT
USING (
  tenant_id = public.get_user_tenant_id()
  AND (
    -- ═══ BRANCHE STAFF : accès complet, y compris docs masqués ═══════════
    public.is_king()
    OR public.user_has_global_client_scope(tenant_id)
    OR created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'backoffice'::app_role)
    OR public.has_role(auth.uid(), 'compta'::app_role)
    OR public.has_role(auth.uid(), 'partner'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    -- Agent qui a can_access_client (via team subordinates etc.)
    OR (
      public.has_role(auth.uid(), 'agent'::app_role)
      AND (
        (owner_type = 'client' AND public.can_access_client(owner_id))
        OR (
          owner_type = 'policy'
          AND EXISTS (
            SELECT 1 FROM public.policies p
            WHERE p.id = documents.owner_id
              AND p.tenant_id = public.get_user_tenant_id()
              AND (p.client_id IS NULL OR public.can_access_client(p.client_id))
          )
        )
      )
    )

    -- ═══ BRANCHE CLIENT FINAL : filtre visible_to_client ═════════════════
    -- Un user "client" (portail /espace-client) voit UNIQUEMENT les docs
    -- où lui-même est l'owner ET visible_to_client = true. Le broker peut
    -- masquer un doc via l'UI CRM (colonne visible_to_client=false) pour
    -- qu'il disparaisse du portail sans être supprimé.
    OR (
      visible_to_client = true
      AND (
        -- Doc directement attaché au client (owner_type='client')
        (
          owner_type = 'client'
          AND EXISTS (
            SELECT 1 FROM public.clients c
            WHERE c.id = documents.owner_id AND c.user_id = auth.uid()
          )
        )
        -- Doc attaché à une policy dont le client est user_id=auth.uid()
        OR (
          owner_type = 'policy'
          AND EXISTS (
            SELECT 1 FROM public.policies p
            JOIN public.clients c ON c.id = p.client_id
            WHERE p.id = documents.owner_id AND c.user_id = auth.uid()
          )
        )
      )
    )
  )
);


-- 3. Notification KING
INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
VALUES (
  '👁️ Docs : policy corrigée pour visible_to_client (client final)',
  'Fix des 2 migrations précédentes (20260626200000 + 20260626203000) qui essayaient de modifier des policies déjà remplacées. La vraie policy active était "Tenant users can view scoped documents". Récrite avec 2 branches explicites : STAFF accède à tout, CLIENT FINAL uniquement aux docs visible_to_client=true. Filtre appliqué au niveau RLS = un client curieux qui bypass le front ne voit toujours pas les docs masqués.',
  'system_info',
  'high',
  jsonb_build_object(
    'migration', '20260626210000_documents_visible_to_client_correct_policy',
    'fixes_previous', jsonb_build_array('20260626200000', '20260626203000'),
    'active_policy', 'Tenant users can view scoped documents',
    'branches', jsonb_build_object(
      'staff', 'full access including hidden docs',
      'client_end_user', 'only visible_to_client=true'
    )
  )
);
