-- Triggers pour créer des notifications clients automatiquement

-- 1. Notification quand un nouveau contrat est créé pour un client
CREATE OR REPLACE FUNCTION public.notify_client_new_policy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client_user_id UUID;
  v_product_name TEXT;
  v_company_name TEXT;
BEGIN
  -- Get the client's user_id (if they have a portal account)
  SELECT c.user_id INTO v_client_user_id
  FROM public.clients c
  WHERE c.id = NEW.client_id AND c.user_id IS NOT NULL;
  
  IF v_client_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get product and company info
  SELECT ip.name, ic.name INTO v_product_name, v_company_name
  FROM public.insurance_products ip
  JOIN public.insurance_companies ic ON ic.id = ip.company_id
  WHERE ip.id = NEW.product_id;
  
  -- Create notification for the client
  INSERT INTO public.notifications (
    user_id, tenant_id, kind, title, message, priority, payload
  ) VALUES (
    v_client_user_id,
    NEW.tenant_id,
    'contract',
    'Nouveau contrat ajouté',
    COALESCE(v_product_name, 'Contrat') || ' chez ' || COALESCE(v_company_name, 'votre assureur'),
    'normal',
    jsonb_build_object('policy_id', NEW.id, 'product_name', v_product_name, 'company_name', v_company_name)
  );
  
  RETURN NEW;
END;
$$;

-- Drop if exists then create trigger
DROP TRIGGER IF EXISTS trigger_notify_client_new_policy ON public.policies;
CREATE TRIGGER trigger_notify_client_new_policy
  AFTER INSERT ON public.policies
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_client_new_policy();

-- 2. Notification quand un document est ajouté pour un client
CREATE OR REPLACE FUNCTION public.notify_client_new_document()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client_user_id UUID;
  v_doc_kind_label TEXT;
BEGIN
  -- Only notify for client-owned documents
  IF NEW.owner_type != 'client' THEN
    RETURN NEW;
  END IF;
  
  -- Get the client's user_id
  SELECT c.user_id INTO v_client_user_id
  FROM public.clients c
  WHERE c.id = NEW.owner_id::UUID AND c.user_id IS NOT NULL;
  
  IF v_client_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get friendly doc kind label
  v_doc_kind_label := CASE NEW.doc_kind
    WHEN 'facture' THEN 'Facture'
    WHEN 'police' THEN 'Police d''assurance'
    WHEN 'avenant' THEN 'Avenant'
    WHEN 'attestation' THEN 'Attestation'
    WHEN 'decompte' THEN 'Décompte'
    ELSE 'Document'
  END;
  
  -- Create notification
  INSERT INTO public.notifications (
    user_id, tenant_id, kind, title, message, priority, payload
  ) VALUES (
    v_client_user_id,
    NEW.tenant_id,
    'document',
    'Nouveau document disponible',
    v_doc_kind_label || ' : ' || NEW.file_name,
    'normal',
    jsonb_build_object('document_id', NEW.id, 'doc_kind', NEW.doc_kind, 'file_name', NEW.file_name)
  );
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_client_new_document ON public.documents;
CREATE TRIGGER trigger_notify_client_new_document
  AFTER INSERT ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_client_new_document();

-- 3. Notification quand le statut d'un sinistre change
CREATE OR REPLACE FUNCTION public.notify_client_claim_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client_user_id UUID;
  v_status_label TEXT;
BEGIN
  -- Only trigger on status change
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- Get the client's user_id
  SELECT c.user_id INTO v_client_user_id
  FROM public.clients c
  WHERE c.id = NEW.client_id AND c.user_id IS NOT NULL;
  
  IF v_client_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get status label
  v_status_label := CASE NEW.status
    WHEN 'pending' THEN 'en attente'
    WHEN 'processing' THEN 'en cours de traitement'
    WHEN 'approved' THEN 'accepté'
    WHEN 'rejected' THEN 'refusé'
    WHEN 'closed' THEN 'clôturé'
    ELSE NEW.status
  END;
  
  INSERT INTO public.notifications (
    user_id, tenant_id, kind, title, message, priority, payload
  ) VALUES (
    v_client_user_id,
    NEW.tenant_id,
    'claim',
    'Mise à jour de votre sinistre',
    'Votre sinistre est maintenant ' || v_status_label,
    CASE WHEN NEW.status IN ('approved', 'rejected') THEN 'high' ELSE 'normal' END,
    jsonb_build_object('claim_id', NEW.id, 'status', NEW.status, 'claim_type', NEW.claim_type)
  );
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_client_claim_status ON public.claims;
CREATE TRIGGER trigger_notify_client_claim_status
  AFTER UPDATE ON public.claims
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_client_claim_status();

-- 4. Notification quand le client reçoit un message
CREATE OR REPLACE FUNCTION public.notify_client_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client_user_id UUID;
  v_client_id UUID;
BEGIN
  -- Only notify for incoming messages (direction = 'incoming' means TO client)
  IF NEW.direction != 'incoming' THEN
    RETURN NEW;
  END IF;
  
  -- Get the client's user_id
  SELECT c.user_id INTO v_client_user_id
  FROM public.clients c
  WHERE c.id = NEW.client_id AND c.user_id IS NOT NULL;
  
  IF v_client_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  INSERT INTO public.notifications (
    user_id, kind, title, message, priority, payload
  ) VALUES (
    v_client_user_id,
    'message',
    'Nouveau message de votre conseiller',
    LEFT(NEW.content, 100) || CASE WHEN LENGTH(NEW.content) > 100 THEN '...' ELSE '' END,
    'normal',
    jsonb_build_object('message_id', NEW.id, 'channel', NEW.channel)
  );
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_client_new_message ON public.messages_clients;
CREATE TRIGGER trigger_notify_client_new_message
  AFTER INSERT ON public.messages_clients
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_client_new_message();

-- 5. Notification quand une facture QR est créée pour un client
CREATE OR REPLACE FUNCTION public.notify_client_new_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client_user_id UUID;
  v_amount_text TEXT;
BEGIN
  -- Get the client's user_id
  SELECT c.user_id INTO v_client_user_id
  FROM public.clients c
  WHERE c.id = NEW.client_id AND c.user_id IS NOT NULL;
  
  IF v_client_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  v_amount_text := TO_CHAR(NEW.amount, 'FM999G999D00') || ' ' || NEW.currency;
  
  INSERT INTO public.notifications (
    user_id, tenant_id, kind, title, message, priority, payload
  ) VALUES (
    v_client_user_id,
    NEW.tenant_id,
    'invoice',
    'Nouvelle facture',
    'Facture ' || NEW.invoice_number || ' de ' || v_amount_text,
    'high',
    jsonb_build_object('invoice_id', NEW.id, 'invoice_number', NEW.invoice_number, 'amount', NEW.amount)
  );
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_client_new_invoice ON public.qr_invoices;
CREATE TRIGGER trigger_notify_client_new_invoice
  AFTER INSERT ON public.qr_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_client_new_invoice();