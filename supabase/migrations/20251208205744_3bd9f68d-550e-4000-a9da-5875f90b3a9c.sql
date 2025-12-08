-- Drop the existing check constraint on amount
ALTER TABLE public.commissions DROP CONSTRAINT IF EXISTS commissions_amount_check;

-- Add a new check constraint that allows negative amounts for decommissions
-- (no constraint needed, or we could add one that just prevents 0)
