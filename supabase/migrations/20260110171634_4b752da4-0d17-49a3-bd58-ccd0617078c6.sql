
-- 1. Create ENUM for standardized tenant status (métier)
DO $$ BEGIN
  CREATE TYPE tenant_status AS ENUM ('pending_setup', 'active', 'suspended', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Create ENUM for payment status (Stripe)
DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('trialing', 'paid', 'past_due', 'unpaid', 'canceled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. Create king_notifications table for KING-specific notifications
CREATE TABLE IF NOT EXISTS public.king_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT,
  kind TEXT NOT NULL DEFAULT 'info', -- payment_received, payment_failed, new_request, tenant_activated, upgrade_requested, error
  priority TEXT DEFAULT 'normal', -- low, normal, high, urgent
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  tenant_name TEXT,
  action_url TEXT,
  action_label TEXT,
  metadata JSONB DEFAULT '{}',
  read_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create king_audit_logs table for KING-specific audit trail
CREATE TABLE IF NOT EXISTS public.king_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL, -- tenant_activated, plan_changed, licenses_adjusted, suspended, reactivated, access_reset, user_deleted
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  tenant_name TEXT,
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Add new columns to tenants table for standardized statuses
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS tenant_status TEXT DEFAULT 'pending_setup';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'trialing';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS activated_by UUID REFERENCES auth.users(id);
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES auth.users(id);
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS mrr_amount NUMERIC(10,2) DEFAULT 0;

-- 6. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_king_notifications_read ON public.king_notifications(read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_king_notifications_kind ON public.king_notifications(kind);
CREATE INDEX IF NOT EXISTS idx_king_notifications_created ON public.king_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_king_audit_logs_tenant ON public.king_audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_king_audit_logs_created ON public.king_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenants_tenant_status ON public.tenants(tenant_status);
CREATE INDEX IF NOT EXISTS idx_tenants_payment_status ON public.tenants(payment_status);

-- 7. Enable RLS
ALTER TABLE public.king_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.king_audit_logs ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies - Only KING can access
CREATE POLICY "King can read all notifications" ON public.king_notifications
  FOR SELECT USING (public.is_king());

CREATE POLICY "King can update notifications" ON public.king_notifications
  FOR UPDATE USING (public.is_king());

CREATE POLICY "King can insert notifications" ON public.king_notifications
  FOR INSERT WITH CHECK (public.is_king() OR current_setting('request.jwt.claim.role', true) = 'service_role');

CREATE POLICY "King can read all audit logs" ON public.king_audit_logs
  FOR SELECT USING (public.is_king());

CREATE POLICY "King can insert audit logs" ON public.king_audit_logs
  FOR INSERT WITH CHECK (public.is_king() OR current_setting('request.jwt.claim.role', true) = 'service_role');

-- 9. Allow service role to insert (for edge functions)
CREATE POLICY "Service role can insert king_notifications" ON public.king_notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can insert king_audit_logs" ON public.king_audit_logs
  FOR INSERT WITH CHECK (true);

-- 10. Function to log KING actions
CREATE OR REPLACE FUNCTION public.log_king_action(
  p_action TEXT,
  p_tenant_id UUID DEFAULT NULL,
  p_tenant_name TEXT DEFAULT NULL,
  p_details JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.king_audit_logs (user_id, action, tenant_id, tenant_name, details)
  VALUES (auth.uid(), p_action, p_tenant_id, p_tenant_name, p_details)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- 11. Function to create KING notification
CREATE OR REPLACE FUNCTION public.create_king_notification(
  p_title TEXT,
  p_message TEXT DEFAULT NULL,
  p_kind TEXT DEFAULT 'info',
  p_priority TEXT DEFAULT 'normal',
  p_tenant_id UUID DEFAULT NULL,
  p_tenant_name TEXT DEFAULT NULL,
  p_action_url TEXT DEFAULT NULL,
  p_action_label TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO public.king_notifications (
    title, message, kind, priority, tenant_id, tenant_name, 
    action_url, action_label, metadata
  )
  VALUES (
    p_title, p_message, p_kind, p_priority, p_tenant_id, p_tenant_name,
    p_action_url, p_action_label, p_metadata
  )
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;
