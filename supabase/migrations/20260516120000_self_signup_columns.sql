-- ============================================================================
-- Self-signup tenant flow — colonnes de traçabilité + idempotence
-- ============================================================================
-- Le flow lyta.ch (Lovable) → Stripe Checkout → /access?session_id=… → form
-- crée un tenant via l'edge function provision-self-signup-tenant.
-- On stocke la session Stripe pour empêcher la double-création si le user
-- soumet 2 fois ou si le webhook re-déclenche.
-- ============================================================================

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS signup_source TEXT
    CHECK (signup_source IS NULL OR signup_source IN ('king_manual','self_signup','admin_invite'));

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS signup_session_id TEXT;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS signup_completed_at TIMESTAMPTZ;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- Idempotence : un seul tenant par session Stripe
CREATE UNIQUE INDEX IF NOT EXISTS uniq_tenants_signup_session
  ON public.tenants(signup_session_id)
  WHERE signup_session_id IS NOT NULL;

COMMENT ON COLUMN public.tenants.signup_source IS
  'D''où vient ce tenant : king_manual (créé par admin LYTA), self_signup (inscription publique lyta.ch), admin_invite (invité par un autre admin).';

COMMENT ON COLUMN public.tenants.signup_session_id IS
  'Stripe Checkout session ID utilisée pour idempotence : si on rejoue le provisioning avec la même session, on retourne le tenant existant au lieu d''en créer un nouveau.';

COMMENT ON COLUMN public.tenants.trial_ends_at IS
  'Fin de la période d''essai. Pour info — la source de vérité est sur Stripe (subscription.trial_end).';
