
-- ================================================
-- PHASE 1: RÉFÉRENTIEL PRODUITS AMÉLIORÉ + MULTI-DOCUMENTS SCAN
-- ================================================

-- 1. Catégories produits normalisées (VIE/LCA/NON-VIE/HYPO)
CREATE TYPE product_main_category AS ENUM ('VIE', 'LCA', 'NON_VIE', 'HYPO');

-- 2. Ajouter colonnes manquantes à insurance_products
ALTER TABLE insurance_products 
  ADD COLUMN IF NOT EXISTS main_category product_main_category DEFAULT 'NON_VIE',
  ADD COLUMN IF NOT EXISTS subcategory TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 3. Table des alias/synonymes pour reconnaissance IA
CREATE TABLE IF NOT EXISTS product_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES insurance_products(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  language TEXT DEFAULT 'fr',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_product_aliases_alias ON product_aliases(alias);
CREATE INDEX IF NOT EXISTS idx_product_aliases_product ON product_aliases(product_id);

-- 4. Table des NPA suisses (codes postaux)
CREATE TABLE IF NOT EXISTS swiss_postal_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  npa TEXT NOT NULL,
  city TEXT NOT NULL,
  canton TEXT,
  language TEXT DEFAULT 'fr',
  is_primary BOOLEAN DEFAULT true
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_swiss_npa_city ON swiss_postal_codes(npa, city);
CREATE INDEX IF NOT EXISTS idx_swiss_npa ON swiss_postal_codes(npa);
CREATE INDEX IF NOT EXISTS idx_swiss_city ON swiss_postal_codes(city);

-- 5. Dossier Scan (batch de documents)
CREATE TABLE IF NOT EXISTS scan_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'classified', 'validated', 'error')),
  total_documents INTEGER DEFAULT 0,
  documents_classified INTEGER DEFAULT 0,
  consolidation_summary JSONB,
  verified_partner_email TEXT,
  verified_partner_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Documents dans un batch avec classification
CREATE TABLE IF NOT EXISTS scan_batch_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES scan_batches(id) ON DELETE CASCADE,
  scan_id UUID REFERENCES document_scans(id) ON DELETE SET NULL,
  file_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  document_classification TEXT CHECK (document_classification IN (
    'identity_doc',      -- Pièce d'identité
    'old_policy',        -- Ancienne police
    'new_contract',      -- Nouveau contrat
    'termination',       -- Lettre de résiliation
    'article_45',        -- Art. 45 LCA
    'other',             -- Autre
    'unknown'            -- Non classifié
  )),
  classification_confidence NUMERIC(3,2),
  classification_corrected BOOLEAN DEFAULT false,
  extracted_data JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'classified', 'error')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_batch_docs_batch ON scan_batch_documents(batch_id);

-- 7. RLS Policies
ALTER TABLE product_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE swiss_postal_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_batch_documents ENABLE ROW LEVEL SECURITY;

-- Product aliases: lecture publique, écriture admin
CREATE POLICY "product_aliases_read_all" ON product_aliases FOR SELECT USING (true);
CREATE POLICY "product_aliases_admin_write" ON product_aliases FOR ALL 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'king'));

-- Swiss postal codes: lecture publique
CREATE POLICY "swiss_npa_read_all" ON swiss_postal_codes FOR SELECT USING (true);
CREATE POLICY "swiss_npa_admin_write" ON swiss_postal_codes FOR ALL 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'king'));

-- Scan batches: accès par tenant
CREATE POLICY "scan_batches_tenant_access" ON scan_batches FOR ALL
  USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'king')
  );

-- Scan batch documents: accès via batch
CREATE POLICY "scan_batch_docs_access" ON scan_batch_documents FOR ALL
  USING (
    batch_id IN (
      SELECT id FROM scan_batches WHERE tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
      )
    )
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'king')
  );

-- 8. Mise à jour des catégories existantes
UPDATE insurance_products SET main_category = 'VIE' WHERE category IN ('life', 'vie', '3e pilier');
UPDATE insurance_products SET main_category = 'LCA' WHERE category IN ('health', 'lca', 'maladie', 'complementaire');
UPDATE insurance_products SET main_category = 'NON_VIE' WHERE category IN ('auto', 'home', 'legal', 'property', 'menage', 'rc');
UPDATE insurance_products SET main_category = 'HYPO' WHERE category IN ('hypo', 'hypotheque', 'mortgage');

-- Sous-catégories
UPDATE insurance_products SET subcategory = 'lamal' WHERE name ILIKE '%lamal%' OR name ILIKE '%base%';
UPDATE insurance_products SET subcategory = 'hospitalisation' WHERE name ILIKE '%hospit%' OR name ILIKE '%spital%';
UPDATE insurance_products SET subcategory = 'dentaire' WHERE name ILIKE '%dent%';
UPDATE insurance_products SET subcategory = 'ambulatoire' WHERE name ILIKE '%ambulat%';
UPDATE insurance_products SET subcategory = 'menage' WHERE name ILIKE '%ménage%' OR name ILIKE '%inventaire%';
UPDATE insurance_products SET subcategory = 'rc_privee' WHERE name ILIKE '%rc%' AND category = 'home';
UPDATE insurance_products SET subcategory = 'auto_rc' WHERE name ILIKE '%rc%' AND category = 'auto';
UPDATE insurance_products SET subcategory = 'auto_casco' WHERE name ILIKE '%casco%';
UPDATE insurance_products SET subcategory = '3a' WHERE name ILIKE '%3a%';
UPDATE insurance_products SET subcategory = '3b' WHERE name ILIKE '%3b%';
UPDATE insurance_products SET subcategory = 'protection_juridique' WHERE name ILIKE '%juridique%' OR name ILIKE '%legal%';

-- 9. Insérer quelques alias courants
INSERT INTO product_aliases (product_id, alias) 
SELECT id, 'RC privée' FROM insurance_products WHERE subcategory = 'rc_privee' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO product_aliases (product_id, alias) 
SELECT id, 'Responsabilité civile' FROM insurance_products WHERE subcategory = 'rc_privee' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO product_aliases (product_id, alias) 
SELECT id, 'Ass. ménage' FROM insurance_products WHERE subcategory = 'menage' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO product_aliases (product_id, alias) 
SELECT id, 'Household' FROM insurance_products WHERE subcategory = 'menage' LIMIT 1
ON CONFLICT DO NOTHING;

-- 10. Fonction de mapping produit par alias
CREATE OR REPLACE FUNCTION find_product_by_alias(search_term TEXT)
RETURNS TABLE(product_id UUID, product_name TEXT, company_id UUID, confidence NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (p.id)
    p.id,
    p.name,
    p.company_id,
    CASE 
      WHEN pa.alias ILIKE search_term THEN 1.0
      WHEN pa.alias ILIKE '%' || search_term || '%' THEN 0.8
      WHEN p.name ILIKE '%' || search_term || '%' THEN 0.6
      ELSE 0.4
    END::NUMERIC as confidence
  FROM insurance_products p
  LEFT JOIN product_aliases pa ON pa.product_id = p.id
  WHERE 
    pa.alias ILIKE '%' || search_term || '%'
    OR p.name ILIKE '%' || search_term || '%'
    OR p.subcategory ILIKE '%' || search_term || '%'
  ORDER BY p.id, confidence DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
