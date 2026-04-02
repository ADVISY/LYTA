-- Add email column to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS email TEXT;

-- Add index for email searches
CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients(email);