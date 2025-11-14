-- Add IBAN column to clients for banking info
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS iban text;