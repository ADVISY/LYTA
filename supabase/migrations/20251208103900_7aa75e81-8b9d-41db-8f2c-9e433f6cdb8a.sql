-- Add reserve account rate column to clients table for collaborators
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS reserve_rate numeric DEFAULT 0;

-- Add comment explaining the purpose
COMMENT ON COLUMN public.clients.reserve_rate IS 'Compte de réserve - pourcentage retenu sur chaque commission (0, 10, ou 20%)';