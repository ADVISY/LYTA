-- Create claims table for sinistre declarations
CREATE TABLE public.claims (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  policy_id UUID REFERENCES public.policies(id) ON DELETE SET NULL,
  claim_type TEXT NOT NULL, -- auto, sante, menage, juridique, autre
  incident_date DATE NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted', -- submitted, in_review, approved, rejected, closed
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;

-- Clients can view their own claims
CREATE POLICY "Clients can view their own claims"
ON public.claims
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM clients c 
    WHERE c.id = claims.client_id AND c.user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'agent'::app_role)
  OR has_role(auth.uid(), 'backoffice'::app_role)
);

-- Clients can create claims for themselves
CREATE POLICY "Clients can create their own claims"
ON public.claims
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM clients c 
    WHERE c.id = claims.client_id AND c.user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Staff can update claims
CREATE POLICY "Staff can update claims"
ON public.claims
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'agent'::app_role)
  OR has_role(auth.uid(), 'backoffice'::app_role)
);

-- Admin can delete claims
CREATE POLICY "Admin can delete claims"
ON public.claims
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_claims_updated_at
  BEFORE UPDATE ON public.claims
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create claim_documents table to link documents to claims
CREATE TABLE public.claim_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.claim_documents ENABLE ROW LEVEL SECURITY;

-- Users can view claim documents for their claims
CREATE POLICY "Users can view their claim documents"
ON public.claim_documents
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM claims cl
    JOIN clients c ON cl.client_id = c.id
    WHERE cl.id = claim_documents.claim_id AND c.user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'agent'::app_role)
  OR has_role(auth.uid(), 'backoffice'::app_role)
);

-- Users can create claim documents for their claims
CREATE POLICY "Users can create claim documents"
ON public.claim_documents
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM claims cl
    JOIN clients c ON cl.client_id = c.id
    WHERE cl.id = claim_documents.claim_id AND c.user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);