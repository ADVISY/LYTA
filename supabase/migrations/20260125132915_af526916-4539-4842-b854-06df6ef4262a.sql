-- Fix the notify_client_new_invoice function to use correct column names
CREATE OR REPLACE FUNCTION public.notify_client_new_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_user_id UUID;
  v_amount_text TEXT;
BEGIN
  -- Only proceed if there's a client_id
  IF NEW.client_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get the client's user_id
  SELECT c.user_id INTO v_client_user_id
  FROM public.clients c
  WHERE c.id = NEW.client_id AND c.user_id IS NOT NULL;
  
  IF v_client_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Use amount_ttc instead of amount, and hardcode CHF as currency (Swiss invoices)
  v_amount_text := TO_CHAR(NEW.amount_ttc, 'FM999G999D00') || ' CHF';
  
  INSERT INTO public.notifications (
    user_id, tenant_id, kind, title, message, priority, payload
  ) VALUES (
    v_client_user_id,
    NEW.tenant_id,
    'invoice',
    'Nouvelle facture',
    'Facture ' || NEW.invoice_number || ' de ' || v_amount_text,
    'high',
    jsonb_build_object('invoice_id', NEW.id, 'invoice_number', NEW.invoice_number, 'amount', NEW.amount_ttc)
  );
  
  RETURN NEW;
END;
$$;