-- ============================================================================
-- RPC list_clients_for_tenant : bypass RLS pour la liste clients
-- ============================================================================
-- Contexte : Habib reporte que la page /crm/clients est trop lente, même
-- après cache scope+tenant côté front et indexes composites côté DB.
-- Reste comme dernière source de lenteur sur gros tenant (1000+, et on
-- cible 5000+) : la policy RLS SELECT sur public.clients qui fait 3 EXISTS
-- croisés à chaque ligne :
--   1. EXISTS user_tenant_assignments
--   2. EXISTS user_tenant_roles JOIN tenant_roles
--   3. evaluation du scope (global/team/personal) via plusieurs sous-helpers
-- Sur 5000 rows ça devient pénalisant même avec idx_clients_tenant.
--
-- Solution : RPC SECURITY DEFINER qui bypass la RLS pour le SELECT principal,
-- en re-vérifiant l'accès tenant + scope au DÉBUT de la fonction (1 fois,
-- pas par ligne). Pattern identique à count_clients_for_tenant qui existe
-- déjà et a réglé les timeouts sur le count en mai.
--
-- La RPC renvoie un JSONB { rows: [...], count: bigint } pour économiser
-- un round-trip (avant : SELECT + count RPC = 2 calls parallèles ; après :
-- 1 seul call).
--
-- Filtres supportés (mirror exact de count_clients_for_tenant + scope) :
--   p_type_adresse, p_search, p_city, p_canton, p_status, p_postal_code,
--   p_is_company, p_assigned_agent, p_limit, p_offset.
--
-- Scope résolu en interne (pas besoin de le passer depuis le front) :
--   - king OR user_tenant_roles avec dashboard_scope='global' → pas de
--     filter scope-aware ajouté
--   - dashboard_scope='team' OR 'personal' → assigned_agent_id = mon_collab
--     OR id = mon_collab (= je vois aussi ma propre fiche collaborateur)
--
-- Migration STRICTEMENT additive : nouvelle fonction, aucune table touchée,
-- aucune policy modifiée.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.list_clients_for_tenant(
  p_tenant_id      UUID,
  p_type_adresse   TEXT    DEFAULT NULL,
  p_search         TEXT    DEFAULT NULL,
  p_city           TEXT    DEFAULT NULL,
  p_canton         TEXT    DEFAULT NULL,
  p_status         TEXT    DEFAULT NULL,
  p_postal_code    TEXT    DEFAULT NULL,
  p_is_company     BOOLEAN DEFAULT NULL,
  p_assigned_agent TEXT    DEFAULT NULL,  -- UUID ou 'unassigned' ou NULL
  p_limit          INT     DEFAULT 50,
  p_offset         INT     DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user        UUID := auth.uid();
  v_has_access  BOOLEAN;
  v_is_king     BOOLEAN;
  v_scope       TEXT;          -- 'global' | 'team' | 'personal'
  v_collab_id   UUID;
  v_pattern     TEXT;
  v_rows        JSONB;
  v_count       BIGINT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '42501';
  END IF;

  -- ─── 1. Vérification accès tenant (pattern de count_clients_for_tenant) ─
  v_is_king := public.is_king();

  SELECT (
    v_is_king
    OR EXISTS (
      SELECT 1 FROM public.user_tenant_assignments uta
      WHERE uta.user_id = v_user AND uta.tenant_id = p_tenant_id
    )
    OR EXISTS (
      SELECT 1 FROM public.user_tenant_roles utr
      JOIN public.tenant_roles tr ON tr.id = utr.role_id
      WHERE utr.user_id = v_user
        AND tr.tenant_id = p_tenant_id
        AND tr.is_active = true
    )
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'access denied to tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  -- ─── 2. Résolution scope (highest privilege wins) ──────────────────────
  IF v_is_king THEN
    v_scope := 'global';
  ELSIF EXISTS (
    SELECT 1
    FROM public.user_tenant_roles utr
    JOIN public.tenant_roles tr ON tr.id = utr.role_id
    WHERE utr.user_id = v_user
      AND tr.tenant_id = p_tenant_id
      AND tr.is_active = true
      AND tr.dashboard_scope = 'global'
  ) THEN
    v_scope := 'global';
  ELSIF EXISTS (
    SELECT 1
    FROM public.user_tenant_roles utr
    JOIN public.tenant_roles tr ON tr.id = utr.role_id
    WHERE utr.user_id = v_user
      AND tr.tenant_id = p_tenant_id
      AND tr.is_active = true
      AND tr.dashboard_scope = 'team'
  ) THEN
    v_scope := 'team';
  ELSE
    v_scope := 'personal';
  END IF;

  -- ─── 3. Récupération du collab_id si scope ≠ global ─────────────────────
  IF v_scope <> 'global' THEN
    SELECT c.id INTO v_collab_id
    FROM public.clients c
    WHERE c.user_id = v_user
      AND c.tenant_id = p_tenant_id
      AND c.type_adresse = 'collaborateur'
    LIMIT 1;
    -- Si aucun collab_id trouvé, le user est tagué personal/team sans fiche
    -- collaborateur attachée → on retourne vide pour ne pas exposer tout
    -- le tenant par erreur.
    IF v_collab_id IS NULL THEN
      RETURN jsonb_build_object('rows', '[]'::jsonb, 'count', 0);
    END IF;
  END IF;

  -- ─── 4. Pattern de recherche ───────────────────────────────────────────
  v_pattern := CASE
    WHEN p_search IS NULL OR length(trim(p_search)) = 0 THEN NULL
    ELSE '%' || trim(p_search) || '%'
  END;

  -- ─── 5. SELECT count + rows en parallèle dans la même transaction ─────
  --     Bypass RLS = pas d'évaluation par ligne. Avec les indexes
  --     composites (tenant_id, *, created_at DESC) ajoutés dans la
  --     migration précédente, le plan utilise un index scan.
  WITH filtered AS (
    SELECT c.*
    FROM public.clients c
    WHERE c.tenant_id = p_tenant_id
      AND (p_type_adresse IS NULL OR c.type_adresse = p_type_adresse)
      AND (p_status IS NULL OR c.status = p_status)
      AND (p_canton IS NULL OR c.canton ILIKE p_canton)
      AND (p_city IS NULL OR c.city ILIKE '%' || p_city || '%')
      AND (p_postal_code IS NULL OR c.postal_code ILIKE p_postal_code || '%')
      AND (p_is_company IS NULL
           OR (p_is_company = TRUE  AND c.is_company = TRUE)
           OR (p_is_company = FALSE AND (c.is_company = FALSE OR c.is_company IS NULL))
      )
      AND (
        p_assigned_agent IS NULL
        OR (p_assigned_agent = 'unassigned' AND c.assigned_agent_id IS NULL)
        OR (p_assigned_agent <> 'unassigned' AND c.assigned_agent_id = p_assigned_agent::uuid)
      )
      AND (v_pattern IS NULL
        OR c.first_name   ILIKE v_pattern
        OR c.last_name    ILIKE v_pattern
        OR c.email        ILIKE v_pattern
        OR c.company_name ILIKE v_pattern
        OR c.phone        ILIKE v_pattern
      )
      AND (
        v_scope = 'global'
        OR c.assigned_agent_id = v_collab_id
        OR c.id = v_collab_id
      )
  ),
  counted AS (
    SELECT count(*) AS total FROM filtered
  ),
  paged AS (
    SELECT *
    FROM filtered
    ORDER BY created_at DESC
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT
    COALESCE(jsonb_agg(to_jsonb(paged.*) ORDER BY paged.created_at DESC), '[]'::jsonb),
    (SELECT total FROM counted)
  INTO v_rows, v_count
  FROM paged;

  RETURN jsonb_build_object(
    'rows', v_rows,
    'count', v_count
  );
END $$;

GRANT EXECUTE ON FUNCTION public.list_clients_for_tenant(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, INT, INT
) TO authenticated;


-- ============================================================================
-- Notification KING
-- ============================================================================
INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
VALUES (
  '⚡ Perf : RPC list_clients_for_tenant (bypass RLS)',
  'Nouvelle RPC SECURITY DEFINER qui retourne {rows, count} en 1 round-trip pour la page /crm/clients. Bypass RLS = pas d''évaluation policy par ligne (3 EXISTS croisés évités). Vérif tenant + scope en haut de fonction (1 fois). Résolution scope interne (global/team/personal) basée sur is_king() + user_tenant_roles. Devrait remettre JCG (1000+ contacts) à <500ms même sans cache, et tenir 5000+ confortablement. Le front sera adapté pour appeler cette RPC au lieu du SELECT + count parallèle.',
  'system_info',
  'high',
  jsonb_build_object(
    'migration', '20260626160000_list_clients_for_tenant_rpc',
    'rpc_name', 'list_clients_for_tenant',
    'returns', 'jsonb',
    'replaces', jsonb_build_array('select_clients', 'count_clients_for_tenant')
  )
);
