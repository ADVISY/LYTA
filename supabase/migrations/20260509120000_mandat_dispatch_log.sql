-- ============================================================================
-- FEATURE — Auto-dispatch signed Mandat de gestion to insurance companies
-- ============================================================================
--
-- After a client signs a Mandat de gestion, the broker needs to forward the
-- signed PDF to every insurance company listed in the mandate. This is what
-- triggers downstream "commission de gestion" (management commission) at
-- each carrier — historically done manually by the broker via email.
--
-- This table records every dispatch attempt (one row per (mandat,
-- company) pair) so we have a complete audit trail and can retry / mark
-- manual / show status in the UI.
--
-- Trigger: not done in DB. The dispatch is fired explicitly from the
-- frontend ("Envoyer aux compagnies" button on the signed mandat) so the
-- broker stays in control. The Edge Function `dispatch-mandat-to-companies`
-- writes rows here.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.mandat_dispatch_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- The signed mandat we forwarded
  signature_request_id UUID NOT NULL
    REFERENCES public.signature_requests(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,

  -- Target company. We store BOTH the FK (when we could match the free-text
  -- name on the mandat to a row in insurance_companies) AND the raw name
  -- captured from the mandat payload, so the row remains readable even if
  -- the company FK becomes NULL or the company is later renamed.
  insurance_company_id UUID
    REFERENCES public.insurance_companies(id) ON DELETE SET NULL,
  insurance_company_name TEXT NOT NULL,

  -- The contact we sent to (a row from company_contacts at dispatch time).
  -- Snapshot of the email so we keep history even if the contact row is
  -- later edited or deleted.
  company_contact_id UUID REFERENCES public.company_contacts(id) ON DELETE SET NULL,
  recipient_email TEXT,

  -- Lifecycle
  --   pending          : queued, not yet attempted
  --   sent             : Resend accepted the email (200 OK)
  --   failed           : Resend rejected or threw
  --   manual_required  : no email available for this company at dispatch
  --                      time → broker must send manually
  --   manual_done      : broker confirmed they sent it manually
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'manual_required', 'manual_done')),

  error_message TEXT,
  resend_message_id TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,

  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mandat_dispatch_log_tenant
  ON public.mandat_dispatch_log(tenant_id);

CREATE INDEX IF NOT EXISTS idx_mandat_dispatch_log_request
  ON public.mandat_dispatch_log(signature_request_id);

CREATE INDEX IF NOT EXISTS idx_mandat_dispatch_log_status
  ON public.mandat_dispatch_log(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_mandat_dispatch_log_client
  ON public.mandat_dispatch_log(client_id);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_mandat_dispatch_log_updated_at
  ON public.mandat_dispatch_log;
CREATE TRIGGER trg_mandat_dispatch_log_updated_at
  BEFORE UPDATE ON public.mandat_dispatch_log
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- RLS — same tenant-scoped pattern as morning fixes
ALTER TABLE public.mandat_dispatch_log ENABLE ROW LEVEL SECURITY;

-- SELECT — tenant members read their own dispatch log
CREATE POLICY "Tenant members can view their mandat dispatch log"
ON public.mandat_dispatch_log FOR SELECT
TO authenticated
USING (
  public.is_king()
  OR tenant_id = public.get_user_tenant_id()
);

-- INSERT — Edge Function uses service_role and bypasses RLS, but allow
-- direct insert from authenticated tenant members for the manual_done
-- toggle path.
CREATE POLICY "Tenant members can insert into their mandat dispatch log"
ON public.mandat_dispatch_log FOR INSERT
TO authenticated
WITH CHECK (
  public.is_king()
  OR tenant_id = public.get_user_tenant_id()
);

-- UPDATE — for the manual_done toggle and retry flag
CREATE POLICY "Tenant members can update their mandat dispatch log"
ON public.mandat_dispatch_log FOR UPDATE
TO authenticated
USING (
  public.is_king()
  OR tenant_id = public.get_user_tenant_id()
)
WITH CHECK (
  public.is_king()
  OR tenant_id = public.get_user_tenant_id()
);

-- No DELETE — once dispatched the audit trail is immutable from app land.
-- (King can still delete via service_role if absolutely needed.)
