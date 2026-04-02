-- Add email configuration fields to tenant_branding table
ALTER TABLE public.tenant_branding 
ADD COLUMN IF NOT EXISTS email_sender_name text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS email_sender_address text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS company_address text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS company_phone text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS company_website text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS company_email text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS email_footer_text text DEFAULT NULL;

-- Update existing Advisy tenant branding with their email config
UPDATE public.tenant_branding
SET 
  email_sender_name = 'Advisy',
  company_address = 'Rue de Lausanne 15, 1950 Sion',
  company_phone = '+41 27 123 45 67',
  company_website = 'www.e-advisy.ch',
  company_email = 'hello@e-advisy.ch'
WHERE tenant_id = (SELECT id FROM public.tenants WHERE slug = 'advisy' LIMIT 1);

-- Add comment to explain the fields
COMMENT ON COLUMN public.tenant_branding.email_sender_name IS 'Display name for email sender (e.g., "Advisy" or "LYTA")';
COMMENT ON COLUMN public.tenant_branding.email_sender_address IS 'Email address to use as sender (must be verified in Resend)';
COMMENT ON COLUMN public.tenant_branding.company_address IS 'Physical address to display in email footer';
COMMENT ON COLUMN public.tenant_branding.company_phone IS 'Phone number to display in email footer';
COMMENT ON COLUMN public.tenant_branding.company_website IS 'Website URL to display in email footer';
COMMENT ON COLUMN public.tenant_branding.company_email IS 'Contact email to display in email footer';