-- Add verified_partner_id column to track which partner submitted the scan
-- This ensures we can verify the email was validated before processing

ALTER TABLE public.document_scans 
ADD COLUMN IF NOT EXISTS verified_partner_id uuid;

-- Add verified_partner_email for audit trail (email that was verified)
ALTER TABLE public.document_scans 
ADD COLUMN IF NOT EXISTS verified_partner_email text;

-- Update the RLS policy to require verified_partner_email for deposit scans
DROP POLICY IF EXISTS "Allow public deposit form inserts" ON public.document_scans;

CREATE POLICY "Allow public deposit form inserts with verification"
ON public.document_scans FOR INSERT
TO anon, authenticated
WITH CHECK (
  source_type = 'deposit' 
  AND verified_partner_email IS NOT NULL 
  AND verified_partner_email <> ''
);