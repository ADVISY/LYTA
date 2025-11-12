-- ============================================
-- ADVISY CRM 2.0 - DATABASE SCHEMA (FIXED)
-- ============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS citext;

-- Drop existing contracts and commissions tables (old structure)
DROP TABLE IF EXISTS public.commissions CASCADE;
DROP TABLE IF EXISTS public.contracts CASCADE;

-- ============================================
-- REFERENCE TABLES
-- ============================================

-- Insurance companies reference table
CREATE TABLE public.insurance_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insurance products reference table
CREATE TABLE public.insurance_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.insurance_companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('auto','home','health','life','rcpro','multirisque','legal','third_pillar')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, name)
);

CREATE INDEX idx_products_company ON public.insurance_products(company_id);
CREATE INDEX idx_products_category ON public.insurance_products(category);

-- ============================================
-- ACTORS (PARTNERS & CLIENTS)
-- ============================================

-- Partners (agents/brokers)
CREATE TABLE public.partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT UNIQUE,
  manager_partner_id UUID REFERENCES public.partners(id),
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_partners_manager ON public.partners(manager_partner_id);

-- Clients
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  external_ref TEXT,
  birthdate DATE,
  company_name TEXT,
  is_company BOOLEAN DEFAULT FALSE,
  phone TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'CH',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clients_company ON public.clients(is_company);
CREATE INDEX idx_clients_user ON public.clients(user_id);

-- ============================================
-- INSURANCE MANAGEMENT
-- ============================================

-- Policies (polices d'assurance)
CREATE TABLE public.policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.insurance_products(id),
  partner_id UUID REFERENCES public.partners(id),
  policy_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active','pending','suspended','cancelled','expired')),
  start_date DATE NOT NULL,
  end_date DATE,
  premium_monthly NUMERIC(12,2),
  premium_yearly NUMERIC(12,2),
  deductible NUMERIC(12,2),
  currency TEXT NOT NULL DEFAULT 'CHF',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_policies_client ON public.policies(client_id);
CREATE INDEX idx_policies_partner ON public.policies(partner_id);
CREATE INDEX idx_policies_status ON public.policies(status);
CREATE INDEX idx_policies_dates ON public.policies(start_date, end_date);

-- Contracts (NEW STRUCTURE - signatures/documents contractuels)
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES public.policies(id) ON DELETE CASCADE,
  signature_status TEXT NOT NULL DEFAULT 'pending' CHECK (signature_status IN ('signed','pending','refused')),
  signature_provider TEXT,
  signed_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  renewal_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contracts_policy ON public.contracts(policy_id);
CREATE INDEX idx_contracts_status ON public.contracts(signature_status);

-- Commissions (NEW STRUCTURE)
CREATE TABLE public.commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES public.policies(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES public.partners(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'due' CHECK (status IN ('paid','due','pending')),
  period_month INT CHECK (period_month BETWEEN 1 AND 12),
  period_year INT CHECK (period_year BETWEEN 2000 AND 2100),
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_commissions_partner ON public.commissions(partner_id, status);
CREATE INDEX idx_commissions_policy ON public.commissions(policy_id);
CREATE INDEX idx_commissions_period ON public.commissions(period_year, period_month);

-- ============================================
-- DOCUMENTS & COMMUNICATION
-- ============================================

-- Documents
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('client','policy','contract','partner')),
  owner_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_key TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  doc_kind TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_owner ON public.documents(owner_type, owner_id);
CREATE INDEX idx_documents_kind ON public.documents(doc_kind);

-- Messages (chat/conversation)
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_key TEXT NOT NULL,
  sender_user_id UUID REFERENCES auth.users(id),
  body TEXT,
  has_attachments BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_thread ON public.messages(thread_key, created_at);
CREATE INDEX idx_messages_sender ON public.messages(sender_user_id);

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  payload JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id, read_at);
CREATE INDEX idx_notifications_kind ON public.notifications(kind);

-- Audit logs
CREATE TABLE public.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity TEXT,
  entity_id UUID,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_entity ON public.audit_logs(entity, entity_id);
CREATE INDEX idx_audit_user ON public.audit_logs(user_id, created_at);
CREATE INDEX idx_audit_action ON public.audit_logs(action);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

CREATE TRIGGER update_partners_updated_at
  BEFORE UPDATE ON public.partners
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_policies_updated_at
  BEFORE UPDATE ON public.policies
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_commissions_updated_at
  BEFORE UPDATE ON public.commissions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Insurance companies (public read)
ALTER TABLE public.insurance_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view insurance companies"
  ON public.insurance_companies FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage insurance companies"
  ON public.insurance_companies FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Insurance products (public read)
ALTER TABLE public.insurance_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view insurance products"
  ON public.insurance_products FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage insurance products"
  ON public.insurance_products FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Partners
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own partner profile"
  ON public.partners FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Partners can update their own profile"
  ON public.partners FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all partners"
  ON public.partners FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own client profile"
  ON public.clients FOR SELECT
  USING (
    auth.uid() = user_id 
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'partner')
  );

CREATE POLICY "Clients can update their own profile"
  ON public.clients FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Partners and admins can create clients"
  ON public.clients FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'partner')
  );

CREATE POLICY "Admins can manage all clients"
  ON public.clients FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Policies
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view their own policies"
  ON public.policies FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.clients WHERE id = policies.client_id AND user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.partners WHERE id = policies.partner_id AND user_id = auth.uid())
  );

CREATE POLICY "Partners can create policies for their clients"
  ON public.policies FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.partners WHERE id = policies.partner_id AND user_id = auth.uid())
  );

CREATE POLICY "Partners can update their policies"
  ON public.policies FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.partners WHERE id = policies.partner_id AND user_id = auth.uid())
  );

CREATE POLICY "Admins can manage all policies"
  ON public.policies FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Contracts
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view contracts for their policies"
  ON public.contracts FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.policies p
      JOIN public.clients c ON p.client_id = c.id
      WHERE p.id = contracts.policy_id AND c.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.policies p
      JOIN public.partners pt ON p.partner_id = pt.id
      WHERE p.id = contracts.policy_id AND pt.user_id = auth.uid()
    )
  );

CREATE POLICY "Partners can manage contracts"
  ON public.contracts FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.policies p
      JOIN public.partners pt ON p.partner_id = pt.id
      WHERE p.id = contracts.policy_id AND pt.user_id = auth.uid()
    )
  );

-- Commissions
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners can view their own commissions"
  ON public.commissions FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.partners WHERE id = commissions.partner_id AND user_id = auth.uid())
  );

CREATE POLICY "Admins can manage all commissions"
  ON public.commissions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own documents"
  ON public.documents FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR created_by = auth.uid()
    OR (owner_type = 'client' AND EXISTS (SELECT 1 FROM public.clients WHERE id = documents.owner_id AND user_id = auth.uid()))
    OR (owner_type = 'policy' AND EXISTS (
      SELECT 1 FROM public.policies p
      JOIN public.clients c ON p.client_id = c.id
      WHERE p.id = documents.owner_id AND c.user_id = auth.uid()
    ))
    OR (owner_type = 'policy' AND EXISTS (
      SELECT 1 FROM public.policies p
      JOIN public.partners pt ON p.partner_id = pt.id
      WHERE p.id = documents.owner_id AND pt.user_id = auth.uid()
    ))
    OR (owner_type = 'partner' AND EXISTS (SELECT 1 FROM public.partners WHERE id = documents.owner_id AND user_id = auth.uid()))
  );

CREATE POLICY "Users can create documents"
  ON public.documents FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'partner')
    OR created_by = auth.uid()
  );

CREATE POLICY "Admins can manage all documents"
  ON public.documents FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in their threads"
  ON public.messages FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR sender_user_id = auth.uid()
    OR thread_key LIKE '%' || auth.uid()::text || '%'
  );

CREATE POLICY "Users can create messages"
  ON public.messages FOR INSERT
  WITH CHECK (sender_user_id = auth.uid());

-- Notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- Audit logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can create audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (true);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to create audit log
CREATE OR REPLACE FUNCTION public.create_audit_log(
  p_user_id UUID,
  p_action TEXT,
  p_entity TEXT,
  p_entity_id UUID,
  p_metadata JSONB DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id BIGINT;
BEGIN
  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
  VALUES (p_user_id, p_action, p_entity, p_entity_id, p_metadata)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- Function to get partner policies
CREATE OR REPLACE FUNCTION public.get_partner_policies(
  p_partner_id UUID,
  p_status TEXT DEFAULT NULL,
  p_limit INT DEFAULT 25,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  client_id UUID,
  client_name TEXT,
  product_id UUID,
  product_name TEXT,
  company_name TEXT,
  policy_number TEXT,
  status TEXT,
  start_date DATE,
  end_date DATE,
  premium_monthly NUMERIC,
  premium_yearly NUMERIC,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    c.id AS client_id,
    COALESCE(c.company_name, pr.full_name) AS client_name,
    prod.id AS product_id,
    prod.name AS product_name,
    ic.name AS company_name,
    p.policy_number,
    p.status,
    p.start_date,
    p.end_date,
    p.premium_monthly,
    p.premium_yearly,
    p.created_at
  FROM public.policies p
  JOIN public.clients c ON p.client_id = c.id
  LEFT JOIN public.profiles pr ON c.user_id = pr.id
  JOIN public.insurance_products prod ON p.product_id = prod.id
  JOIN public.insurance_companies ic ON prod.company_id = ic.id
  WHERE p.partner_id = p_partner_id
    AND (p_status IS NULL OR p.status = p_status)
  ORDER BY p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;