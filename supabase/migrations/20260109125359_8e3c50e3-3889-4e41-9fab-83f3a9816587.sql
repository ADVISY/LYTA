-- Create enum for tenant plans
CREATE TYPE tenant_plan AS ENUM ('start', 'pro', 'prime', 'founder');

-- Create enum for plan status
CREATE TYPE plan_status AS ENUM ('active', 'suspended');

-- Create enum for billing status
CREATE TYPE billing_status AS ENUM ('paid', 'trial', 'past_due', 'canceled');

-- Add plan-related columns to tenants table
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS plan tenant_plan DEFAULT 'start',
ADD COLUMN IF NOT EXISTS plan_status plan_status DEFAULT 'active',
ADD COLUMN IF NOT EXISTS seats_included integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS seats_price numeric DEFAULT 20,
ADD COLUMN IF NOT EXISTS billing_status billing_status DEFAULT 'trial';

-- Create index for efficient plan filtering
CREATE INDEX IF NOT EXISTS idx_tenants_plan ON public.tenants(plan);
CREATE INDEX IF NOT EXISTS idx_tenants_billing_status ON public.tenants(billing_status);

-- Comment on columns for documentation
COMMENT ON COLUMN public.tenants.plan IS 'Current subscription plan: start, pro, prime, founder';
COMMENT ON COLUMN public.tenants.plan_status IS 'Plan status: active or suspended';
COMMENT ON COLUMN public.tenants.seats_included IS 'Number of users included in the plan (default 1)';
COMMENT ON COLUMN public.tenants.seats_price IS 'Price per additional user in CHF (default 20)';
COMMENT ON COLUMN public.tenants.billing_status IS 'Billing status: paid, trial, past_due, canceled';