-- ============================================================================
-- DIAGNOSTIC ONLY — Investigation root cause V1 (RLS 42501 sur clients)
-- ============================================================================
-- Migration NON DESTRUCTIVE. Aucune policy modifiée. Aucune donnée touchée.
-- Lit pg_policies + pg_proc + state des helpers et dump dans
-- king_notifications pour analyse offline.
--
-- Contexte :
-- INSERT sur `clients`, `policies`, `family_members`, `documents` plante
-- en 42501 depuis ~5 semaines. Workaround : 3 edge functions service_role
-- (create-client / bypass-insert / save-policy).
--
-- Hypothèses concurrentes (audit 12 juin 2026) :
--   H1. Le RETURNING * du `.insert([..]).select("*").single()` du front
--       force l'évaluation de la policy SELECT sur la row insérée.
--       Si la SELECT policy contient `tenant_id = get_user_tenant_id()`
--       et que get_user_tenant_id() retourne null/mauvais tenant pour
--       l'user (multi-tenant, UTR au lieu de UTA, sub-domain context)
--       → SELECT fail → 42501 reporté comme violation INSERT.
--
--   H2. La policy INSERT v3 `user_is_member_of_tenant()` ne check que
--       `user_tenant_assignments` (UTA). Un user qui n'est rattaché que
--       via `user_tenant_roles` (UTR) sans UTA serait rejeté.
--
--   H3. `current_setting('request.jwt.claims', true)` retourne NULL en
--       runtime PostgREST (hypothèse historique audit doc).
--
-- Ce diagnostic dump dans king_notifications pour validation manuelle.
-- ============================================================================

DO $$
DECLARE
  v_insert_policies jsonb;
  v_select_policies jsonb;
  v_helpers jsonb;
  v_user_is_member_def text;
  v_get_user_tenant_def text;
  v_uta_count int;
  v_utr_count int;
  v_orphan_utr int;
BEGIN
  -- ─── 1. Snapshot des policies INSERT sur clients ─────────────────
  SELECT jsonb_agg(jsonb_build_object(
    'policy', polname,
    'permissive', polpermissive,
    'roles', polroles::regrole[]::text[],
    'with_check', pg_get_expr(polwithcheck, polrelid)
  ))
  INTO v_insert_policies
  FROM pg_policy
  WHERE polrelid = 'public.clients'::regclass
    AND polcmd = 'a';  -- 'a' = INSERT

  -- ─── 2. Snapshot des policies SELECT sur clients ─────────────────
  SELECT jsonb_agg(jsonb_build_object(
    'policy', polname,
    'permissive', polpermissive,
    'using', pg_get_expr(polqual, polrelid)
  ))
  INTO v_select_policies
  FROM pg_policy
  WHERE polrelid = 'public.clients'::regclass
    AND polcmd = 'r';  -- 'r' = SELECT

  -- ─── 3. Définitions des helpers critiques ────────────────────────
  SELECT pg_get_functiondef(p.oid)
  INTO v_user_is_member_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'user_is_member_of_tenant'
  LIMIT 1;

  SELECT pg_get_functiondef(p.oid)
  INTO v_get_user_tenant_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'get_user_tenant_id'
  LIMIT 1;

  -- ─── 4. Stats UTA vs UTR (qui supporte H2) ───────────────────────
  SELECT COUNT(*) INTO v_uta_count FROM public.user_tenant_assignments;
  SELECT COUNT(*) INTO v_utr_count FROM public.user_tenant_roles;

  -- Users qui ont UTR mais PAS UTA → bloqués par user_is_member_of_tenant
  SELECT COUNT(DISTINCT utr.user_id)
  INTO v_orphan_utr
  FROM public.user_tenant_roles utr
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_tenant_assignments uta
    WHERE uta.user_id = utr.user_id
      AND uta.tenant_id = utr.tenant_id
  );

  v_helpers := jsonb_build_object(
    'user_is_member_of_tenant_def', LEFT(COALESCE(v_user_is_member_def, '(not found)'), 2000),
    'get_user_tenant_id_def', LEFT(COALESCE(v_get_user_tenant_def, '(not found)'), 2000),
    'uta_total', v_uta_count,
    'utr_total', v_utr_count,
    'utr_users_without_uta', v_orphan_utr
  );

  -- ─── 5. Dump dans king_notifications ─────────────────────────────
  INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
  VALUES (
    '🔍 V1 diagnostic — état RLS clients INSERT/SELECT',
    format(
      'Snapshot policies + helpers pour root cause RLS 42501. UTA=%s, UTR=%s, users UTR sans UTA=%s. Si v_orphan_utr > 0 → H2 confirmée (user_is_member_of_tenant ne check pas UTR). Inspecter metadata pour les policies actives.',
      v_uta_count, v_utr_count, v_orphan_utr
    ),
    'system_info',
    'high',
    jsonb_build_object(
      'lint_targeted', 'V1_rls_42501_root_cause',
      'insert_policies_clients', COALESCE(v_insert_policies, '[]'::jsonb),
      'select_policies_clients', COALESCE(v_select_policies, '[]'::jsonb),
      'helpers', v_helpers,
      'date_diagnostic', now()
    )
  );

  RAISE NOTICE 'Diagnostic V1 dumpé dans king_notifications. UTA=%, UTR=%, orphan UTR users=%',
    v_uta_count, v_utr_count, v_orphan_utr;
END $$;
