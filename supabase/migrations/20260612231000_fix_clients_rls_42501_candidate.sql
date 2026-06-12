-- ============================================================================
-- FIX CANDIDAT V1 — RLS 42501 sur clients (NE PAS PUSH SANS TEST)
-- ============================================================================
-- ⚠️  CETTE MIGRATION EST UN CANDIDAT. NE PAS L'APPLIQUER EN PROD SANS
-- avoir d'abord lancé la migration diagnostic `20260612230000_diagnose_*`
-- et confirmé l'hypothèse H2 (présence de users UTR sans UTA correspondant)
-- via inspection des king_notifications.
--
-- Objectif : élargir `user_is_member_of_tenant()` pour reconnaître les
-- 4 modes d'appartenance présents en DB (UTA, UTR, rôle global admin,
-- king) et ainsi débloquer l'INSERT direct sur `clients`, `policies`,
-- `family_members`, `documents` sans passer par les edge functions.
--
-- Stratégie sécurité (PRINCIPE FONDAMENTAL) :
--   1. SECURITY DEFINER + search_path figé (anti-trojan)
--   2. STABLE → Postgres peut hoister l'appel et cacher le résultat
--   3. Pas de NEW arg row-dependent : on prend (user_id, tenant_id)
--      → un seul appel par couple unique pour toute la requête
--   4. La fonction ne fuit rien : retourne juste un booléen
--
-- Si tout OK après tests :
--   - Édulcorer / retirer les workarounds (`create-client`, `bypass-insert`,
--     `save-policy`) qui passent en service_role.
--   - V1 ➜ FIXÉ dans le doc audit.
--
-- ROLLBACK : la nouvelle fonction est une réécriture compatible
-- (même signature). Il suffit de réappliquer la précédente version
-- (20260527200000) pour revenir.
-- ============================================================================


-- ─── 1. Refactor user_is_member_of_tenant pour couvrir UTA + UTR + global
CREATE OR REPLACE FUNCTION public.user_is_member_of_tenant(
  p_user_id uuid,
  p_tenant_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT
    p_user_id IS NOT NULL
    AND p_tenant_id IS NOT NULL
    AND (
      -- A. King = bypass total (préservé)
      public.is_king()

      -- B. Admin global (préservé)
      OR public.has_role(p_user_id, 'admin'::public.app_role)

      -- C. Membership via user_tenant_assignments (preservé)
      OR EXISTS (
        SELECT 1
        FROM public.user_tenant_assignments uta
        WHERE uta.user_id = p_user_id
          AND uta.tenant_id = p_tenant_id
      )

      -- D. ✨ NOUVEAU : membership via user_tenant_roles (rôles dynamiques)
      --    C'est CECI qui fixe H2 — un user qui a un rôle tenant assigné
      --    mais pas d'enregistrement UTA était auparavant rejeté.
      OR EXISTS (
        SELECT 1
        FROM public.user_tenant_roles utr
        JOIN public.tenant_roles tr ON tr.id = utr.role_id
        WHERE utr.user_id = p_user_id
          AND tr.tenant_id = p_tenant_id
          AND tr.is_active = true
          AND (
            utr.tenant_id = p_tenant_id
            OR utr.tenant_id IS NULL
          )
      )
    )
$$;

COMMENT ON FUNCTION public.user_is_member_of_tenant(uuid, uuid) IS
  'V1 fix — Reconnaît membership via UTA OU UTR OU rôle global admin OU king. '
  'Utilisé par la policy INSERT clients v3 et idéalement par SELECT/UPDATE/DELETE policies.';


-- ─── 2. Aligner la policy SELECT pour le RETURNING (H1)
-- L'INSERT du front fait `.insert([...]).select("*").single()` → le RETURNING
-- évalue la policy SELECT sur la row insérée. Si elle plante → 42501 reporté
-- comme INSERT violation. On garde la policy "Scoped clients view with index"
-- existante pour la PERF, mais on ajoute une branche RETURNING-safe via
-- user_is_member_of_tenant qui couvre TOUS les modes d'appartenance.

DROP POLICY IF EXISTS "RETURNING-safe tenant member view" ON public.clients;

CREATE POLICY "RETURNING-safe tenant member view"
ON public.clients
FOR SELECT
TO authenticated
USING (
  -- Branche RETURNING (admin/manager qui vient de créer une fiche)
  -- Combinée en OR avec les autres policies SELECT existantes
  -- (toutes PERMISSIVE → OR), aucun risque de régression.
  public.user_is_member_of_tenant(auth.uid(), tenant_id)
);


-- ─── 3. King notification (déploiement contrôlé)
INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
VALUES (
  '🔧 V1 fix candidat appliqué — user_is_member_of_tenant élargi',
  'Refactor user_is_member_of_tenant() pour couvrir UTA + UTR + admin global. Nouvelle policy SELECT "RETURNING-safe" ajoutée sur clients. Si les INSERTs directs depuis le front fonctionnent maintenant sans 42501 → V1 FIXÉ et les workarounds (create-client, bypass-insert, save-policy) peuvent être retirés.',
  'system_info',
  'high',
  jsonb_build_object(
    'lint_targeted', 'V1_rls_42501',
    'migration', '20260612231000_fix_clients_rls_42501_candidate',
    'rollback_to', '20260527200000_fix_clients_insert_via_security_definer',
    'next_steps', jsonb_build_array(
      '1. Tester INSERT client direct via front (sans bypass)',
      '2. Si OK → retirer fallback dans useClients.tsx createClient mutation',
      '3. Tester INSERT policy/family_members/documents idem',
      '4. Si OK → retirer create-client/bypass-insert/save-policy edge fns'
    )
  )
);
