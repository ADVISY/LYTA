-- ============================================================================
-- SMARTFLOW DÉCOMPTES — Phase 1 : schéma DB
-- ============================================================================
-- Permet au broker d'uploader un PDF de décompte de commissions reçu d'une
-- compagnie (Helsana, AXA, Mobilière...), de laisser l'IA extraire chaque
-- ligne, et de valider rapidement commission par commission.
-- Objectif métier : passer de 3 h à 20-30 min de saisie pour 200 lignes.
--
-- 2 tables :
--   commission_statements      → 1 row = 1 PDF importé
--   commission_statement_lines → 1 row = 1 ligne extraite du PDF
-- ============================================================================

-- ============================================================================
-- 1. commission_statements
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.commission_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Compagnie qui envoie le décompte (peut être NULL si l'IA n'a pas détecté)
  company_id UUID REFERENCES public.insurance_companies(id) ON DELETE SET NULL,
  detected_company_name TEXT,   -- nom brut tel qu'écrit dans le PDF

  -- Période couverte (typiquement un mois ou un trimestre)
  period_year INT  CHECK (period_year  IS NULL OR period_year  BETWEEN 2000 AND 2100),
  period_month INT CHECK (period_month IS NULL OR period_month BETWEEN 1 AND 12),
  statement_date DATE,          -- date imprimée sur le décompte

  -- Fichier source
  original_file_key  TEXT NOT NULL,
  original_file_name TEXT NOT NULL,
  mime_type TEXT,

  -- Statut du traitement
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','extracted','partially_validated','completed','failed')),
  error_message TEXT,

  -- Totaux
  total_amount_detected NUMERIC(12,2),   -- total déclaré dans le PDF
  total_amount_validated NUMERIC(12,2),  -- somme des lignes validées (calculé via trigger)
  currency TEXT NOT NULL DEFAULT 'CHF',

  -- Métriques
  detected_lines_count  INT NOT NULL DEFAULT 0,
  validated_lines_count INT NOT NULL DEFAULT 0,
  skipped_lines_count   INT NOT NULL DEFAULT 0,

  -- Métadonnées IA
  ai_model_used      TEXT,
  processing_time_ms INTEGER,

  -- Audit
  uploaded_by UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_statements_tenant
  ON public.commission_statements(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commission_statements_company
  ON public.commission_statements(company_id, period_year, period_month);

COMMENT ON TABLE public.commission_statements IS
  'Smartflow Décomptes : 1 row = 1 PDF de décompte de commissions importé depuis une compagnie';

-- ============================================================================
-- 2. commission_statement_lines
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.commission_statement_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id UUID NOT NULL REFERENCES public.commission_statements(id) ON DELETE CASCADE,
  tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Position dans le PDF
  line_number INT,
  page_number INT,

  -- Données brutes extraites par l'IA (telles qu'écrites dans le PDF)
  raw_client_first_name TEXT,
  raw_client_last_name  TEXT,
  raw_client_full_name  TEXT,   -- au cas où l'IA ne sépare pas
  raw_policy_number     TEXT,
  raw_product_name      TEXT,
  raw_period_label      TEXT,

  -- Montants
  gross_amount   NUMERIC(12,2),
  net_amount     NUMERIC(12,2),
  commission_rate NUMERIC(6,3), -- pourcentage (ex: 12.500)
  currency TEXT NOT NULL DEFAULT 'CHF',

  -- Période normalisée
  period_year  INT CHECK (period_year  IS NULL OR period_year  BETWEEN 2000 AND 2100),
  period_month INT CHECK (period_month IS NULL OR period_month BETWEEN 1 AND 12),

  -- Résolution du match avec le CRM
  match_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (match_status IN ('pending','matched','ambiguous','no_match','manual_match','skipped')),
  matched_client_id UUID REFERENCES public.clients(id)  ON DELETE SET NULL,
  matched_policy_id UUID REFERENCES public.policies(id) ON DELETE SET NULL,
  match_score NUMERIC(4,3),      -- score 0-1, plus c'est haut mieux c'est
  match_candidates JSONB,        -- liste des top candidats si ambigu

  -- Validation
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES auth.users(id),
  created_commission_id UUID REFERENCES public.commissions(id) ON DELETE SET NULL,
  notes TEXT,

  -- Confiance IA
  ai_confidence NUMERIC(3,2),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_csl_statement
  ON public.commission_statement_lines(statement_id, line_number);
CREATE INDEX IF NOT EXISTS idx_csl_match_status
  ON public.commission_statement_lines(statement_id, match_status);
CREATE INDEX IF NOT EXISTS idx_csl_matched_client
  ON public.commission_statement_lines(matched_client_id);
CREATE INDEX IF NOT EXISTS idx_csl_matched_policy
  ON public.commission_statement_lines(matched_policy_id);
CREATE INDEX IF NOT EXISTS idx_csl_tenant
  ON public.commission_statement_lines(tenant_id);

COMMENT ON TABLE public.commission_statement_lines IS
  'Smartflow Décomptes : 1 row = 1 ligne extraite d''un décompte de commissions';

-- ============================================================================
-- 3. Trigger updated_at + recompute totals on the parent
-- ============================================================================
CREATE OR REPLACE FUNCTION public.touch_commission_statement_lines()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_csl ON public.commission_statement_lines;
CREATE TRIGGER trg_touch_csl
  BEFORE UPDATE ON public.commission_statement_lines
  FOR EACH ROW EXECUTE FUNCTION public.touch_commission_statement_lines();

CREATE OR REPLACE FUNCTION public.recompute_commission_statement_totals()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_stmt UUID;
BEGIN
  v_stmt := COALESCE(NEW.statement_id, OLD.statement_id);
  IF v_stmt IS NULL THEN RETURN NULL; END IF;

  UPDATE public.commission_statements s SET
    detected_lines_count  = (SELECT count(*) FROM public.commission_statement_lines WHERE statement_id = v_stmt),
    validated_lines_count = (SELECT count(*) FROM public.commission_statement_lines WHERE statement_id = v_stmt AND validated_at IS NOT NULL),
    skipped_lines_count   = (SELECT count(*) FROM public.commission_statement_lines WHERE statement_id = v_stmt AND match_status = 'skipped'),
    total_amount_validated = COALESCE(
      (SELECT sum(net_amount) FROM public.commission_statement_lines
        WHERE statement_id = v_stmt AND validated_at IS NOT NULL), 0),
    updated_at = now()
  WHERE s.id = v_stmt;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_stmt_totals ON public.commission_statement_lines;
CREATE TRIGGER trg_recompute_stmt_totals
  AFTER INSERT OR UPDATE OR DELETE ON public.commission_statement_lines
  FOR EACH ROW EXECUTE FUNCTION public.recompute_commission_statement_totals();

-- updated_at sur commission_statements
CREATE OR REPLACE FUNCTION public.touch_commission_statements()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_touch_cs ON public.commission_statements;
CREATE TRIGGER trg_touch_cs
  BEFORE UPDATE ON public.commission_statements
  FOR EACH ROW EXECUTE FUNCTION public.touch_commission_statements();

-- ============================================================================
-- 4. RLS — accès strict au tenant
-- ============================================================================
ALTER TABLE public.commission_statements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_statement_lines   ENABLE ROW LEVEL SECURITY;

-- Helper assumé existant : has_tenant_role(tenant_id, role)  /  is_king()
-- On suit le pattern des autres tables CRM : tout user attaché au tenant peut
-- lire/écrire ses propres décomptes ; les kings voient tout.

DROP POLICY IF EXISTS cs_tenant_access ON public.commission_statements;
CREATE POLICY cs_tenant_access ON public.commission_statements
  FOR ALL
  USING (
    public.is_king()
    OR tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_assignments WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_king()
    OR tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_assignments WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS csl_tenant_access ON public.commission_statement_lines;
CREATE POLICY csl_tenant_access ON public.commission_statement_lines
  FOR ALL
  USING (
    public.is_king()
    OR tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_assignments WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_king()
    OR tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_assignments WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- 5. Permissions
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_statements      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_statement_lines TO authenticated;
