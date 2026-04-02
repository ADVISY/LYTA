-- Add missing columns to tenants table for onboarding flow
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS contact_name text,
ADD COLUMN IF NOT EXISTS plan_id text,
ADD COLUMN IF NOT EXISTS stripe_session_id text,
ADD COLUMN IF NOT EXISTS backoffice_email text,
ADD COLUMN IF NOT EXISTS admin_email text,
ADD COLUMN IF NOT EXISTS processed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS processed_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS notes text;

-- Drop the old status constraint and add new one with 'pending'
ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_status_check;
ALTER TABLE public.tenants ADD CONSTRAINT tenants_status_check 
  CHECK (status = ANY (ARRAY['pending'::text, 'test'::text, 'active'::text, 'suspended'::text]));

-- Make email nullable for pending tenants (they provide contact_email instead)
ALTER TABLE public.tenants ALTER COLUMN email DROP NOT NULL;

-- Add index on status for filtering pending tenants
CREATE INDEX IF NOT EXISTS idx_tenants_status ON public.tenants(status);