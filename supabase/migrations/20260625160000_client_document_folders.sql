-- ============================================================================
-- Dossiers de documents libres par client
-- ============================================================================
-- Feedback Habib (25 juin 2026) : 'tu as créer la possibilité de crérer des
-- fichier et de renommer le nom des documents et des dossiers'.
--
-- Le besoin : dans la fiche client → onglet Documents, le courtier veut
-- pouvoir créer ses propres dossiers (Contrats, Pièces ID, Sinistres,
-- Dossier mariage 2026...) et y ranger ses documents. Chaque client a SES
-- propres dossiers (option "dossiers libres par client", pas catégories
-- globales tenant).
--
-- Modèle choisi :
--   - Nouvelle table `client_document_folders` (id, tenant_id, client_id,
--     name, color, created_at, created_by, updated_at).
--     → un dossier = (client_id, name) ; on autorise des doublons "Contrats"
--       chez deux clients différents, c'est par design (folders libres).
--     → mais on impose UNIQUE (client_id, name) pour éviter 2 dossiers
--       identiques chez le MÊME client.
--   - Colonne `folder_id UUID NULL` sur `documents` ; FK → folders avec
--     ON DELETE SET NULL : si un dossier est supprimé, les docs reviennent
--     "à la racine" (folder_id = NULL) au lieu d'être perdus.
--
-- Migration additive STRICTE :
--   - Aucune donnée existante n'est modifiée
--   - La colonne folder_id est NULL par défaut → tous les docs existants
--     restent "à la racine"
--   - Aucune contrainte rétroactive sur les docs existants
--
-- RLS : un user peut voir/gérer un dossier ssi il peut voir le client associé.
-- On délègue donc la check à la policy clients déjà en place via EXISTS.
-- ============================================================================

-- 1. Table folders ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_document_folders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id   UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT,  -- hex ou nom CSS, libre, optionnel
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT  client_document_folders_unique_name_per_client
              UNIQUE (client_id, name)
);

-- Index pour lister les dossiers d'un client (le cas le plus fréquent)
CREATE INDEX IF NOT EXISTS idx_client_document_folders_client_id
  ON public.client_document_folders(client_id);

-- Index tenant pour les requêtes admin/global scope
CREATE INDEX IF NOT EXISTS idx_client_document_folders_tenant_id
  ON public.client_document_folders(tenant_id);

-- Trigger updated_at automatique (réutilise le helper standard du repo)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at_now'
  ) THEN
    CREATE OR REPLACE FUNCTION public.set_updated_at_now()
    RETURNS TRIGGER LANGUAGE plpgsql AS $func$
    BEGIN
      NEW.updated_at := now();
      RETURN NEW;
    END;
    $func$;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_client_document_folders_set_updated_at
  ON public.client_document_folders;
CREATE TRIGGER trg_client_document_folders_set_updated_at
  BEFORE UPDATE ON public.client_document_folders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_now();


-- 2. Colonne folder_id sur documents ───────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'documents'
      AND column_name = 'folder_id'
  ) THEN
    ALTER TABLE public.documents
      ADD COLUMN folder_id UUID NULL
      REFERENCES public.client_document_folders(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_documents_folder_id
  ON public.documents(folder_id)
  WHERE folder_id IS NOT NULL;


-- 3. RLS sur client_document_folders ───────────────────────────────────────
ALTER TABLE public.client_document_folders ENABLE ROW LEVEL SECURITY;

-- SELECT : un user peut voir un dossier ssi il peut voir le client associé.
-- On délègue via EXISTS sur public.clients (qui a déjà sa policy scope).
DROP POLICY IF EXISTS "Users can view folders of accessible clients"
  ON public.client_document_folders;
CREATE POLICY "Users can view folders of accessible clients"
  ON public.client_document_folders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_document_folders.client_id
    )
  );

-- INSERT : pareil — on doit avoir le droit sur le client.
DROP POLICY IF EXISTS "Users can create folders for accessible clients"
  ON public.client_document_folders;
CREATE POLICY "Users can create folders for accessible clients"
  ON public.client_document_folders
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_document_folders.client_id
    )
    -- Garde-fou tenant : on ne crée jamais un dossier dans un tenant
    -- auquel l'user n'appartient pas (utile si jamais la policy clients
    -- a un bug d'oubli — défense en profondeur).
    AND tenant_id = public.get_user_tenant_id()
  );

-- UPDATE : renommer / changer la couleur. Même logique.
DROP POLICY IF EXISTS "Users can update folders of accessible clients"
  ON public.client_document_folders;
CREATE POLICY "Users can update folders of accessible clients"
  ON public.client_document_folders
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_document_folders.client_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_document_folders.client_id
    )
  );

-- DELETE : supprimer un dossier. ON DELETE SET NULL sur documents.folder_id
-- garantit qu'aucun doc n'est perdu (ils repassent à la racine).
DROP POLICY IF EXISTS "Users can delete folders of accessible clients"
  ON public.client_document_folders;
CREATE POLICY "Users can delete folders of accessible clients"
  ON public.client_document_folders
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_document_folders.client_id
    )
  );


-- 4. Notification KING ─────────────────────────────────────────────────────
INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
VALUES (
  '📁 Documents : dossiers libres par client',
  'Ajout d''une table `client_document_folders` (id, tenant_id, client_id, name, color) et d''une colonne nullable `folder_id` sur `documents` (FK ON DELETE SET NULL → docs reviennent à la racine si dossier supprimé). RLS basée sur l''accès au client (EXISTS clients). UI in-fiche : tiles dossiers + créer / renommer / supprimer + déplacer un doc. Migration additive zéro impact sur data existante.',
  'system_info',
  'normal',
  jsonb_build_object(
    'migration', '20260625160000_client_document_folders',
    'new_table', 'client_document_folders',
    'new_column', 'documents.folder_id',
    'rls_strategy', 'inherit_via_clients_policy'
  )
);
