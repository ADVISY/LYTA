
-- =====================================================
-- PHASE 3: DRIVE INTELLIGENT
-- =====================================================

-- 1. Enrich documents table with intelligent metadata
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS expires_at DATE,
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS parent_document_id UUID REFERENCES public.documents(id),
ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS template_name TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_documents_category ON public.documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_tags ON public.documents USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_documents_expires_at ON public.documents(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_parent ON public.documents(parent_document_id) WHERE parent_document_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_is_template ON public.documents(is_template) WHERE is_template = true;

-- 2. Create document categories enum-like table for flexibility
CREATE TABLE IF NOT EXISTS public.document_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'file',
  color TEXT DEFAULT '#6366f1',
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name)
);

-- Enable RLS
ALTER TABLE public.document_categories ENABLE ROW LEVEL SECURITY;

-- RLS policies for document_categories
CREATE POLICY "Tenant users can view their categories"
  ON public.document_categories FOR SELECT
  USING (tenant_id = get_user_tenant_id() OR is_system = true);

CREATE POLICY "Admins can manage categories"
  ON public.document_categories FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Insert default system categories
INSERT INTO public.document_categories (name, description, icon, color, is_system) VALUES
  ('Contrat', 'Documents contractuels', 'file-text', '#3b82f6', true),
  ('Identité', 'Pièces d''identité', 'id-card', '#10b981', true),
  ('Attestation', 'Attestations et certificats', 'award', '#f59e0b', true),
  ('Facture', 'Factures et devis', 'receipt', '#8b5cf6', true),
  ('Sinistre', 'Documents de sinistre', 'alert-triangle', '#ef4444', true),
  ('Correspondance', 'Courriers et emails', 'mail', '#6366f1', true),
  ('Autre', 'Autres documents', 'file', '#64748b', true)
ON CONFLICT DO NOTHING;

-- 3. Create document templates table
CREATE TABLE IF NOT EXISTS public.document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  file_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  variables JSONB DEFAULT '[]', -- [{name: 'client_name', label: 'Nom du client', type: 'text'}]
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies for document_templates
CREATE POLICY "Tenant users can view their templates"
  ON public.document_templates FOR SELECT
  USING (tenant_id = get_user_tenant_id() OR tenant_id IS NULL);

CREATE POLICY "Admins can manage templates"
  ON public.document_templates FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- 4. Create document_reminders table for expiration alerts
CREATE TABLE IF NOT EXISTS public.document_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id),
  reminder_date DATE NOT NULL,
  reminder_type TEXT NOT NULL DEFAULT 'expiration', -- expiration, renewal, review
  days_before INTEGER NOT NULL DEFAULT 30,
  notified_at TIMESTAMPTZ,
  notification_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.document_reminders ENABLE ROW LEVEL SECURITY;

-- RLS policies for document_reminders
CREATE POLICY "Tenant users can view their reminders"
  ON public.document_reminders FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Staff can manage reminders"
  ON public.document_reminders FOR ALL
  USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'backoffice') OR
    has_role(auth.uid(), 'agent')
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'backoffice') OR
    has_role(auth.uid(), 'agent')
  );

-- Index for reminder queries
CREATE INDEX IF NOT EXISTS idx_document_reminders_date 
  ON public.document_reminders(reminder_date) 
  WHERE notification_sent = false;

-- 5. Create function to auto-create expiration reminders
CREATE OR REPLACE FUNCTION public.create_document_expiration_reminder()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If expires_at is set, create a reminder 30 days before
  IF NEW.expires_at IS NOT NULL AND (OLD IS NULL OR OLD.expires_at IS DISTINCT FROM NEW.expires_at) THEN
    -- Delete old reminder if exists
    DELETE FROM public.document_reminders 
    WHERE document_id = NEW.id AND reminder_type = 'expiration';
    
    -- Create new reminder 30 days before expiration
    INSERT INTO public.document_reminders (document_id, tenant_id, reminder_date, reminder_type, days_before)
    VALUES (
      NEW.id, 
      NEW.tenant_id, 
      NEW.expires_at - INTERVAL '30 days', 
      'expiration', 
      30
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for auto-reminders
DROP TRIGGER IF EXISTS trigger_document_expiration_reminder ON public.documents;
CREATE TRIGGER trigger_document_expiration_reminder
  AFTER INSERT OR UPDATE OF expires_at ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.create_document_expiration_reminder();

-- 6. Create function to get document with version history
CREATE OR REPLACE FUNCTION public.get_document_versions(p_document_id UUID)
RETURNS TABLE (
  id UUID,
  file_name TEXT,
  version INTEGER,
  created_at TIMESTAMPTZ,
  created_by UUID,
  size_bytes BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_root_id UUID;
BEGIN
  -- Find the root document
  SELECT COALESCE(d.parent_document_id, d.id) INTO v_root_id
  FROM documents d WHERE d.id = p_document_id;
  
  -- Return all versions
  RETURN QUERY
  SELECT 
    d.id,
    d.file_name,
    d.version,
    d.created_at,
    d.created_by,
    d.size_bytes
  FROM documents d
  WHERE d.id = v_root_id OR d.parent_document_id = v_root_id
  ORDER BY d.version DESC;
END;
$$;

-- 7. Updated_at trigger for templates
CREATE TRIGGER update_document_templates_updated_at
  BEFORE UPDATE ON public.document_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Create view for documents with pending expiration
CREATE OR REPLACE VIEW public.documents_expiring_soon AS
SELECT 
  d.*,
  dr.reminder_date,
  dr.days_before,
  c.first_name || ' ' || c.last_name AS client_name,
  c.email AS client_email
FROM documents d
LEFT JOIN document_reminders dr ON dr.document_id = d.id AND dr.notification_sent = false
LEFT JOIN clients c ON d.owner_type = 'client' AND d.owner_id = c.id
WHERE d.expires_at IS NOT NULL
  AND d.expires_at <= CURRENT_DATE + INTERVAL '60 days'
ORDER BY d.expires_at ASC;
