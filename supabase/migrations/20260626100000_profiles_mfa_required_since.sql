-- ============================================================================
-- 2FA obligatoire pour admins/king — tracking du grace period
-- ============================================================================
-- Chantier sécu (26 juin 2026) : on force le TOTP pour tous les utilisateurs
-- avec rôle `admin` ou `king`. Comme on a probablement déjà des admins en
-- prod qui n'ont pas encore enrôlé de facteur TOTP, on ne peut pas les
-- bloquer dur du jour au lendemain — sinon ils sont kickés sans pouvoir
-- même accéder à la page d'enrôlement.
--
-- Solution : grace period de 7 jours par utilisateur.
--   - Le frontend pose `mfa_required_since = now()` la 1re fois qu'il détecte
--     un admin/king sans factor TOTP (via update RLS).
--   - Pendant 7j depuis ce timestamp : banner non-dismissible "Activez 2FA
--     dans X jours" en haut du dashboard, le user peut continuer à bosser.
--   - Après 7j : hard block, redirect vers /setup-mfa, aucune autre page
--     accessible jusqu'à enrôlement.
--
-- Migration STRICTEMENT additive : nouvelle colonne nullable, valeur NULL
-- par défaut → aucune data existante n'est modifiée. Le frontend posera la
-- valeur au prochain login de chaque admin concerné.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'mfa_required_since'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN mfa_required_since TIMESTAMPTZ NULL;

    COMMENT ON COLUMN public.profiles.mfa_required_since IS
      'Posé par le frontend la 1re fois qu''un admin/king se connecte sans factor TOTP. Définit T0 du grace period 7j avant hard block.';
  END IF;
END $$;

-- Petit index partiel : seuls les users avec MFA "required mais pas encore"
-- (i.e. mfa_required_since défini) sont consultés en boucle → on les indexe
-- pour les requêtes du KING (liste des admins en retard).
CREATE INDEX IF NOT EXISTS idx_profiles_mfa_required_since
  ON public.profiles(mfa_required_since)
  WHERE mfa_required_since IS NOT NULL;


-- Notification KING
INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
VALUES (
  '🔐 2FA TOTP obligatoire pour admins/king',
  'Ajout d''une colonne nullable `profiles.mfa_required_since` qui pose T0 du grace period (7j) la 1re fois qu''un admin/king se logge sans factor TOTP. Banner non-dismissible pendant la grace, hard block après. Le frontend gère tout — la migration est purement additive (aucune data touchée).',
  'system_info',
  'high',
  jsonb_build_object(
    'migration', '20260626100000_profiles_mfa_required_since',
    'feature', '2fa_mandatory_for_admins',
    'grace_period_days', 7,
    'affected_roles', jsonb_build_array('admin', 'king')
  )
);
