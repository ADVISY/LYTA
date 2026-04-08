-- Seed placeholder products for the deposit-contract edge function
-- The function historically expected hardcoded placeholder products.

DO $$
DECLARE
  v_company_id UUID;
BEGIN
  INSERT INTO insurance_companies (name)
  VALUES ('Dépôt générique')
  ON CONFLICT (name) DO NOTHING;

  SELECT id
  INTO v_company_id
  FROM insurance_companies
  WHERE name = 'Dépôt générique'
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Unable to resolve placeholder company "Dépôt générique"';
  END IF;

  INSERT INTO insurance_products (company_id, name, category, description, source)
  VALUES
    (v_company_id, 'Sana', 'health', 'Produit placeholder pour dépôt de contrat santé', 'manual'),
    (v_company_id, 'Vita', 'life', 'Produit placeholder pour dépôt de contrat vie', 'manual'),
    (v_company_id, 'Medio', 'home', 'Produit placeholder pour dépôt de contrat ménage', 'manual'),
    (v_company_id, 'Business', 'rcpro', 'Produit placeholder pour dépôt de contrat entreprise', 'manual')
  ON CONFLICT (company_id, name) DO UPDATE
  SET
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    source = EXCLUDED.source;
END $$;
