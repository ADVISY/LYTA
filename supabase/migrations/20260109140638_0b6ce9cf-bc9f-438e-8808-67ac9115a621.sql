-- Add subscription columns to tenants table
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS stripe_customer_id text,
ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
ADD COLUMN IF NOT EXISTS plan text DEFAULT 'start',
ADD COLUMN IF NOT EXISTS extra_users integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS billing_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS current_period_end timestamptz;

-- Add index for Stripe lookups
CREATE INDEX IF NOT EXISTS idx_tenants_stripe_customer_id ON public.tenants(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_tenants_stripe_subscription_id ON public.tenants(stripe_subscription_id);