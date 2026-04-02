-- Drop the existing check constraint and add a new one with "gestion" type
ALTER TABLE public.commissions DROP CONSTRAINT IF EXISTS commissions_type_check;

ALTER TABLE public.commissions ADD CONSTRAINT commissions_type_check 
CHECK (type IN ('acquisition', 'renewal', 'bonus', 'gestion'));