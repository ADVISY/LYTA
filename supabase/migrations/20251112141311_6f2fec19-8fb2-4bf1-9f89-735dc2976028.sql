-- Create contracts table for insurance policies
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  contract_type TEXT NOT NULL CHECK (contract_type IN ('auto', 'menage', 'sante', 'vie', '3e_pilier', 'juridique', 'hypotheque')),
  company TEXT NOT NULL,
  monthly_premium DECIMAL(10,2) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'cancelled', 'expired')),
  policy_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- Clients can view their own contracts
CREATE POLICY "Users can view their own contracts"
  ON public.contracts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Clients can insert their own contracts
CREATE POLICY "Users can create their own contracts"
  ON public.contracts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Clients can update their own contracts
CREATE POLICY "Users can update their own contracts"
  ON public.contracts
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Partners and admins can view all contracts
CREATE POLICY "Partners can view all contracts"
  ON public.contracts
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'partner') OR 
    public.has_role(auth.uid(), 'admin')
  );

-- Trigger for updated_at
CREATE TRIGGER on_contracts_updated
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create commissions table for partners
CREATE TABLE public.commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  commission_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

-- Partners can view their own commissions
CREATE POLICY "Partners can view their own commissions"
  ON public.commissions
  FOR SELECT
  USING (
    auth.uid() = partner_id OR
    public.has_role(auth.uid(), 'admin')
  );

-- Only admins can create/update commissions
CREATE POLICY "Admins can manage commissions"
  ON public.commissions
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER on_commissions_updated
  BEFORE UPDATE ON public.commissions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();