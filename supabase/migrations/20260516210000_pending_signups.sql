-- ============================================================================
-- pending_signups — tracker les paiements Stripe sans form /access finalisé
-- ============================================================================
-- Le flow self-signup : Stripe Checkout OK → redirige vers lyta.ch/access
-- → broker remplit le form → tenant créé. Si le broker ferme la page sans
-- finaliser, on a un paiement Stripe orphelin sans tenant correspondant.
--
-- Cette table garde une trace de chaque checkout self-signup (insertée par
-- stripe-webhook au "checkout.session.completed") et est marquée finalized
-- par provision-self-signup-tenant. King peut voir les pending et renvoyer
-- l'email de finalisation.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pending_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identifiants Stripe (1 row max par session)
  stripe_session_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  customer_email TEXT,
  plan_id TEXT,
  amount_chf NUMERIC(10,2),

  -- État
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'finalized', 'expired', 'cancelled')),
  finalized_at TIMESTAMPTZ,
  finalized_tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,

  -- Métadonnées
  reminder_count INT NOT NULL DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_signups_status
  ON public.pending_signups(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pending_signups_email
  ON public.pending_signups(customer_email);

COMMENT ON TABLE public.pending_signups IS
  'Tracker des paiements Stripe self-signup en attente de finalisation du form /access. Inséré par stripe-webhook (checkout.session.completed), finalisé par provision-self-signup-tenant.';

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.touch_pending_signups() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_touch_pending_signups ON public.pending_signups;
CREATE TRIGGER trg_touch_pending_signups
  BEFORE UPDATE ON public.pending_signups
  FOR EACH ROW EXECUTE FUNCTION public.touch_pending_signups();

-- RLS : king-only
ALTER TABLE public.pending_signups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pending_signups_king_all ON public.pending_signups;
CREATE POLICY pending_signups_king_all ON public.pending_signups
  FOR ALL TO authenticated
  USING (public.is_king())
  WITH CHECK (public.is_king());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_signups TO authenticated;
