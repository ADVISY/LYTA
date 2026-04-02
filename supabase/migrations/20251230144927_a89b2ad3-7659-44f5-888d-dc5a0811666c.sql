
-- =====================================================
-- PHASE 5: WORKFLOW & NOTIFICATIONS
-- =====================================================

-- 1. Create workflow_definitions table
CREATE TABLE IF NOT EXISTS public.workflow_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  
  -- Trigger
  trigger_type TEXT NOT NULL, -- event, schedule, manual
  trigger_event TEXT, -- policy_created, claim_submitted, document_expired, etc.
  trigger_schedule TEXT, -- cron expression for scheduled workflows
  
  -- Conditions (JSON)
  conditions JSONB DEFAULT '[]', -- [{field: 'status', operator: 'eq', value: 'active'}]
  
  -- Actions (JSON array)
  actions JSONB NOT NULL DEFAULT '[]', -- [{type: 'send_email', template: 'welcome'}, {type: 'create_task', ...}]
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.workflow_definitions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Tenant users can view their workflows"
  ON public.workflow_definitions FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can manage workflows"
  ON public.workflow_definitions FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- 2. Create workflow_executions table (logs)
CREATE TABLE IF NOT EXISTS public.workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflow_definitions(id),
  tenant_id UUID REFERENCES public.tenants(id),
  
  -- Trigger info
  triggered_by TEXT, -- event_name, schedule, user_id
  trigger_data JSONB, -- Context data that triggered the workflow
  
  -- Execution status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Results
  actions_executed INTEGER DEFAULT 0,
  actions_failed INTEGER DEFAULT 0,
  error_message TEXT,
  execution_log JSONB DEFAULT '[]', -- [{action: 'send_email', status: 'success', timestamp: '...'}]
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Tenant users can view their executions"
  ON public.workflow_executions FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "System can manage executions"
  ON public.workflow_executions FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Index
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow ON public.workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON public.workflow_executions(status);

-- 3. Enhance notifications table
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id),
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal', -- low, normal, high, urgent
ADD COLUMN IF NOT EXISTS action_url TEXT, -- URL to navigate on click
ADD COLUMN IF NOT EXISTS action_label TEXT, -- Button label
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ, -- Auto-dismiss after
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Index for tenant notifications
CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON public.notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, read_at) WHERE read_at IS NULL;

-- 4. Create webhooks table
CREATE TABLE IF NOT EXISTS public.webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  
  -- Endpoint
  url TEXT NOT NULL,
  method TEXT DEFAULT 'POST', -- POST, PUT
  headers JSONB DEFAULT '{}', -- Custom headers
  
  -- Authentication
  auth_type TEXT, -- none, bearer, basic, api_key
  auth_token TEXT, -- Encrypted token
  
  -- Events to trigger
  events TEXT[] NOT NULL DEFAULT '{}', -- ['policy_created', 'claim_submitted']
  
  -- Retry config
  max_retries INTEGER DEFAULT 3,
  retry_delay_seconds INTEGER DEFAULT 60,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  last_status TEXT,
  failure_count INTEGER DEFAULT 0,
  
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage webhooks"
  ON public.webhooks FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Tenant users can view their webhooks"
  ON public.webhooks FOR SELECT
  USING (tenant_id = get_user_tenant_id());

-- 5. Create webhook_logs table
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
  
  -- Request
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  
  -- Response
  status_code INTEGER,
  response_body TEXT,
  response_time_ms INTEGER,
  
  -- Status
  success BOOLEAN DEFAULT false,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies (via webhook ownership)
CREATE POLICY "Admins can view webhook logs"
  ON public.webhook_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Index
CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook ON public.webhook_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created ON public.webhook_logs(created_at DESC);

-- 6. Create email_templates table
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  
  -- Template info
  name TEXT NOT NULL, -- internal name
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT, -- Plain text fallback
  
  -- Category
  category TEXT, -- transactional, marketing, notification
  
  -- Variables available in this template
  variables JSONB DEFAULT '[]', -- [{name: 'client_name', description: 'Nom du client'}]
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false, -- System templates can't be deleted
  
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(tenant_id, name)
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Tenant users can view their templates"
  ON public.email_templates FOR SELECT
  USING (tenant_id = get_user_tenant_id() OR is_system = true);

CREATE POLICY "Admins can manage templates"
  ON public.email_templates FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- 7. Create function to trigger workflows on events
CREATE OR REPLACE FUNCTION public.trigger_workflows_for_event(
  p_event_type TEXT,
  p_tenant_id UUID,
  p_event_data JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workflow RECORD;
  v_count INTEGER := 0;
BEGIN
  -- Find matching active workflows
  FOR v_workflow IN
    SELECT * FROM workflow_definitions
    WHERE is_active = true
      AND tenant_id = p_tenant_id
      AND trigger_type = 'event'
      AND trigger_event = p_event_type
    ORDER BY priority DESC
  LOOP
    -- Create execution record
    INSERT INTO workflow_executions (
      workflow_id, tenant_id, triggered_by, trigger_data, status, started_at
    ) VALUES (
      v_workflow.id, p_tenant_id, p_event_type, p_event_data, 'pending', now()
    );
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;

-- 8. Create function to create notification
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT DEFAULT NULL,
  p_kind TEXT DEFAULT 'info',
  p_priority TEXT DEFAULT 'normal',
  p_action_url TEXT DEFAULT NULL,
  p_payload JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
  v_tenant_id UUID;
BEGIN
  -- Get user's tenant
  SELECT tenant_id INTO v_tenant_id 
  FROM user_tenant_assignments 
  WHERE user_id = p_user_id 
  LIMIT 1;
  
  INSERT INTO notifications (
    user_id, tenant_id, title, message, kind, priority, action_url, payload
  ) VALUES (
    p_user_id, v_tenant_id, p_title, p_message, p_kind, p_priority, p_action_url, p_payload
  ) RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- 9. Insert default system email templates
INSERT INTO public.email_templates (name, subject, body_html, category, is_system, variables) VALUES
  ('welcome', 'Bienvenue chez {{company_name}}', 
   '<h1>Bienvenue {{client_name}} !</h1><p>Nous sommes ravis de vous compter parmi nos clients.</p>', 
   'transactional', true, 
   '[{"name": "client_name", "description": "Nom du client"}, {"name": "company_name", "description": "Nom de l''entreprise"}]'),
  ('policy_confirmation', 'Confirmation de votre contrat {{policy_number}}',
   '<h1>Votre contrat est confirmé</h1><p>Cher(e) {{client_name}}, votre contrat {{policy_number}} est maintenant actif.</p>',
   'transactional', true,
   '[{"name": "client_name", "description": "Nom du client"}, {"name": "policy_number", "description": "Numéro de police"}]'),
  ('renewal_reminder', 'Rappel: Renouvellement de votre contrat',
   '<h1>Votre contrat arrive à échéance</h1><p>Cher(e) {{client_name}}, votre contrat {{policy_number}} expire le {{end_date}}.</p>',
   'notification', true,
   '[{"name": "client_name", "description": "Nom du client"}, {"name": "policy_number", "description": "Numéro de police"}, {"name": "end_date", "description": "Date de fin"}]'),
  ('document_expiration', 'Document expirant: {{document_name}}',
   '<h1>Un document arrive à expiration</h1><p>Le document {{document_name}} expire le {{expires_at}}. Veuillez le renouveler.</p>',
   'notification', true,
   '[{"name": "document_name", "description": "Nom du document"}, {"name": "expires_at", "description": "Date d''expiration"}]')
ON CONFLICT (tenant_id, name) DO NOTHING;

-- 10. Triggers for updated_at
CREATE TRIGGER update_workflow_definitions_updated_at
  BEFORE UPDATE ON public.workflow_definitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_webhooks_updated_at
  BEFORE UPDATE ON public.webhooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
