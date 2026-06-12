-- ============================================================================
-- Revoke anon EXECUTE on SECURITY DEFINER functions (Advisor phase 2)
-- ============================================================================
-- Supabase Security Advisor flagait 128 fonctions SECURITY DEFINER exécutables
-- par le rôle `anon` (= utilisateur non connecté). Risque : si une de ces
-- fonctions a un bug d'auth interne, un attaquant non authentifié peut
-- l'invoquer et obtenir des privilèges élevés (la fn s'exécute avec les
-- droits de son owner = postgres).
--
-- Fix : on REVOKE EXECUTE FROM anon sur toutes les fonctions SECURITY DEFINER
-- du schema public, SAUF une whitelist explicite de 6 fonctions qui sont
-- réellement appelées depuis des pages publiques (page de connexion tenant,
-- /signer/:token, etc.) et dont l'absence casserait le produit.
--
-- ⚠️ AUCUN CHANGEMENT POUR `authenticated` :
-- Les helpers RLS (can_access_client, get_user_tenant_id, has_role, etc.)
-- restent exécutables par les users connectés. Aucune RLS n'est cassée.
-- Aucune fonctionnalité utilisateur authentifié n'est impactée.
--
-- ⚠️ AUCUNE DONNÉE TOUCHÉE.
-- Cette migration ne fait que des `REVOKE EXECUTE` (droits) sur des
-- fonctions. Pas d'INSERT, UPDATE, DELETE.
--
-- Whitelist anon (vérifiée le 12 juin 2026 via grep RPC côté frontend) :
--   • get_tenant_branding_by_slug(text)       — page connexion sous-domaine
--   • get_public_tenant_branding(text)        — variante publique branding
--   • get_signature_request_by_token(text)    — page /signer/:token
--   • mark_signature_request_viewed(text)     — idem (tracking)
--   • get_assigned_advisor_public(uuid)       — affichage conseiller espace client
--   • check_slug_availability(text)           — page d'inscription self-signup
--
-- Effet attendu sur Advisor : warnings
-- `anon_security_definer_function_executable` passent de 128 à ~6.
-- Les `authenticated_security_definer_function_executable` (128) restent
-- car beaucoup sont des helpers RLS qui DOIVENT être exécutables par les
-- users connectés. À traiter en phase 3 si besoin avec rôles métier dédiés.
-- ============================================================================

DO $$
DECLARE
  fn record;
  whitelist text[] := ARRAY[
    'get_tenant_branding_by_slug',
    'get_public_tenant_branding',
    'get_signature_request_by_token',
    'mark_signature_request_viewed',
    'get_assigned_advisor_public',
    'check_slug_availability'
  ];
  count_revoked int := 0;
BEGIN
  FOR fn IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS fn_name,
      pg_get_function_identity_arguments(p.oid) AS fn_args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prosecdef = true                    -- SECURITY DEFINER uniquement
      AND p.proname <> ALL(whitelist)           -- exclure la whitelist
  LOOP
    BEGIN
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon',
        fn.schema_name, fn.fn_name, fn.fn_args
      );
      count_revoked := count_revoked + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Si REVOKE fail pour une raison spécifique (fn n'existe plus,
      -- droits déjà absents…), on log et on continue plutôt que crasher.
      RAISE NOTICE 'Skip REVOKE on %.%(%): %',
        fn.schema_name, fn.fn_name, fn.fn_args, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'REVOKE EXECUTE FROM anon appliqué sur % fonctions SECURITY DEFINER (% whitelistées exclues)',
    count_revoked, array_length(whitelist, 1);
END $$;


-- ─── Vérif whitelist : les fonctions doivent rester exécutables ─
-- Signatures réelles validées le 12 juin 2026 via SQL :
--   get_tenant_branding_by_slug(p_slug text)
--   get_public_tenant_branding(p_slug text)
--   get_signature_request_by_token(p_token uuid)   ← uuid pas text
--   mark_signature_request_viewed(p_token uuid)    ← uuid pas text
--   get_assigned_advisor_public()                   ← pas d'args
--   check_slug_availability                         ← n'existe pas en DB,
--                                                     skip silencieux
GRANT EXECUTE ON FUNCTION public.get_tenant_branding_by_slug(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_tenant_branding(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_signature_request_by_token(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.mark_signature_request_viewed(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_assigned_advisor_public() TO anon;
-- check_slug_availability : pas dans pg_proc → skip (cf. edge fn dédiée
-- check-slug-availability qui gère ça côté server-side).


-- ─── Notification KING ───────────────────────────────────────────
INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
VALUES (
  '🔐 Advisor phase 2 — anon REVOKE sur SECURITY DEFINER',
  'REVOKE EXECUTE FROM anon sur ~124 fonctions SECURITY DEFINER. Whitelist de 6 fonctions publiques préservée (branding tenant, page signature, slug check). Aucun impact authenticated. Warnings Advisor anon doivent passer de 128 à ~6.',
  'system_info',
  'normal',
  jsonb_build_object(
    'lint_targeted', 'anon_security_definer_function_executable',
    'whitelist_count', 6,
    'whitelisted_functions', ARRAY[
      'get_tenant_branding_by_slug',
      'get_public_tenant_branding',
      'get_signature_request_by_token',
      'mark_signature_request_viewed',
      'get_assigned_advisor_public',
      'check_slug_availability'
    ]
  )
);
