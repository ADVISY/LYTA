-- Add products_data column to store multiple products per policy
ALTER TABLE public.policies 
ADD COLUMN IF NOT EXISTS products_data JSONB DEFAULT '[]'::jsonb;

-- Add comment to explain the structure
COMMENT ON COLUMN public.policies.products_data IS 'Array of products: [{productId, name, category, premium, deductible, durationYears}]';