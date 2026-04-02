-- Add commission configuration fields to insurance_products table
ALTER TABLE public.insurance_products 
ADD COLUMN IF NOT EXISTS commission_type TEXT DEFAULT 'multiplier' CHECK (commission_type IN ('fixed', 'multiplier', 'percentage')),
ADD COLUMN IF NOT EXISTS commission_value NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS commission_description TEXT;

-- Add some comments for clarity
COMMENT ON COLUMN public.insurance_products.commission_type IS 'Type of commission: fixed (CHF), multiplier (premium * X), percentage (premium * X%)';
COMMENT ON COLUMN public.insurance_products.commission_value IS 'The value used in commission calculation';
COMMENT ON COLUMN public.insurance_products.commission_description IS 'Human-readable description of the commission formula';

-- Update existing LAMal products with default 70 CHF fixed commission
UPDATE public.insurance_products 
SET commission_type = 'fixed', 
    commission_value = 70, 
    commission_description = '70 CHF par contrat'
WHERE LOWER(category) LIKE '%lamal%' OR LOWER(name) LIKE '%lamal%';

-- Update existing LCA/complementary products with x16 multiplier
UPDATE public.insurance_products 
SET commission_type = 'multiplier', 
    commission_value = 16, 
    commission_description = 'Prime mensuelle × 16'
WHERE (LOWER(category) LIKE '%compl%' OR LOWER(name) LIKE '%compl%' OR LOWER(category) = 'lca')
  AND commission_type = 'multiplier' AND commission_value = 0;

-- Update life/3e pilier products with 4% percentage
UPDATE public.insurance_products 
SET commission_type = 'percentage', 
    commission_value = 4, 
    commission_description = 'Prime × durée × 4%'
WHERE (LOWER(category) LIKE '%vie%' OR LOWER(category) LIKE '%pilier%' OR LOWER(name) LIKE '%3a%' OR LOWER(name) LIKE '%3b%')
  AND commission_type = 'multiplier' AND commission_value = 0;