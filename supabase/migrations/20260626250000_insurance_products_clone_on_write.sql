-- ============================================================================
-- Clone-on-write pour insurance_products — fix leak cross-tenant
-- ============================================================================
-- Habib (26 juin 2026) : "sarcom a modifié et advisy a été aussi modifié"
-- → LEAK RÉEL entre tenants sur le catalogue produits partagé.
--
-- Comportement actuel :
--   · Produit `tenant_id = NULL` = système, visible par tous les tenants
--   · Un tenant qui "modifie" via un canal qui bypass la RLS (king manuel,
--     RPC SECURITY DEFINER, etc.) → la modif se propage à TOUS les tenants
--     qui référencent ce même row.
--
-- Comportement voulu (clone-on-write) :
--   · Chaque tenant qui veut personnaliser un produit système reçoit une
--     COPIE PRIVÉE dans son propre tenant (nouveau row, tenant_id = son_id,
--     parent_product_id = row système d'origine).
--   · Le produit système original reste INTACT pour les autres tenants.
--   · Le catalog du tenant qui a cloné cache le système et affiche la
--     copie perso.
--
-- Migration STRICTEMENT additive :
--   · Ajoute colonne nullable `parent_product_id UUID` (FK auto-référence)
--   · Aucun produit existant n'est modifié
--   · Le UI et la RPC clone gèrent la logique (livrés dans le même commit)
-- ============================================================================

-- 1. Colonne parent_product_id ────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'insurance_products'
      AND column_name = 'parent_product_id'
  ) THEN
    ALTER TABLE public.insurance_products
      ADD COLUMN parent_product_id UUID NULL
      REFERENCES public.insurance_products(id) ON DELETE SET NULL;

    COMMENT ON COLUMN public.insurance_products.parent_product_id IS
      'Si NON NULL : ce produit est un CLONE personnalisé par un tenant du produit système référencé. Le catalog masque le parent quand ce clone existe pour ce tenant. ON DELETE SET NULL : si le parent système est supprimé un jour, le clone survit comme produit tenant standalone.';
  END IF;
END $$;

-- Index sur (tenant_id, parent_product_id) pour lookup rapide "ce tenant
-- a-t-il un clone du produit X ?"
CREATE INDEX IF NOT EXISTS idx_insurance_products_tenant_parent
  ON public.insurance_products(tenant_id, parent_product_id)
  WHERE parent_product_id IS NOT NULL;


-- 2. RPC clone_insurance_product_for_tenant ──────────────────────────────
-- Clone un produit système dans le tenant actif. Vérifie :
--   · L'user peut créer des produits (via policy INSERT existante)
--   · Le produit source est bien SYSTÈME (tenant_id IS NULL) OU appartient
--     à ce tenant (dans ce cas c'est déjà à eux, pas besoin de cloner)
--   · Pas de doublon : si le tenant a déjà un clone de ce produit → renvoie
--     l'existant au lieu de créer un 2e clone
-- Retourne l'UUID du clone (nouveau ou existant).

CREATE OR REPLACE FUNCTION public.clone_insurance_product_for_tenant(
  p_source_product_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user     UUID := auth.uid();
  v_tenant   UUID;
  v_source   public.insurance_products%ROWTYPE;
  v_existing UUID;
  v_clone_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '42501';
  END IF;

  v_tenant := public.get_user_tenant_id();
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'no active tenant for this user' USING ERRCODE = '42501';
  END IF;

  -- Vérif rôle staff (admin/manager/backoffice) — même règle que la policy INSERT
  IF NOT (
    public.has_role(v_user, 'admin'::app_role)
    OR public.has_role(v_user, 'manager'::app_role)
    OR public.has_role(v_user, 'backoffice'::app_role)
  ) THEN
    RAISE EXCEPTION 'insufficient role to clone products' USING ERRCODE = '42501';
  END IF;

  -- Charge le produit source
  SELECT * INTO v_source FROM public.insurance_products WHERE id = p_source_product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'source product % not found', p_source_product_id;
  END IF;

  -- Si le produit est DÉJÀ dans ce tenant → pas besoin de cloner, renvoie l'id
  IF v_source.tenant_id = v_tenant THEN
    RETURN v_source.id;
  END IF;

  -- Si le tenant a DÉJÀ un clone de ce produit → renvoie l'existant
  SELECT id INTO v_existing
  FROM public.insurance_products
  WHERE tenant_id = v_tenant
    AND parent_product_id = p_source_product_id
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- Sinon on clone. Copie tous les champs du source SAUF tenant_id (→ v_tenant),
  -- parent_product_id (→ p_source_product_id), created_at (→ now).
  INSERT INTO public.insurance_products (
    company_id, name, category, main_category, subcategory, description,
    branch_code, tenant_branch_id, tenant_id, parent_product_id,
    status, life_pillar
  )
  VALUES (
    v_source.company_id, v_source.name, v_source.category, v_source.main_category,
    v_source.subcategory, v_source.description,
    v_source.branch_code, v_source.tenant_branch_id, v_tenant, p_source_product_id,
    COALESCE(v_source.status, 'active'), v_source.life_pillar
  )
  RETURNING id INTO v_clone_id;

  RETURN v_clone_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clone_insurance_product_for_tenant(UUID) TO authenticated;


-- 3. Notification KING
INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
VALUES (
  '🔒 Fix leak : clone-on-write insurance_products',
  'Symptôme reporté : sarcom a modifié un produit et advisy a été impacté. Cause : produits système (tenant_id=NULL) partagés entre tous les tenants, modification via un canal qui bypass la RLS = propagation à tous. Fix : nouvelle colonne parent_product_id + RPC clone_insurance_product_for_tenant qui crée une copie privée par tenant. Le UI (livré dans le même commit) affichera un bouton "Personnaliser pour mon cabinet" sur les produits système, et masque le système quand le clone existe. Migration additive, aucune data touchée.',
  'security',
  'high',
  jsonb_build_object(
    'migration', '20260626250000_insurance_products_clone_on_write',
    'new_column', 'parent_product_id',
    'new_rpc', 'clone_insurance_product_for_tenant',
    'pattern', 'clone-on-write'
  )
);
