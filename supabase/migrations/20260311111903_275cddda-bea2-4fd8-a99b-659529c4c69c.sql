ALTER TABLE public.tenant_app_settings 
ADD COLUMN IF NOT EXISTS config_json JSONB NOT NULL DEFAULT '{}'::jsonb;