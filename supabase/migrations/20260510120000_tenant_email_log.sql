-- ============================================================================
-- FEATURE — Tenant-wide centralised email log
-- ============================================================================
--
-- Habib (10/05): "il faut également mettre le suivi des envois d'email dans la
-- case publicité quand un email a été envoyé peu importe lequel — emails
-- rapides, publicité, connexion / création de compte, emails aux compagnies".
--
-- Today every Edge Function writes its own log (or none at all):
--   - mandat_dispatch_log    : tracks insurance-company dispatches
--   - email_campaigns / sends: tracks the bulk marketing campaigns
--   - account creation       : no log at all
--   - signature invitations  : no log at all
--   - one-off "quick emails"  : no log at all
--
-- This table unifies the trail so the broker can answer at a glance "did
-- LYTA send anything to clientX this month?" — without hunting through 4
-- different tables.
--
-- The mandat dispatch log keeps its own row for its dispatch-specific
-- fields (one row per (mandat, company)), but ALSO writes a parallel
-- row here so the unified view stays complete.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tenant_email_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- One of:
  --   mandat_signed        : welcome email after a mandat de gestion is signed
  --   mandat_dispatch      : forward of signed mandat to insurance company
  --   signature_invite     : "click here to sign" link
  --   account_created      : welcome email with temp password
  --   campaign             : bulk marketing campaign (publicité tab)
  --   quick_email          : one-off email sent from the publicité tab
  --   crm_email            : any other email sent through send-crm-email
  --   transactional        : fallback for anything that doesn't fit above
  kind        TEXT NOT NULL,

  recipient_email TEXT NOT NULL,
  recipient_name  TEXT,

  -- Optional sender display name (e.g. cabinet name shown in From header)
  sender_name TEXT,
  subject     TEXT,

  -- sent      : Resend accepted the email
  -- failed    : Resend rejected or threw before send
  -- queued    : queued in scheduled_emails, not yet attempted
  -- bounced   : hard bounce reported via webhook (future)
  status      TEXT NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'failed', 'queued', 'bounced')),

  error_message     TEXT,
  resend_message_id TEXT,

  -- Optional pointers to the entity that triggered the send. Lets the UI
  -- link back to the client / mandat / campaign that generated the email.
  related_entity_type TEXT,  -- 'client' | 'signature_request' | 'campaign' | 'company' | NULL
  related_entity_id   UUID,

  -- Free-form additional context (template id, client id, mandate id, etc.)
  context JSONB DEFAULT '{}'::JSONB,

  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tenant_email_log_tenant
  ON public.tenant_email_log(tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_email_log_tenant_kind_date
  ON public.tenant_email_log(tenant_id, kind, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_email_log_recipient
  ON public.tenant_email_log(tenant_id, recipient_email);

CREATE INDEX IF NOT EXISTS idx_tenant_email_log_related
  ON public.tenant_email_log(related_entity_type, related_entity_id);


-- ─── RLS ────────────────────────────────────────────────────────────
ALTER TABLE public.tenant_email_log ENABLE ROW LEVEL SECURITY;

-- SELECT — tenant members read their own emails. King reads all.
CREATE POLICY "Tenant members can view their email log"
ON public.tenant_email_log FOR SELECT
TO authenticated
USING (
  public.is_king()
  OR tenant_id = public.get_user_tenant_id()
);

-- INSERT — Edge Functions use service_role and bypass RLS, but allow
-- direct insert from authenticated tenant members (e.g. for "manual
-- send confirmed" cases mirroring mandat_dispatch_log).
CREATE POLICY "Tenant members can insert into their email log"
ON public.tenant_email_log FOR INSERT
TO authenticated
WITH CHECK (
  public.is_king()
  OR tenant_id = public.get_user_tenant_id()
);

-- UPDATE — for status transitions (sent → bounced when a webhook arrives,
-- etc.). Tenant-scoped.
CREATE POLICY "Tenant members can update their email log"
ON public.tenant_email_log FOR UPDATE
TO authenticated
USING (
  public.is_king()
  OR tenant_id = public.get_user_tenant_id()
)
WITH CHECK (
  public.is_king()
  OR tenant_id = public.get_user_tenant_id()
);

-- No DELETE policy — the email log is an audit trail, immutable from app
-- land. King / service_role can still delete via raw SQL for compliance
-- (right-to-erasure requests).
