-- Fix search_path security warning for the function
DROP FUNCTION IF EXISTS public.update_ai_updated_at_column() CASCADE;

CREATE OR REPLACE FUNCTION public.update_ai_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public;

-- Recreate triggers
CREATE TRIGGER update_ai_conversations_updated_at
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ai_updated_at_column();

CREATE TRIGGER update_ai_leads_updated_at
  BEFORE UPDATE ON public.ai_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ai_updated_at_column();