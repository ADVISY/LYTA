-- Add canton field to clients table for withholding tax calculation
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS canton TEXT;

-- Update existing collaborators with canton based on postal code
UPDATE public.clients 
SET canton = CASE 
  WHEN postal_code LIKE '12%' THEN 'GE'
  WHEN postal_code LIKE '10%' THEN 'VD'
  WHEN postal_code LIKE '19%' THEN 'VS'
  WHEN postal_code LIKE '20%' THEN 'FR'
  WHEN postal_code LIKE '25%' THEN 'NE'
  WHEN postal_code LIKE '80%' THEN 'ZH'
  WHEN postal_code LIKE '40%' THEN 'BS'
  WHEN postal_code LIKE '30%' THEN 'BE'
  ELSE 'VD'
END
WHERE type_adresse = 'collaborateur' AND canton IS NULL;