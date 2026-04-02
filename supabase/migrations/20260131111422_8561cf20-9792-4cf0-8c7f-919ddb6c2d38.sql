-- =====================================================
-- IA SCAN MODULE - Document Intelligence Tables
-- =====================================================

-- Table principale pour les scans de documents
CREATE TABLE public.document_scans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  
  -- Source du scan
  source_type TEXT NOT NULL DEFAULT 'deposit', -- 'deposit', 'client_upload', 'backoffice'
  source_form_type TEXT, -- 'sana', 'vita', 'medio', 'business'
  
  -- Fichier original
  original_file_key TEXT NOT NULL,
  original_file_name TEXT NOT NULL,
  mime_type TEXT,
  
  -- Statut du traitement
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'validated'
  error_message TEXT,
  
  -- Classification IA
  detected_doc_type TEXT, -- 'police', 'offre', 'avenant', 'resiliation', 'attestation', 'autre'
  doc_type_confidence NUMERIC(3,2), -- 0.00 à 1.00
  
  -- Score global de qualité
  quality_score NUMERIC(3,2), -- qualité du document (lisibilité)
  overall_confidence NUMERIC(3,2), -- confiance globale extraction
  
  -- Métadonnées
  ocr_required BOOLEAN DEFAULT false,
  processing_time_ms INTEGER,
  ai_model_used TEXT,
  
  -- Utilisateurs
  uploaded_by UUID REFERENCES auth.users(id),
  validated_by UUID REFERENCES auth.users(id),
  validated_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table des résultats d'extraction (champs extraits)
CREATE TABLE public.document_scan_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_id UUID NOT NULL REFERENCES public.document_scans(id) ON DELETE CASCADE,
  
  -- Identification du champ
  field_category TEXT NOT NULL, -- 'client', 'contract', 'product', 'premium', 'dates'
  field_name TEXT NOT NULL, -- 'nom', 'prenom', 'date_naissance', 'prime_mensuelle', etc.
  
  -- Valeurs
  extracted_value TEXT, -- valeur brute extraite par l'IA
  validated_value TEXT, -- valeur corrigée/validée par l'humain
  
  -- Confiance
  confidence TEXT NOT NULL DEFAULT 'low', -- 'high', 'medium', 'low'
  confidence_score NUMERIC(3,2), -- 0.00 à 1.00
  
  -- Métadonnées d'extraction
  extraction_notes TEXT, -- pourquoi l'IA a proposé cette valeur
  page_number INTEGER,
  bounding_box JSONB, -- coordonnées sur le document
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table d'audit pour la conformité (non modifiable)
CREATE TABLE public.document_scan_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_id UUID NOT NULL REFERENCES public.document_scans(id) ON DELETE CASCADE,
  
  -- Action
  action TEXT NOT NULL, -- 'created', 'extracted', 'validated', 'rejected', 'field_corrected'
  
  -- Données
  field_name TEXT, -- si correction de champ
  old_value TEXT,
  new_value TEXT,
  
  -- Résultat IA complet (snapshot)
  ai_response_snapshot JSONB,
  
  -- Utilisateur
  performed_by UUID REFERENCES auth.users(id),
  performed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Contexte
  ip_address INET,
  user_agent TEXT
);

-- Index pour performance
CREATE INDEX idx_document_scans_tenant ON document_scans(tenant_id);
CREATE INDEX idx_document_scans_status ON document_scans(status);
CREATE INDEX idx_document_scans_uploaded_by ON document_scans(uploaded_by);
CREATE INDEX idx_document_scan_results_scan ON document_scan_results(scan_id);
CREATE INDEX idx_document_scan_audit_scan ON document_scan_audit(scan_id);

-- Enable RLS
ALTER TABLE public.document_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_scan_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_scan_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policies pour document_scans
CREATE POLICY "Users can view scans from their tenant"
  ON document_scans FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_assignments WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create scans in their tenant"
  ON document_scans FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_assignments WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update scans in their tenant"
  ON document_scans FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_assignments WHERE user_id = auth.uid()
    )
  );

-- RLS Policies pour document_scan_results
CREATE POLICY "Users can view results from their tenant scans"
  ON document_scan_results FOR SELECT
  USING (
    scan_id IN (
      SELECT id FROM document_scans WHERE tenant_id IN (
        SELECT tenant_id FROM user_tenant_assignments WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage results from their tenant scans"
  ON document_scan_results FOR ALL
  USING (
    scan_id IN (
      SELECT id FROM document_scans WHERE tenant_id IN (
        SELECT tenant_id FROM user_tenant_assignments WHERE user_id = auth.uid()
      )
    )
  );

-- RLS Policies pour document_scan_audit (lecture seule)
CREATE POLICY "Users can view audit from their tenant scans"
  ON document_scan_audit FOR SELECT
  USING (
    scan_id IN (
      SELECT id FROM document_scans WHERE tenant_id IN (
        SELECT tenant_id FROM user_tenant_assignments WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "System can insert audit logs"
  ON document_scan_audit FOR INSERT
  WITH CHECK (true);

-- Trigger pour updated_at
CREATE TRIGGER update_document_scans_updated_at
  BEFORE UPDATE ON document_scans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Fonction helper pour créer un audit log
CREATE OR REPLACE FUNCTION public.create_scan_audit_log(
  p_scan_id UUID,
  p_action TEXT,
  p_field_name TEXT DEFAULT NULL,
  p_old_value TEXT DEFAULT NULL,
  p_new_value TEXT DEFAULT NULL,
  p_ai_snapshot JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit_id UUID;
BEGIN
  INSERT INTO document_scan_audit (
    scan_id, action, field_name, old_value, new_value, 
    ai_response_snapshot, performed_by
  )
  VALUES (
    p_scan_id, p_action, p_field_name, p_old_value, p_new_value,
    p_ai_snapshot, auth.uid()
  )
  RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$;