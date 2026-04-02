-- =====================================================
-- D) COMMISSIONS / DÉCOMPTES / PAYOUTS
-- =====================================================

-- Enum for commission status
DO $$ BEGIN
  CREATE TYPE commission_status AS ENUM ('estimated', 'confirmed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Enum for decompte status
DO $$ BEGIN
  CREATE TYPE decompte_status AS ENUM ('draft', 'validated', 'paid', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Enum for payout status
DO $$ BEGIN
  CREATE TYPE payout_status AS ENUM ('pending', 'paid', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- COMMISSION HISTORY (audit trail)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.commission_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id UUID NOT NULL REFERENCES public.commissions(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES public.profiles(id),
  change_type TEXT NOT NULL, -- 'rate_change', 'amount_correction', 'status_change', 'note_added'
  old_value JSONB,
  new_value JSONB,
  note TEXT NOT NULL, -- Mandatory note for corrections
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_commission_history_commission ON public.commission_history(commission_id);
CREATE INDEX IF NOT EXISTS idx_commission_history_changed_by ON public.commission_history(changed_by);

-- =====================================================
-- DÉCOMPTES (Statements)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.decomptes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  agent_id UUID REFERENCES public.clients(id), -- The collaborator/agent
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_commissions NUMERIC NOT NULL DEFAULT 0,
  total_decommissions NUMERIC NOT NULL DEFAULT 0,
  total_net NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, validated, paid, cancelled
  validated_by UUID REFERENCES public.profiles(id),
  validated_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_decomptes_tenant ON public.decomptes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_decomptes_agent ON public.decomptes(agent_id);
CREATE INDEX IF NOT EXISTS idx_decomptes_period ON public.decomptes(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_decomptes_status ON public.decomptes(status);

-- =====================================================
-- DECOMPTE LINES (detail lines for each statement)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.decompte_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decompte_id UUID NOT NULL REFERENCES public.decomptes(id) ON DELETE CASCADE,
  commission_id UUID REFERENCES public.commissions(id),
  policy_id UUID REFERENCES public.policies(id),
  client_name TEXT,
  product_name TEXT,
  company_name TEXT,
  contract_date DATE,
  base_amount NUMERIC NOT NULL DEFAULT 0, -- Base for calculation (premium)
  commission_rate NUMERIC NOT NULL DEFAULT 0,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  decommission_amount NUMERIC NOT NULL DEFAULT 0, -- Rétrocession/split
  net_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decompte_lines_decompte ON public.decompte_lines(decompte_id);

-- =====================================================
-- PAYOUTS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  agent_id UUID NOT NULL REFERENCES public.clients(id), -- Who receives the payout
  decompte_id UUID REFERENCES public.decomptes(id), -- Optional link to statement
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, cancelled
  payment_date DATE,
  payment_reference TEXT, -- Bank reference / proof
  payment_method TEXT, -- bank_transfer, cash, check
  validated_by UUID REFERENCES public.profiles(id),
  validated_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES public.profiles(id),
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payouts_tenant ON public.payouts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payouts_agent ON public.payouts(agent_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON public.payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_decompte ON public.payouts(decompte_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS
ALTER TABLE public.commission_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decomptes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decompte_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- COMMISSION HISTORY POLICIES
-- =====================================================
-- Only admin/compta can view history
CREATE POLICY "Admin and compta can view commission history"
ON public.commission_history FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'compta'::app_role)
);

-- Admin/compta can create history entries
CREATE POLICY "Admin and compta can create commission history"
ON public.commission_history FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'compta'::app_role)
);

-- =====================================================
-- DECOMPTES POLICIES
-- =====================================================
-- Admin/compta can manage all
CREATE POLICY "Admin and compta can manage decomptes"
ON public.decomptes FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'compta'::app_role)
);

-- Agents can view their own decomptes (without sensitive global data)
CREATE POLICY "Agents can view their own decomptes"
ON public.decomptes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.clients c 
    WHERE c.id = decomptes.agent_id 
    AND c.user_id = auth.uid()
  )
);

-- Managers can view team decomptes
CREATE POLICY "Managers can view team decomptes"
ON public.decomptes FOR SELECT
USING (
  has_role(auth.uid(), 'manager'::app_role) AND
  EXISTS (
    SELECT 1 FROM public.clients agent
    JOIN public.clients manager ON agent.manager_id = manager.id
    WHERE agent.id = decomptes.agent_id 
    AND manager.user_id = auth.uid()
  )
);

-- =====================================================
-- DECOMPTE LINES POLICIES
-- =====================================================
-- Admin/compta can manage all lines
CREATE POLICY "Admin and compta can manage decompte lines"
ON public.decompte_lines FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'compta'::app_role)
);

-- Users can view lines for their accessible decomptes
CREATE POLICY "Users can view their decompte lines"
ON public.decompte_lines FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.decomptes d
    JOIN public.clients c ON d.agent_id = c.id
    WHERE d.id = decompte_lines.decompte_id
    AND c.user_id = auth.uid()
  )
);

-- =====================================================
-- PAYOUTS POLICIES
-- =====================================================
-- Admin/compta can manage all payouts
CREATE POLICY "Admin and compta can manage payouts"
ON public.payouts FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'compta'::app_role)
);

-- Agents can view their own payouts
CREATE POLICY "Agents can view their own payouts"
ON public.payouts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.clients c 
    WHERE c.id = payouts.agent_id 
    AND c.user_id = auth.uid()
  )
);

-- Managers can view team payouts
CREATE POLICY "Managers can view team payouts"
ON public.payouts FOR SELECT
USING (
  has_role(auth.uid(), 'manager'::app_role) AND
  EXISTS (
    SELECT 1 FROM public.clients agent
    JOIN public.clients manager ON agent.manager_id = manager.id
    WHERE agent.id = payouts.agent_id 
    AND manager.user_id = auth.uid()
  )
);

-- Back-office CANNOT see financial data (no policies for them)

-- =====================================================
-- UPDATED_AT TRIGGERS
-- =====================================================
CREATE TRIGGER update_decomptes_updated_at
  BEFORE UPDATE ON public.decomptes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payouts_updated_at
  BEFORE UPDATE ON public.payouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- FUNCTION: Calculate commission for a policy
-- =====================================================
CREATE OR REPLACE FUNCTION public.calculate_policy_commission(
  p_policy_id UUID,
  p_agent_id UUID DEFAULT NULL
)
RETURNS TABLE (
  base_amount NUMERIC,
  commission_type TEXT,
  agent_rate NUMERIC,
  agent_amount NUMERIC,
  manager_id UUID,
  manager_rate NUMERIC,
  manager_amount NUMERIC,
  total_commission NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy RECORD;
  v_agent RECORD;
  v_manager RECORD;
  v_base NUMERIC;
  v_type TEXT;
  v_agent_rate NUMERIC;
  v_manager_rate NUMERIC;
BEGIN
  -- Get policy details
  SELECT p.*, ip.category
  INTO v_policy
  FROM policies p
  LEFT JOIN insurance_products ip ON p.product_id = ip.id
  WHERE p.id = p_policy_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Determine base amount and type
  IF v_policy.category IN ('life', 'lpp') THEN
    v_base := COALESCE(v_policy.premium_yearly, v_policy.premium_monthly * 12, 0);
    v_type := 'vie';
  ELSE
    v_base := COALESCE(v_policy.premium_yearly, v_policy.premium_monthly * 12, 0);
    v_type := 'lca';
  END IF;
  
  -- Get agent if specified, otherwise use assigned agent
  IF p_agent_id IS NOT NULL THEN
    SELECT * INTO v_agent FROM clients WHERE id = p_agent_id;
  ELSE
    SELECT c.* INTO v_agent 
    FROM clients c
    JOIN policies pol ON pol.client_id = c.id OR c.id = (
      SELECT assigned_agent_id FROM clients WHERE id = pol.client_id
    )
    WHERE pol.id = p_policy_id
    LIMIT 1;
  END IF;
  
  -- Get rates from agent
  IF v_type = 'vie' THEN
    v_agent_rate := COALESCE(v_agent.commission_rate_vie, 4);
    v_manager_rate := COALESCE(v_agent.manager_commission_rate_vie, 1);
  ELSE
    v_agent_rate := COALESCE(v_agent.commission_rate_lca, 16);
    v_manager_rate := COALESCE(v_agent.manager_commission_rate_lca, 2);
  END IF;
  
  -- Get manager
  IF v_agent.manager_id IS NOT NULL THEN
    SELECT * INTO v_manager FROM clients WHERE id = v_agent.manager_id;
  END IF;
  
  -- Return calculation
  RETURN QUERY SELECT
    v_base AS base_amount,
    v_type AS commission_type,
    v_agent_rate AS agent_rate,
    (v_base * v_agent_rate / 100) AS agent_amount,
    v_agent.manager_id AS manager_id,
    v_manager_rate AS manager_rate,
    (v_base * v_manager_rate / 100) AS manager_amount,
    (v_base * (v_agent_rate + v_manager_rate) / 100) AS total_commission;
END;
$$;