-- Fix: Remove the SECURITY DEFINER view and use a regular view with RLS
-- The clients table already has proper RLS, we just need column-level restriction

DROP VIEW IF EXISTS public.clients_safe;

-- Instead, create a function to check if user can see sensitive financial data
CREATE OR REPLACE FUNCTION public.can_view_financial_data()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'compta')
$$;