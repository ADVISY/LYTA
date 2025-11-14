-- Add type_adresse column to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS type_adresse TEXT DEFAULT 'client' CHECK (type_adresse IN ('client', 'collaborateur', 'partenaire'));

-- Set default value for existing records
UPDATE public.clients SET type_adresse = 'client' WHERE type_adresse IS NULL;

-- Make the column NOT NULL after setting default
ALTER TABLE public.clients ALTER COLUMN type_adresse SET NOT NULL;

-- Add index for filtering by type
CREATE INDEX IF NOT EXISTS idx_clients_type_adresse ON public.clients(type_adresse);