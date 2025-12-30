-- ============================================
-- PHASE 2: Compagnies (remplacement de Partenaires)
-- ============================================

-- 1. Enrichir la table insurance_companies
ALTER TABLE public.insurance_companies
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'CH',
ADD COLUMN IF NOT EXISTS regions TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS insurance_types TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS sla_days INTEGER,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Index pour recherche
CREATE INDEX IF NOT EXISTS idx_insurance_companies_status ON public.insurance_companies(status);
CREATE INDEX IF NOT EXISTS idx_insurance_companies_types ON public.insurance_companies USING GIN(insurance_types);

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS update_insurance_companies_updated_at ON public.insurance_companies;
CREATE TRIGGER update_insurance_companies_updated_at
  BEFORE UPDATE ON public.insurance_companies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Créer la table company_contacts
CREATE TABLE IF NOT EXISTS public.company_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.insurance_companies(id) ON DELETE CASCADE,
  contact_type TEXT NOT NULL CHECK (contact_type IN (
    'BACK_OFFICE',
    'KEY_MANAGER', 
    'SINISTRES',
    'RECLAMATIONS',
    'RESILIATION',
    'SUPPORT_COURTIER',
    'COMMERCIAL',
    'GENERAL'
  )),
  channel TEXT NOT NULL CHECK (channel IN ('EMAIL', 'TELEPHONE', 'FORMULAIRE', 'POSTAL')),
  value TEXT NOT NULL,
  label TEXT,
  is_verified BOOLEAN DEFAULT false,
  is_primary BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_company_contacts_company ON public.company_contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_company_contacts_type ON public.company_contacts(contact_type);
CREATE INDEX IF NOT EXISTS idx_company_contacts_channel ON public.company_contacts(channel);

-- Activer RLS
ALTER TABLE public.company_contacts ENABLE ROW LEVEL SECURITY;

-- Policies pour company_contacts
CREATE POLICY "Anyone can view company contacts"
ON public.company_contacts FOR SELECT
USING (true);

CREATE POLICY "Admins can manage company contacts"
ON public.company_contacts FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can insert company contacts"
ON public.company_contacts FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'backoffice'::app_role) OR
  public.has_role(auth.uid(), 'agent'::app_role)
);

CREATE POLICY "Staff can update company contacts"
ON public.company_contacts FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'backoffice'::app_role)
);

-- Trigger pour updated_at
CREATE TRIGGER update_company_contacts_updated_at
  BEFORE UPDATE ON public.company_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Fonction helper pour récupérer le contact approprié selon le type d'événement
CREATE OR REPLACE FUNCTION public.get_company_contact(
  p_company_id UUID,
  p_contact_type TEXT,
  p_channel TEXT DEFAULT NULL
)
RETURNS TABLE(contact_id UUID, channel TEXT, value TEXT, label TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cc.id AS contact_id,
    cc.channel,
    cc.value,
    cc.label
  FROM company_contacts cc
  WHERE cc.company_id = p_company_id
    AND cc.contact_type = p_contact_type
    AND (p_channel IS NULL OR cc.channel = p_channel)
  ORDER BY cc.is_primary DESC, cc.created_at ASC
  LIMIT 1;
END;
$$;