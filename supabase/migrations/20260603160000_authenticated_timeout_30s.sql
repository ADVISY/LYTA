-- ============================================================================
-- Palier d'urgence : statement_timeout authenticated 8s → 30s
-- ============================================================================
-- Le timeout statement par défaut de Supabase (8s) cause des fails de
-- connexion pour les Agents sur gros tenants (Stéphane / JCG) car la
-- policy SELECT clients scopée par rôle évalue can_access_client(id)
-- pour chaque row (~3700 rows JCG) en ~42 sec.
--
-- 30 sec donne de la marge le temps qu'on optimise la policy à fond
-- (inline réussi à 100% nécessite de refactorer les fonctions helper
-- pour zéro param row-dépendant + LEAKPROOF + PARALLEL SAFE).
-- ============================================================================

ALTER ROLE authenticated SET statement_timeout = '30s';

-- Aussi pour les RPC qui passent par anon (avant login complet)
ALTER ROLE anon SET statement_timeout = '15s';

-- ============================================================================
-- King notification
-- ============================================================================
INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
VALUES (
  'Palier perf : statement_timeout authenticated 8s → 30s',
  'Augmentation temporaire du timeout SQL pour eviter les erreurs canceling statement sur les Agents avec gros tenant. Optimisation can_access_client / policy SELECT clients en cours (vrai fix vise <100ms).',
  'system_info', 'high',
  jsonb_build_object(
    'migration', '20260603160000_authenticated_timeout_30s',
    'before', '8s',
    'after', '30s'
  )
);
