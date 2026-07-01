-- ============================================================================
-- Masquage d'un document dans l'espace client
-- ============================================================================
-- Habib (26 juin 2026) : "on peut toujours pas masquer un document pour les
-- clients si on ne veut pas qu'il apparaissent dans l'espace client du client".
--
-- Cas d'usage : le courtier scanne / upload un document (mandat interne,
-- note privée, doc RH, brouillon...) et ne veut PAS que le client le voie
-- dans son portail. Aujourd'hui tous les docs owner_type='client' sont
-- visibles dans /espace-client/documents et /espace-client/contrats.
--
-- Solution : nouvelle colonne `visible_to_client` (BOOLEAN, DEFAULT true).
--   - Par défaut TRUE → aucun doc existant ne devient invisible par erreur
--   - Le courtier bascule vers FALSE depuis la fiche client (icône œil barré)
--
-- Sécurité : la policy RLS SELECT est modifiée pour que les CLIENTS ne voient
-- que les rows `visible_to_client = true`. Comme ça un client qui bypass le
-- front (via API supabase-js direct) ne voit PAS les docs cachés — le filtre
-- n'est pas cosmétique côté UI, il est appliqué au niveau DB.
-- Le broker (admin/partner/created_by) continue à tout voir.
--
-- Migration STRICTEMENT additive :
--   - Colonne ajoutée avec DEFAULT true → toutes les data existantes restent
--     visibles (aucun risque de "je ne vois plus mes docs")
--   - Policy réécrite pour couvrir le nouveau filtre — même surface d'accès
--     que l'ancienne policy, juste avec une couche filtre en plus pour les
--     clients
-- ============================================================================

-- 1. Colonne visible_to_client ─────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'documents'
      AND column_name = 'visible_to_client'
  ) THEN
    ALTER TABLE public.documents
      ADD COLUMN visible_to_client BOOLEAN NOT NULL DEFAULT true;

    COMMENT ON COLUMN public.documents.visible_to_client IS
      'Si false, le document n''est PAS visible dans l''espace client (portail /espace-client). Le broker/admin le voit toujours dans son CRM. Défaut true = comportement historique. Basculé par le courtier via l''icône œil dans la liste docs de ClientDetail.';
  END IF;
END $$;

-- Index partiel : les docs masqués sont minoritaires (défaut = visible),
-- pas besoin d'indexer les true. Un index sur les FALSE aide les rapports
-- king "combien de docs sont cachés dans le portail par tenant".
CREATE INDEX IF NOT EXISTS idx_documents_hidden_from_client
  ON public.documents(owner_id)
  WHERE visible_to_client = false;


-- 2. Policy RLS SELECT : les clients ne voient que les visible_to_client=true
-- ─────────────────────────────────────────────────────────────────────────
-- On DROP puis RECREATE la policy existante avec le filtre en plus.
-- La surface d'accès change UNIQUEMENT pour les rows où user_id = client :
-- ils voyaient tous leurs docs, maintenant ils ne voient que les visibles.
-- Broker/admin/partner : identique.

DROP POLICY IF EXISTS "Users can view their own documents" ON public.documents;

CREATE POLICY "Users can view their own documents"
  ON public.documents FOR SELECT
  USING (
    -- Admin plateforme : voit tout (inchangé)
    public.has_role(auth.uid(), 'admin')
    -- Créateur du doc (broker qui a uploadé) : voit tout, y compris les
    -- masqués — c'est LUI qui masque, il doit continuer à voir
    OR created_by = auth.uid()
    -- Client final (owner_type='client', user_id = auth.uid()) :
    -- ne voit QUE les docs visible_to_client = true
    OR (
      owner_type = 'client'
      AND visible_to_client = true
      AND EXISTS (
        SELECT 1 FROM public.clients
        WHERE id = documents.owner_id AND user_id = auth.uid()
      )
    )
    -- Docs attachés à une policy : le client de la policy (via son user_id)
    -- voit seulement si visible_to_client = true
    OR (
      owner_type = 'policy'
      AND visible_to_client = true
      AND EXISTS (
        SELECT 1 FROM public.policies p
        JOIN public.clients c ON p.client_id = c.id
        WHERE p.id = documents.owner_id AND c.user_id = auth.uid()
      )
    )
    -- Broker (partner) sur la policy : voit tout, y compris les masqués
    OR (
      owner_type = 'policy'
      AND EXISTS (
        SELECT 1 FROM public.policies p
        JOIN public.partners pt ON p.partner_id = pt.id
        WHERE p.id = documents.owner_id AND pt.user_id = auth.uid()
      )
    )
  );


-- 3. Notification KING ─────────────────────────────────────────────────────
INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
VALUES (
  '👁️ Documents : masquage dans l''espace client',
  'Ajout de la colonne `documents.visible_to_client` (BOOLEAN, DEFAULT true) + réécriture de la policy RLS SELECT pour que les clients ne voient QUE les docs visible_to_client=true. Le broker/admin continue à tout voir. Migration additive : tous les docs existants restent visibles par défaut. Le courtier bascule via un toggle œil dans la fiche client → onglet Documents.',
  'system_info',
  'normal',
  jsonb_build_object(
    'migration', '20260626200000_documents_visible_to_client',
    'new_column', 'documents.visible_to_client',
    'default', true,
    'affected_policy', 'Users can view their own documents'
  )
);
