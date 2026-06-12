-- ============================================================================
-- grant_vault_read_to_postgres_for_pg_cron
-- ============================================================================
-- Fix : les 4 crons (birthday, renewal, follow-up, retry tenant-onboarding)
-- échouaient toutes les heures avec "SERVICE_ROLE_KEY manquante dans vault"
-- depuis 25+ jours, générant ~4 notifications/jour dans king_notifications.
--
-- Diagnostic (12 juin 2026) :
--   - SERVICE_ROLE_KEY et PROJECT_URL étaient bien stockés dans vault.secrets
--   - Lecture OK depuis le SQL Editor (rôle `service_role`)
--   - Lecture KO depuis pg_cron (rôle `postgres`)
--   → Par défaut sur Supabase, `vault.decrypted_secrets` n'est accessible
--     qu'au rôle `service_role`. Le rôle `postgres` (utilisé par pg_cron pour
--     exécuter les jobs) n'a pas droit de SELECT dessus, même quand la fonction
--     appelée est SECURITY DEFINER (la view décrypte au runtime avec le rôle
--     courant, pas celui du owner de la fonction).
--
-- Fix : on grant explicitement à `postgres` :
--   - USAGE sur le schema vault
--   - SELECT sur vault.decrypted_secrets (la view utilisée par les fonctions)
--   - SELECT sur vault.secrets (la table sous-jacente, par sécurité)
--
-- Impact : aucun risque sécurité supplémentaire — `postgres` est déjà superuser
-- côté Supabase managed et a accès à TOUT par d'autres chemins. On ne fait que
-- débloquer le chemin pg_cron + SECURITY DEFINER → vault.decrypted_secrets.
-- ============================================================================

GRANT USAGE ON SCHEMA vault TO postgres;
GRANT SELECT ON vault.decrypted_secrets TO postgres;
GRANT SELECT ON vault.secrets TO postgres;

-- Pour les futurs secrets créés (ne pas avoir à re-grant)
ALTER DEFAULT PRIVILEGES IN SCHEMA vault GRANT SELECT ON TABLES TO postgres;
