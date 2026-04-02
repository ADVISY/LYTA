-- Add claims notification email to tenant_branding
ALTER TABLE public.tenant_branding 
ADD COLUMN IF NOT EXISTS claims_notification_email text;