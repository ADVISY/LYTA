
-- =====================================================
-- PHASE 4: COMMISSIONS AVANCÉES
-- =====================================================

-- 1. Create commission rules table (per product/company)
CREATE TABLE IF NOT EXISTS public.commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  company_id UUID REFERENCES public.insurance_companies(id),
  product_id UUID REFERENCES public.insurance_products(id),
  category TEXT, -- 'lca', 'vie', 'lpp', etc.
  name TEXT NOT NULL,
  description TEXT,
  
  -- Commission rates
  base_rate NUMERIC NOT NULL DEFAULT 0, -- Base rate in %
  acquisition_rate NUMERIC DEFAULT 0, -- First year rate
  renewal_rate NUMERIC DEFAULT 0, -- Renewal rate
  
  -- Calculation basis
  calculation_basis TEXT DEFAULT 'yearly_premium', -- yearly_premium, monthly_premium, sum_insured
  
  -- Validity
  valid_from DATE,
  valid_to DATE,
  is_active BOOLEAN DEFAULT true,
  
  -- Priority (higher = checked first)
  priority INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Tenant users can view their rules"
  ON public.commission_rules FOR SELECT
  USING (tenant_id = get_user_tenant_id() OR tenant_id IS NULL);

CREATE POLICY "Admins can manage rules"
  ON public.commission_rules FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_commission_rules_company ON public.commission_rules(company_id);
CREATE INDEX IF NOT EXISTS idx_commission_rules_product ON public.commission_rules(product_id);
CREATE INDEX IF NOT EXISTS idx_commission_rules_category ON public.commission_rules(category);
CREATE INDEX IF NOT EXISTS idx_commission_rules_active ON public.commission_rules(is_active) WHERE is_active = true;

-- 2. Create commission tiers table (performance-based bonuses)
CREATE TABLE IF NOT EXISTS public.commission_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  
  -- Thresholds
  min_contracts INTEGER DEFAULT 0, -- Min contracts per period
  max_contracts INTEGER, -- NULL = unlimited
  min_premium NUMERIC DEFAULT 0, -- Min premium per period
  max_premium NUMERIC, -- NULL = unlimited
  
  -- Bonus
  bonus_rate NUMERIC NOT NULL DEFAULT 0, -- Additional % on top of base
  bonus_type TEXT DEFAULT 'percentage', -- percentage, fixed_amount
  bonus_amount NUMERIC DEFAULT 0, -- For fixed amount bonuses
  
  -- Period
  period_type TEXT DEFAULT 'monthly', -- monthly, quarterly, yearly
  
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.commission_tiers ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Tenant users can view their tiers"
  ON public.commission_tiers FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can manage tiers"
  ON public.commission_tiers FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- 3. Create retrocommissions (clawback) table
CREATE TABLE IF NOT EXISTS public.retrocommissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  commission_id UUID REFERENCES public.commissions(id),
  policy_id UUID REFERENCES public.policies(id),
  agent_id UUID REFERENCES public.clients(id),
  
  -- Original commission info
  original_amount NUMERIC NOT NULL,
  original_date DATE NOT NULL,
  
  -- Clawback info
  clawback_amount NUMERIC NOT NULL,
  clawback_reason TEXT NOT NULL, -- cancellation, lapse, early_termination
  clawback_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Proration
  months_active INTEGER, -- How many months the policy was active
  proration_rate NUMERIC, -- % of commission to claw back
  
  -- Status
  status TEXT DEFAULT 'pending', -- pending, applied, waived
  applied_at TIMESTAMPTZ,
  waived_by UUID REFERENCES public.profiles(id),
  waived_at TIMESTAMPTZ,
  waived_reason TEXT,
  
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.retrocommissions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admin and compta can manage retrocommissions"
  ON public.retrocommissions FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'compta'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'compta'));

CREATE POLICY "Agents can view their own retrocommissions"
  ON public.retrocommissions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM clients c WHERE c.id = retrocommissions.agent_id AND c.user_id = auth.uid()
  ));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_retrocommissions_agent ON public.retrocommissions(agent_id);
CREATE INDEX IF NOT EXISTS idx_retrocommissions_policy ON public.retrocommissions(policy_id);
CREATE INDEX IF NOT EXISTS idx_retrocommissions_status ON public.retrocommissions(status);

-- 4. Create reserve accounts table (compte de réserve per agent)
CREATE TABLE IF NOT EXISTS public.reserve_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  agent_id UUID NOT NULL REFERENCES public.clients(id),
  
  -- Balance
  current_balance NUMERIC NOT NULL DEFAULT 0,
  
  -- Rates from agent profile (cached for history)
  reserve_rate NUMERIC NOT NULL DEFAULT 0, -- % of commission held in reserve
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(tenant_id, agent_id)
);

-- Enable RLS
ALTER TABLE public.reserve_accounts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admin and compta can manage reserve accounts"
  ON public.reserve_accounts FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'compta'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'compta'));

CREATE POLICY "Agents can view their own reserve account"
  ON public.reserve_accounts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM clients c WHERE c.id = reserve_accounts.agent_id AND c.user_id = auth.uid()
  ));

-- 5. Create reserve transactions table
CREATE TABLE IF NOT EXISTS public.reserve_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reserve_account_id UUID NOT NULL REFERENCES public.reserve_accounts(id),
  commission_id UUID REFERENCES public.commissions(id),
  retrocommission_id UUID REFERENCES public.retrocommissions(id),
  
  -- Transaction details
  type TEXT NOT NULL, -- deposit, withdrawal, clawback_deduction, release
  amount NUMERIC NOT NULL,
  balance_after NUMERIC NOT NULL,
  
  description TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reserve_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admin and compta can manage reserve transactions"
  ON public.reserve_transactions FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'compta'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'compta'));

CREATE POLICY "Agents can view their own reserve transactions"
  ON public.reserve_transactions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM reserve_accounts ra
    JOIN clients c ON c.id = ra.agent_id
    WHERE ra.id = reserve_transactions.reserve_account_id AND c.user_id = auth.uid()
  ));

-- Index
CREATE INDEX IF NOT EXISTS idx_reserve_transactions_account ON public.reserve_transactions(reserve_account_id);

-- 6. Function to calculate commission with rules
CREATE OR REPLACE FUNCTION public.calculate_commission_with_rules(
  p_policy_id UUID,
  p_is_renewal BOOLEAN DEFAULT false
)
RETURNS TABLE (
  rule_id UUID,
  rule_name TEXT,
  base_amount NUMERIC,
  rate NUMERIC,
  commission_amount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy RECORD;
  v_rule RECORD;
  v_base NUMERIC;
BEGIN
  -- Get policy details
  SELECT p.*, ip.category, ip.company_id
  INTO v_policy
  FROM policies p
  JOIN insurance_products ip ON p.product_id = ip.id
  WHERE p.id = p_policy_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Find matching rule (most specific first)
  SELECT * INTO v_rule
  FROM commission_rules cr
  WHERE cr.is_active = true
    AND (cr.tenant_id = v_policy.tenant_id OR cr.tenant_id IS NULL)
    AND (cr.product_id = v_policy.product_id OR cr.product_id IS NULL)
    AND (cr.company_id = v_policy.company_id OR cr.company_id IS NULL)
    AND (cr.category = v_policy.category OR cr.category IS NULL)
    AND (cr.valid_from IS NULL OR cr.valid_from <= CURRENT_DATE)
    AND (cr.valid_to IS NULL OR cr.valid_to >= CURRENT_DATE)
  ORDER BY 
    CASE WHEN cr.product_id IS NOT NULL THEN 1 ELSE 0 END DESC,
    CASE WHEN cr.company_id IS NOT NULL THEN 1 ELSE 0 END DESC,
    CASE WHEN cr.category IS NOT NULL THEN 1 ELSE 0 END DESC,
    cr.priority DESC
  LIMIT 1;
  
  -- Calculate base amount
  v_base := CASE v_rule.calculation_basis
    WHEN 'monthly_premium' THEN COALESCE(v_policy.premium_monthly, 0)
    WHEN 'yearly_premium' THEN COALESCE(v_policy.premium_yearly, v_policy.premium_monthly * 12, 0)
    ELSE COALESCE(v_policy.premium_yearly, 0)
  END;
  
  -- Return result
  IF v_rule IS NOT NULL THEN
    RETURN QUERY SELECT
      v_rule.id AS rule_id,
      v_rule.name AS rule_name,
      v_base AS base_amount,
      CASE WHEN p_is_renewal THEN v_rule.renewal_rate ELSE COALESCE(v_rule.acquisition_rate, v_rule.base_rate) END AS rate,
      v_base * CASE WHEN p_is_renewal THEN v_rule.renewal_rate ELSE COALESCE(v_rule.acquisition_rate, v_rule.base_rate) END / 100 AS commission_amount;
  END IF;
END;
$$;

-- 7. Function to apply retrocommission
CREATE OR REPLACE FUNCTION public.apply_retrocommission(p_retrocommission_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_retro RECORD;
  v_reserve RECORD;
  v_new_balance NUMERIC;
BEGIN
  -- Get retrocommission
  SELECT * INTO v_retro FROM retrocommissions WHERE id = p_retrocommission_id;
  
  IF NOT FOUND OR v_retro.status != 'pending' THEN
    RETURN false;
  END IF;
  
  -- Get or create reserve account
  SELECT * INTO v_reserve 
  FROM reserve_accounts 
  WHERE agent_id = v_retro.agent_id;
  
  IF NOT FOUND THEN
    INSERT INTO reserve_accounts (tenant_id, agent_id, current_balance, reserve_rate)
    SELECT v_retro.tenant_id, v_retro.agent_id, 0, COALESCE(c.reserve_rate, 0)
    FROM clients c WHERE c.id = v_retro.agent_id
    RETURNING * INTO v_reserve;
  END IF;
  
  -- Calculate new balance (deduct from reserve)
  v_new_balance := v_reserve.current_balance - v_retro.clawback_amount;
  
  -- Update reserve account
  UPDATE reserve_accounts 
  SET current_balance = v_new_balance, updated_at = now()
  WHERE id = v_reserve.id;
  
  -- Record transaction
  INSERT INTO reserve_transactions (
    reserve_account_id, retrocommission_id, type, amount, balance_after, description
  ) VALUES (
    v_reserve.id, p_retrocommission_id, 'clawback_deduction', 
    -v_retro.clawback_amount, v_new_balance,
    'Rétrocommission: ' || v_retro.clawback_reason
  );
  
  -- Update retrocommission status
  UPDATE retrocommissions 
  SET status = 'applied', applied_at = now(), updated_at = now()
  WHERE id = p_retrocommission_id;
  
  RETURN true;
END;
$$;

-- 8. Triggers for updated_at
CREATE TRIGGER update_commission_rules_updated_at
  BEFORE UPDATE ON public.commission_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_commission_tiers_updated_at
  BEFORE UPDATE ON public.commission_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_retrocommissions_updated_at
  BEFORE UPDATE ON public.retrocommissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reserve_accounts_updated_at
  BEFORE UPDATE ON public.reserve_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
