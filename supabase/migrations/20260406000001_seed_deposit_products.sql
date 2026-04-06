-- Seed placeholder products for the deposit-contract edge function
-- The function maps formType to hardcoded UUIDs that must exist in insurance_products

-- Create a placeholder company for deposit form products
INSERT INTO insurance_companies (id, name)
VALUES ('00000000-0000-0000-0000-000000000000', 'Dépôt générique')
ON CONFLICT (name) DO NOTHING;

-- Create the 4 products expected by deposit-contract/index.ts
INSERT INTO insurance_products (id, company_id, name, category, description, source)
VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'Sana', 'health', 'Produit placeholder pour dépôt de contrat santé', 'manual'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'Vita', 'life', 'Produit placeholder pour dépôt de contrat vie', 'manual'),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'Medio', 'home', 'Produit placeholder pour dépôt de contrat ménage', 'manual'),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'Business', 'rcpro', 'Produit placeholder pour dépôt de contrat entreprise', 'manual')
ON CONFLICT DO NOTHING;
