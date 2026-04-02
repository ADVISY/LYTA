-- Function to create notification on new client
CREATE OR REPLACE FUNCTION public.notify_on_new_client()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_client_name TEXT;
BEGIN
  -- Get admin user for notifications (first user with admin role)
  SELECT user_id INTO v_user_id FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  v_client_name := COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, '');
  v_client_name := TRIM(v_client_name);
  
  IF v_client_name = '' THEN
    v_client_name := COALESCE(NEW.company_name, 'Client');
  END IF;
  
  IF NEW.type_adresse = 'client' THEN
    INSERT INTO public.notifications (user_id, kind, title, message, tenant_id)
    VALUES (v_user_id, 'success', 'Nouveau client créé', v_client_name || ' a été ajouté au CRM', NEW.tenant_id);
  ELSIF NEW.type_adresse = 'collaborateur' THEN
    INSERT INTO public.notifications (user_id, kind, title, message, tenant_id)
    VALUES (v_user_id, 'info', 'Nouveau collaborateur', v_client_name || ' a rejoint l''équipe', NEW.tenant_id);
  ELSIF NEW.type_adresse = 'partenaire' THEN
    INSERT INTO public.notifications (user_id, kind, title, message, tenant_id)
    VALUES (v_user_id, 'info', 'Nouveau partenaire', v_client_name || ' a été ajouté comme partenaire', NEW.tenant_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for new clients
DROP TRIGGER IF EXISTS trigger_notify_new_client ON public.clients;
CREATE TRIGGER trigger_notify_new_client
  AFTER INSERT ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_new_client();

-- Function to create notification on new policy
CREATE OR REPLACE FUNCTION public.notify_on_new_policy()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_client_name TEXT;
  v_product_type TEXT;
BEGIN
  -- Get admin user for notifications
  SELECT user_id INTO v_user_id FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get client name
  SELECT COALESCE(first_name, '') || ' ' || COALESCE(last_name, '') INTO v_client_name
  FROM public.clients WHERE id = NEW.client_id;
  v_client_name := TRIM(v_client_name);
  
  v_product_type := COALESCE(NEW.product_type, 'contrat');
  
  INSERT INTO public.notifications (user_id, kind, title, message, tenant_id)
  VALUES (v_user_id, 'success', 'Nouveau contrat signé', 'Contrat ' || v_product_type || ' pour ' || v_client_name, NEW.tenant_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for new policies
DROP TRIGGER IF EXISTS trigger_notify_new_policy ON public.policies;
CREATE TRIGGER trigger_notify_new_policy
  AFTER INSERT ON public.policies
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_new_policy();

-- Function to create notification on policy status change
CREATE OR REPLACE FUNCTION public.notify_on_policy_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_client_name TEXT;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- Get admin user for notifications
  SELECT user_id INTO v_user_id FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get client name
  SELECT COALESCE(first_name, '') || ' ' || COALESCE(last_name, '') INTO v_client_name
  FROM public.clients WHERE id = NEW.client_id;
  v_client_name := TRIM(v_client_name);
  
  IF NEW.status = 'cancelled' THEN
    INSERT INTO public.notifications (user_id, kind, title, message, tenant_id)
    VALUES (v_user_id, 'warning', 'Contrat annulé', 'Le contrat de ' || v_client_name || ' a été annulé', NEW.tenant_id);
  ELSIF NEW.status = 'active' AND OLD.status = 'pending' THEN
    INSERT INTO public.notifications (user_id, kind, title, message, tenant_id)
    VALUES (v_user_id, 'success', 'Contrat activé', 'Le contrat de ' || v_client_name || ' est maintenant actif', NEW.tenant_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for policy status changes
DROP TRIGGER IF EXISTS trigger_notify_policy_status ON public.policies;
CREATE TRIGGER trigger_notify_policy_status
  AFTER UPDATE ON public.policies
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_policy_status_change();

-- Function to create notification on new commission
CREATE OR REPLACE FUNCTION public.notify_on_new_commission()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_amount TEXT;
BEGIN
  -- Get admin user for notifications
  SELECT user_id INTO v_user_id FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  v_amount := TO_CHAR(NEW.amount, 'FM999G999D00');
  
  IF NEW.status = 'paid' THEN
    INSERT INTO public.notifications (user_id, kind, title, message, tenant_id)
    VALUES (v_user_id, 'success', 'Commission payée', 'Commission de ' || v_amount || ' CHF reçue', NEW.tenant_id);
  ELSE
    INSERT INTO public.notifications (user_id, kind, title, message, tenant_id)
    VALUES (v_user_id, 'info', 'Nouvelle commission', 'Nouvelle commission de ' || v_amount || ' CHF en attente', NEW.tenant_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for new commissions
DROP TRIGGER IF EXISTS trigger_notify_new_commission ON public.commissions;
CREATE TRIGGER trigger_notify_new_commission
  AFTER INSERT ON public.commissions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_new_commission();

-- Function to create notification on commission status change
CREATE OR REPLACE FUNCTION public.notify_on_commission_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_amount TEXT;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- Get admin user for notifications
  SELECT user_id INTO v_user_id FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  v_amount := TO_CHAR(NEW.amount, 'FM999G999D00');
  
  IF NEW.status = 'paid' AND OLD.status != 'paid' THEN
    INSERT INTO public.notifications (user_id, kind, title, message, tenant_id)
    VALUES (v_user_id, 'success', 'Commission payée', 'Commission de ' || v_amount || ' CHF payée', NEW.tenant_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for commission status changes
DROP TRIGGER IF EXISTS trigger_notify_commission_status ON public.commissions;
CREATE TRIGGER trigger_notify_commission_status
  AFTER UPDATE ON public.commissions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_commission_status_change();