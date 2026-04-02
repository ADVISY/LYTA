-- Add IBAN fields to tenant_branding for QR invoices
ALTER TABLE public.tenant_branding 
ADD COLUMN IF NOT EXISTS iban text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS qr_iban text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS vat_number text DEFAULT NULL;

-- Create QR invoices table
CREATE TABLE public.qr_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  
  -- Client info (can be linked or manual)
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  client_address text,
  client_postal_code text,
  client_city text,
  client_country text DEFAULT 'CH',
  client_email text,
  
  -- Service/prestation
  service_type text NOT NULL,
  service_description text,
  
  -- Amounts
  amount_ht numeric(12,2) NOT NULL DEFAULT 0,
  vat_rate numeric(5,2) DEFAULT 7.7,
  vat_amount numeric(12,2) DEFAULT 0,
  amount_ttc numeric(12,2) NOT NULL DEFAULT 0,
  is_vat_included boolean DEFAULT false,
  
  -- Invoice details
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  location text,
  object text,
  notes text,
  
  -- Status
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'sent', 'paid', 'overdue', 'cancelled')),
  
  -- PDF storage
  pdf_path text,
  pdf_url text,
  
  -- Audit
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  generated_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE
);

-- Create unique invoice number per tenant
CREATE UNIQUE INDEX idx_qr_invoices_tenant_number ON public.qr_invoices(tenant_id, invoice_number);

-- Enable RLS
ALTER TABLE public.qr_invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies for qr_invoices
CREATE POLICY "Users can view invoices from their tenant" 
ON public.qr_invoices 
FOR SELECT 
USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Users can create invoices for their tenant" 
ON public.qr_invoices 
FOR INSERT 
WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Users can update invoices from their tenant" 
ON public.qr_invoices 
FOR UPDATE 
USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Users can delete invoices from their tenant" 
ON public.qr_invoices 
FOR DELETE 
USING (tenant_id = public.get_user_tenant_id());

-- King can see all
CREATE POLICY "King can view all invoices" 
ON public.qr_invoices 
FOR ALL 
USING (public.is_king());

-- Create updated_at trigger
CREATE TRIGGER update_qr_invoices_updated_at
BEFORE UPDATE ON public.qr_invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Audit log table for invoice actions
CREATE TABLE public.qr_invoice_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.qr_invoices(id) ON DELETE CASCADE,
  action text NOT NULL,
  performed_by UUID REFERENCES auth.users(id),
  performed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  details jsonb DEFAULT '{}'
);

-- Enable RLS on logs
ALTER TABLE public.qr_invoice_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view invoice logs from their tenant" 
ON public.qr_invoice_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.qr_invoices i 
    WHERE i.id = invoice_id 
    AND i.tenant_id = public.get_user_tenant_id()
  )
);

CREATE POLICY "Users can create invoice logs" 
ON public.qr_invoice_logs 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.qr_invoices i 
    WHERE i.id = invoice_id 
    AND i.tenant_id = public.get_user_tenant_id()
  )
);

-- Function to get next invoice number
CREATE OR REPLACE FUNCTION public.get_next_invoice_number(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year text;
  v_count integer;
  v_number text;
BEGIN
  v_year := to_char(CURRENT_DATE, 'YYYY');
  
  SELECT COUNT(*) + 1 INTO v_count
  FROM public.qr_invoices
  WHERE tenant_id = p_tenant_id
  AND invoice_number LIKE 'FAC-' || v_year || '-%';
  
  v_number := 'FAC-' || v_year || '-' || LPAD(v_count::text, 4, '0');
  
  RETURN v_number;
END;
$$;