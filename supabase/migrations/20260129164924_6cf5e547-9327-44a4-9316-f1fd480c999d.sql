-- =============================================
-- MODULE AFFILIATION KING LYTA
-- =============================================

-- 1. Table des affiliés
CREATE TABLE public.affiliates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00 CHECK (commission_rate >= 0 AND commission_rate <= 100),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on affiliates
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

-- RLS policies for affiliates (only KING users can access using has_role function)
CREATE POLICY "KING can view all affiliates"
  ON public.affiliates FOR SELECT
  USING (public.has_role(auth.uid(), 'king'::app_role));

CREATE POLICY "KING can insert affiliates"
  ON public.affiliates FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'king'::app_role));

CREATE POLICY "KING can update affiliates"
  ON public.affiliates FOR UPDATE
  USING (public.has_role(auth.uid(), 'king'::app_role));

CREATE POLICY "KING can delete affiliates"
  ON public.affiliates FOR DELETE
  USING (public.has_role(auth.uid(), 'king'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_affiliates_updated_at
  BEFORE UPDATE ON public.affiliates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Add affiliate columns to tenants table
ALTER TABLE public.tenants 
  ADD COLUMN IF NOT EXISTS affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS affiliate_commission_rate NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS affiliate_linked_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS affiliate_eligibility_end TIMESTAMP WITH TIME ZONE;

-- Index for affiliate lookups
CREATE INDEX IF NOT EXISTS idx_tenants_affiliate_id ON public.tenants(affiliate_id);

-- 3. Table des commissions affiliés
CREATE TABLE public.affiliate_commissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  payment_id TEXT NOT NULL UNIQUE,
  payment_amount NUMERIC(10,2) NOT NULL,
  commission_rate NUMERIC(5,2) NOT NULL,
  commission_amount NUMERIC(10,2) NOT NULL,
  payment_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'due' CHECK (status IN ('due', 'paid', 'cancelled')),
  paid_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on affiliate_commissions
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;

-- RLS policies for affiliate_commissions
CREATE POLICY "KING can view all affiliate commissions"
  ON public.affiliate_commissions FOR SELECT
  USING (public.has_role(auth.uid(), 'king'::app_role));

CREATE POLICY "KING can insert affiliate commissions"
  ON public.affiliate_commissions FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'king'::app_role));

CREATE POLICY "KING can update affiliate commissions"
  ON public.affiliate_commissions FOR UPDATE
  USING (public.has_role(auth.uid(), 'king'::app_role));

CREATE POLICY "KING can delete affiliate commissions"
  ON public.affiliate_commissions FOR DELETE
  USING (public.has_role(auth.uid(), 'king'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_affiliate_commissions_updated_at
  BEFORE UPDATE ON public.affiliate_commissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_affiliate_id ON public.affiliate_commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_tenant_id ON public.affiliate_commissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_status ON public.affiliate_commissions(status);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_payment_date ON public.affiliate_commissions(payment_date);

-- 4. Function to check if tenant is still eligible for affiliate commission
CREATE OR REPLACE FUNCTION public.is_tenant_affiliate_eligible(p_tenant_id UUID, p_payment_date TIMESTAMP WITH TIME ZONE)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_affiliate_id UUID;
  v_eligibility_end TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT affiliate_id, affiliate_eligibility_end 
  INTO v_affiliate_id, v_eligibility_end
  FROM tenants 
  WHERE id = p_tenant_id;
  
  IF v_affiliate_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  IF v_eligibility_end IS NULL OR p_payment_date > v_eligibility_end THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- 5. Function to generate affiliate commission
CREATE OR REPLACE FUNCTION public.generate_affiliate_commission(
  p_tenant_id UUID,
  p_payment_id TEXT,
  p_payment_amount NUMERIC,
  p_payment_date TIMESTAMP WITH TIME ZONE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_affiliate_id UUID;
  v_commission_rate NUMERIC;
  v_commission_amount NUMERIC;
  v_commission_id UUID;
  v_existing_id UUID;
BEGIN
  SELECT id INTO v_existing_id FROM affiliate_commissions WHERE payment_id = p_payment_id;
  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  IF NOT is_tenant_affiliate_eligible(p_tenant_id, p_payment_date) THEN
    RETURN NULL;
  END IF;

  SELECT affiliate_id, affiliate_commission_rate 
  INTO v_affiliate_id, v_commission_rate
  FROM tenants 
  WHERE id = p_tenant_id;

  v_commission_amount := ROUND(p_payment_amount * (v_commission_rate / 100), 2);

  INSERT INTO affiliate_commissions (
    affiliate_id, tenant_id, payment_id, payment_amount, commission_rate, commission_amount, payment_date, status
  ) VALUES (
    v_affiliate_id, p_tenant_id, p_payment_id, p_payment_amount, v_commission_rate, v_commission_amount, p_payment_date, 'due'
  ) RETURNING id INTO v_commission_id;

  RETURN v_commission_id;
END;
$$;