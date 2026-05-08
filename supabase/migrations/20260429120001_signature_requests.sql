-- Remote signature workflow for broker-to-client documents (mandat, procuration, resiliation art 45, etc.)
-- The CRM user prepares a document, signs the broker side, then sends an invitation to the client.
-- The client opens a public link and signs without needing to be logged in.

CREATE TABLE IF NOT EXISTS public.signature_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,

  -- Type of document being signed
  document_kind TEXT NOT NULL CHECK (document_kind IN (
    'mandat_gestion',
    'procuration',
    'resiliation_lca_45',
    'autre'
  )),

  -- Snapshot of the structured payload used to render the document at signing time.
  -- For mandat_gestion: { insurances: {...}, lieu, advisorSignature (b64) }
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Optional preview PDF prepared by the broker (with broker signature already in place)
  preview_file_key TEXT,

  -- Final signed PDF stored once the client signs
  signed_file_key TEXT,
  signed_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,

  -- Signature evidence captured at signing time (audit trail)
  client_signature_image TEXT,
  client_full_name TEXT,
  client_ip TEXT,
  client_user_agent TEXT,
  document_hash TEXT,

  -- Public access token (UUID) used in /signer/:token URL.
  -- Random and unguessable; index unique.
  access_token UUID NOT NULL DEFAULT gen_random_uuid(),

  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',  -- invitation sent, waiting for client
    'viewed',   -- client opened the link
    'signed',   -- client signed
    'refused',  -- client explicitly refused
    'expired',  -- past expires_at
    'cancelled' -- broker cancelled
  )),

  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  viewed_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  refused_at TIMESTAMPTZ,
  refusal_reason TEXT,
  cancelled_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_signature_requests_token ON public.signature_requests(access_token);
CREATE INDEX idx_signature_requests_tenant ON public.signature_requests(tenant_id);
CREATE INDEX idx_signature_requests_client ON public.signature_requests(client_id);
CREATE INDEX idx_signature_requests_status ON public.signature_requests(status);
CREATE INDEX idx_signature_requests_expires ON public.signature_requests(expires_at) WHERE status IN ('pending', 'viewed');

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_signature_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_signature_requests_updated_at
BEFORE UPDATE ON public.signature_requests
FOR EACH ROW EXECUTE FUNCTION public.touch_signature_requests_updated_at();

ALTER TABLE public.signature_requests ENABLE ROW LEVEL SECURITY;

-- Tenant staff can view signature requests for their tenant
CREATE POLICY "Tenant staff can view signature requests"
ON public.signature_requests
FOR SELECT
USING (
  tenant_id = public.get_user_tenant_id()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'backoffice'::app_role)
    OR public.has_role(auth.uid(), 'partner'::app_role)
    OR public.has_role(auth.uid(), 'agent'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_tenant_permission('clients'::permission_module, 'view'::permission_action)
    OR public.has_tenant_permission('clients'::permission_module, 'update'::permission_action)
    OR created_by = auth.uid()
  )
);

-- Tenant staff can create signature requests for their tenant
CREATE POLICY "Tenant staff can create signature requests"
ON public.signature_requests
FOR INSERT
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
  AND created_by = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'backoffice'::app_role)
    OR public.has_role(auth.uid(), 'partner'::app_role)
    OR public.has_role(auth.uid(), 'agent'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_tenant_permission('clients'::permission_module, 'update'::permission_action)
  )
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_id
      AND c.tenant_id = public.get_user_tenant_id()
  )
);

-- Tenant staff can update signature requests they created (cancel, etc.)
CREATE POLICY "Tenant staff can update signature requests"
ON public.signature_requests
FOR UPDATE
USING (
  tenant_id = public.get_user_tenant_id()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'backoffice'::app_role)
    OR public.has_tenant_permission('clients'::permission_module, 'update'::permission_action)
    OR created_by = auth.uid()
  )
);

-- Clients (logged in) can see their own pending signature requests via the public connector,
-- but the actual signing flow goes through the edge function which uses service role.

-- Audit log: write a row whenever the status changes
CREATE OR REPLACE FUNCTION public.log_signature_request_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.create_audit_log(
      NEW.created_by,
      'signature_request.created',
      'signature_request',
      NEW.id,
      jsonb_build_object(
        'document_kind', NEW.document_kind,
        'client_id', NEW.client_id
      ),
      NEW.tenant_id
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.create_audit_log(
      COALESCE(NEW.created_by, OLD.created_by),
      'signature_request.status_changed',
      'signature_request',
      NEW.id,
      jsonb_build_object(
        'from', OLD.status,
        'to', NEW.status,
        'document_kind', NEW.document_kind
      ),
      NEW.tenant_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_signature_request_audit
AFTER INSERT OR UPDATE ON public.signature_requests
FOR EACH ROW EXECUTE FUNCTION public.log_signature_request_change();

-- Helper RPC the public signing page calls (anon role) to fetch a request by token
-- without exposing the full table. Returns minimal data.
CREATE OR REPLACE FUNCTION public.get_signature_request_by_token(p_token UUID)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  client_id UUID,
  document_kind TEXT,
  payload JSONB,
  preview_file_key TEXT,
  status TEXT,
  expires_at TIMESTAMPTZ,
  client_first_name TEXT,
  client_last_name TEXT,
  client_company_name TEXT,
  tenant_name TEXT,
  tenant_logo_url TEXT,
  tenant_primary_color TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sr.id,
    sr.tenant_id,
    sr.client_id,
    sr.document_kind,
    sr.payload,
    sr.preview_file_key,
    sr.status,
    sr.expires_at,
    c.first_name,
    c.last_name,
    c.company_name,
    COALESCE(tb.display_name, t.name),
    tb.logo_url,
    tb.primary_color
  FROM public.signature_requests sr
  JOIN public.clients c ON c.id = sr.client_id
  JOIN public.tenants t ON t.id = sr.tenant_id
  LEFT JOIN public.tenant_branding tb ON tb.tenant_id = t.id
  WHERE sr.access_token = p_token
    AND sr.status NOT IN ('cancelled')
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_signature_request_by_token(UUID) TO anon, authenticated;

-- Mark the request as viewed (idempotent on first view)
CREATE OR REPLACE FUNCTION public.mark_signature_request_viewed(p_token UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.signature_requests
  SET status = 'viewed', viewed_at = now()
  WHERE access_token = p_token
    AND status = 'pending';
$$;

GRANT EXECUTE ON FUNCTION public.mark_signature_request_viewed(UUID) TO anon, authenticated;
