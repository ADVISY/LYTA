-- ============================================================================
-- support_tickets — système de tickets tenant ↔ king
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  subject TEXT NOT NULL,
  category TEXT
    CHECK (category IS NULL OR category IN ('bug','feature','billing','account','onboarding','other')),
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low','normal','high','urgent')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','in_progress','waiting_tenant','resolved','closed')),

  created_by UUID REFERENCES auth.users(id),
  assigned_to UUID REFERENCES auth.users(id),

  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_role TEXT,  -- 'tenant' | 'king'

  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  metadata JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant ON public.support_tickets(tenant_id, status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON public.support_tickets(assigned_to) WHERE assigned_to IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,

  sender_user_id UUID REFERENCES auth.users(id),
  sender_role TEXT NOT NULL CHECK (sender_role IN ('tenant','king','system')),
  sender_name TEXT,

  body TEXT NOT NULL,
  attachments JSONB,           -- [{ file_key, name, mime, size }]
  read_at_by_tenant TIMESTAMPTZ,
  read_at_by_king TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON public.support_ticket_messages(ticket_id, created_at);

-- Trigger : sync last_message_at + last_message_role + créer notif king
CREATE OR REPLACE FUNCTION public.touch_support_ticket_on_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant_id UUID;
  v_subject TEXT;
  v_tenant_name TEXT;
BEGIN
  UPDATE public.support_tickets
  SET last_message_at = NEW.created_at,
      last_message_role = NEW.sender_role,
      status = CASE
        WHEN NEW.sender_role = 'tenant' AND status IN ('resolved','closed') THEN 'open'
        WHEN NEW.sender_role = 'tenant' THEN status
        WHEN NEW.sender_role = 'king' AND status = 'open' THEN 'in_progress'
        ELSE status
      END,
      updated_at = now()
  WHERE id = NEW.ticket_id
  RETURNING tenant_id, subject INTO v_tenant_id, v_subject;

  -- Notif king si message tenant
  IF NEW.sender_role = 'tenant' AND v_tenant_id IS NOT NULL THEN
    SELECT name INTO v_tenant_name FROM public.tenants WHERE id = v_tenant_id;
    INSERT INTO public.king_notifications (
      title, message, kind, priority, tenant_id, tenant_name,
      action_url, action_label, metadata
    ) VALUES (
      '💬 Nouveau message support',
      v_tenant_name || ' : ' || v_subject,
      'support_ticket_new_message', 'high',
      v_tenant_id, v_tenant_name,
      '/king/support?ticket=' || NEW.ticket_id, 'Ouvrir le ticket',
      jsonb_build_object('ticket_id', NEW.ticket_id, 'sender_user_id', NEW.sender_user_id)
    );
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_touch_support_ticket_on_message ON public.support_ticket_messages;
CREATE TRIGGER trg_touch_support_ticket_on_message
  AFTER INSERT ON public.support_ticket_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_support_ticket_on_message();

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

-- Tickets : tenant voit ses tickets, king voit tout
DROP POLICY IF EXISTS support_tickets_select ON public.support_tickets;
CREATE POLICY support_tickets_select ON public.support_tickets
  FOR SELECT TO authenticated
  USING (
    public.is_king()
    OR tenant_id IN (SELECT tenant_id FROM public.user_tenant_assignments WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS support_tickets_insert ON public.support_tickets;
CREATE POLICY support_tickets_insert ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_king()
    OR tenant_id IN (SELECT tenant_id FROM public.user_tenant_assignments WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS support_tickets_update ON public.support_tickets;
CREATE POLICY support_tickets_update ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (
    public.is_king()
    OR tenant_id IN (SELECT tenant_id FROM public.user_tenant_assignments WHERE user_id = auth.uid())
  );

-- Messages : visible si le ticket est visible
DROP POLICY IF EXISTS support_messages_select ON public.support_ticket_messages;
CREATE POLICY support_messages_select ON public.support_ticket_messages
  FOR SELECT TO authenticated
  USING (
    public.is_king()
    OR ticket_id IN (
      SELECT id FROM public.support_tickets
      WHERE tenant_id IN (SELECT tenant_id FROM public.user_tenant_assignments WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS support_messages_insert ON public.support_ticket_messages;
CREATE POLICY support_messages_insert ON public.support_ticket_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_king()
    OR ticket_id IN (
      SELECT id FROM public.support_tickets
      WHERE tenant_id IN (SELECT tenant_id FROM public.user_tenant_assignments WHERE user_id = auth.uid())
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT SELECT, INSERT ON public.support_ticket_messages TO authenticated;
