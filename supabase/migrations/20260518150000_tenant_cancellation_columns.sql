-- ============================================================================
-- Colonnes pour tracker l'annulation d'abonnement self-service
-- ============================================================================
-- Quand un tenant clique "Annuler mon abonnement" depuis CRM → Abonnement,
-- on appelle l'edge function cancel-tenant-subscription qui :
-- 1. Cancel la sub Stripe avec cancel_at_period_end=true
-- 2. Marque le tenant ici (cancel_at_period_end, cancellation_requested_at)
-- 3. Notifie king + email support
--
-- Le tenant garde son accès jusqu'à la fin de la période payée. À l'expiration,
-- Stripe envoie customer.subscription.deleted → notre webhook bascule
-- tenant_status='cancelled'.
-- ============================================================================

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_tenants_cancel_pending
  ON public.tenants (cancel_at_period_end)
  WHERE cancel_at_period_end = TRUE;

COMMENT ON COLUMN public.tenants.cancel_at_period_end IS
  'TRUE si le tenant a demandé l''annulation. Reste actif jusqu''à current_period_end Stripe.';
COMMENT ON COLUMN public.tenants.cancellation_requested_at IS
  'Timestamp de la demande d''annulation (clic bouton CRM → Abonnement).';
COMMENT ON COLUMN public.tenants.cancellation_reason IS
  'Raison saisie par le tenant lors de l''annulation (optionnelle, max 1000 chars).';
