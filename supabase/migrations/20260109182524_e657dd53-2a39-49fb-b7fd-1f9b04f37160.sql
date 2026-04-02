-- Add language columns to profiles and tenants tables

-- Add preferred_language to profiles (user preference)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'fr';

-- Add default_language to tenants (tenant-wide default)
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS default_language TEXT DEFAULT 'fr';

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.preferred_language IS 'User preferred language (fr, de, it, en)';
COMMENT ON COLUMN public.tenants.default_language IS 'Tenant default language for all users and emails (fr, de, it, en)';