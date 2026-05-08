-- ============================================================================
-- Migration : Système de dispatch des notifications STAFF (admin/manager/agent)
-- ============================================================================
--
-- CONTEXTE
-- --------
-- Avant cette migration, les triggers de notification staff (notify_on_new_client,
-- notify_on_new_policy, etc.) avaient deux bugs majeurs :
--
--   1. Destinataire aberrant : ils envoyaient toujours à
--      `SELECT user_id FROM user_roles WHERE role='admin' LIMIT 1`
--      => 1 seul admin "global" recevait les notifs de TOUS les tenants.
--
--   2. Pas de logique hiérarchique : ni le manager de l'agent, ni l'agent
--      assigné, ni les autres admins du tenant n'étaient notifiés.
--
-- OBJECTIF
-- --------
-- Mettre en place un système propre de dispatch staff selon la hiérarchie :
--
--   - Admin    + Backoffice du tenant  → reçoivent TOUTES les notifs du tenant
--   - Manager  (de l'agent assigné)    → reçoit les notifs liées à un client
--                                         dont l'agent est sous sa responsabilité
--   - Agent    (assigné au client)     → reçoit les notifs de son portefeuille
--
-- LIEN AGENT/MANAGER
--   - clients.assigned_agent_id pointe vers un clients.id (de type collaborateur)
--   - clients.manager_id pointe également vers un clients.id (collaborateur)
--   - chaque collaborateur a son propre user_id lié à auth.users
--
-- EFFETS DE BORD
-- --------------
-- - Les triggers CLIENT (notify_client_new_policy, notify_client_new_document,
--   notify_client_claim_status, notify_client_new_message, notify_client_new_invoice)
--   ne sont PAS touchés. Ils continuent à notifier le client final.
--
-- - Les anciens triggers staff sont DROP et remplacés. Aucune notification
--   existante n'est supprimée — seules les fonctions/triggers sont remplacés.
--
-- - Une notif staff est insérée pour CHAQUE destinataire (1 ligne par user
--   concerné). C'est la stratégie multi-destinataires (vs vue hiérarchique
--   qui serait plus complexe en RLS).
--
-- ROLLBACK
-- --------
-- Pour rollback : DROP les nouvelles fonctions/triggers et restaurer les
-- anciennes versions depuis la migration 20251230151515.
-- ============================================================================


-- ============================================================================
-- 1. Fonction utilitaire centrale : dispatch_staff_notification
-- ============================================================================
-- Insère N notifications selon la hiérarchie staff définie ci-dessus.
-- Doit être appelée par les triggers métier.
--
-- Paramètres :
--   p_tenant_id          UUID    tenant concerné (obligatoire)
--   p_kind               TEXT    'success', 'info', 'warning', 'error'...
--   p_title              TEXT    titre court
--   p_message            TEXT    message détaillé
--   p_priority           TEXT    'low' | 'normal' | 'high' | 'urgent'
--   p_action_url         TEXT    URL de navigation au clic (peut être NULL)
--   p_payload            JSONB   données additionnelles
--   p_related_client_id  UUID    client/prospect concerné par l'événement
--                                (NULL pour les événements globaux comme
--                                 nouveau collaborateur ou nouveau partenaire)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.dispatch_staff_notification(
  p_tenant_id          UUID,
  p_kind               TEXT,
  p_title              TEXT,
  p_message            TEXT,
  p_priority           TEXT    DEFAULT 'normal',
  p_action_url         TEXT    DEFAULT NULL,
  p_payload            JSONB   DEFAULT '{}'::jsonb,
  p_related_client_id  UUID    DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_recipients UUID[];
  v_agent_user_id UUID;
  v_manager_user_id UUID;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE WARNING 'dispatch_staff_notification appelé sans tenant_id';
    RETURN;
  END IF;

  -- a) Tous les admins + backoffice du tenant
  SELECT COALESCE(array_agg(DISTINCT uta.user_id), ARRAY[]::UUID[])
    INTO v_recipients
  FROM public.user_tenant_assignments uta
  JOIN public.user_roles ur ON ur.user_id = uta.user_id
  WHERE uta.tenant_id = p_tenant_id
    AND ur.role IN ('admin', 'backoffice');

  -- b) Si l'événement concerne un client → on remonte agent + manager
  IF p_related_client_id IS NOT NULL THEN
    -- agent assigné (un collaborateur a un user_id)
    SELECT agent.user_id INTO v_agent_user_id
    FROM public.clients c
    JOIN public.clients agent ON agent.id = c.assigned_agent_id
    WHERE c.id = p_related_client_id
      AND agent.user_id IS NOT NULL
    LIMIT 1;

    IF v_agent_user_id IS NOT NULL THEN
      v_recipients := array_append(v_recipients, v_agent_user_id);
    END IF;

    -- manager de l'agent
    SELECT mgr.user_id INTO v_manager_user_id
    FROM public.clients c
    JOIN public.clients agent ON agent.id = c.assigned_agent_id
    JOIN public.clients mgr   ON mgr.id   = agent.manager_id
    WHERE c.id = p_related_client_id
      AND mgr.user_id IS NOT NULL
    LIMIT 1;

    IF v_manager_user_id IS NOT NULL THEN
      v_recipients := array_append(v_recipients, v_manager_user_id);
    END IF;
  END IF;

  -- c) Insertion : une notif par destinataire unique non null
  IF v_recipients IS NOT NULL AND array_length(v_recipients, 1) > 0 THEN
    INSERT INTO public.notifications (
      user_id, tenant_id, kind, title, message, priority, action_url, payload
    )
    SELECT DISTINCT uid, p_tenant_id, p_kind, p_title, p_message, p_priority, p_action_url, p_payload
    FROM unnest(v_recipients) AS uid
    WHERE uid IS NOT NULL;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.dispatch_staff_notification IS
  'Dispatch de notifications staff selon la hiérarchie admin/backoffice/manager/agent. Voir migration 20260427120000.';


-- ============================================================================
-- 2. Suppression des anciens triggers/fonctions buggés (single global admin)
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_notify_new_client       ON public.clients;
DROP TRIGGER IF EXISTS trigger_notify_new_policy       ON public.policies;
DROP TRIGGER IF EXISTS trigger_notify_policy_status    ON public.policies;
DROP TRIGGER IF EXISTS trigger_notify_new_commission   ON public.commissions;
DROP TRIGGER IF EXISTS trigger_notify_commission_status ON public.commissions;

DROP FUNCTION IF EXISTS public.notify_on_new_client();
DROP FUNCTION IF EXISTS public.notify_on_new_policy();
DROP FUNCTION IF EXISTS public.notify_on_policy_status_change();
DROP FUNCTION IF EXISTS public.notify_on_new_commission();
DROP FUNCTION IF EXISTS public.notify_on_commission_status_change();


-- ============================================================================
-- 3. Nouveaux triggers staff
-- ============================================================================

-- ---- 3.1 Nouveau client / collaborateur / partenaire ----
CREATE OR REPLACE FUNCTION public.notify_staff_on_new_address()
RETURNS TRIGGER AS $$
DECLARE
  v_name TEXT;
BEGIN
  v_name := TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));
  IF v_name = '' THEN
    v_name := COALESCE(NEW.company_name, 'Sans nom');
  END IF;

  IF NEW.type_adresse = 'client' THEN
    PERFORM public.dispatch_staff_notification(
      NEW.tenant_id,
      'success',
      'Nouveau client',
      v_name || ' a été ajouté au CRM',
      'normal',
      '/crm/clients/' || NEW.id,
      jsonb_build_object('client_id', NEW.id, 'event', 'new_client', 'status', NEW.status),
      NEW.id
    );
  ELSIF NEW.type_adresse = 'collaborateur' THEN
    PERFORM public.dispatch_staff_notification(
      NEW.tenant_id,
      'info',
      'Nouveau collaborateur',
      v_name || ' a rejoint l''équipe',
      'normal',
      '/crm/clients/' || NEW.id,
      jsonb_build_object('collaborator_id', NEW.id, 'event', 'new_collaborator'),
      NULL  -- événement RH global, pas de client associé
    );
  ELSIF NEW.type_adresse = 'partenaire' THEN
    PERFORM public.dispatch_staff_notification(
      NEW.tenant_id,
      'info',
      'Nouveau partenaire',
      v_name || ' a été ajouté comme partenaire',
      'normal',
      '/crm/clients/' || NEW.id,
      jsonb_build_object('partner_id', NEW.id, 'event', 'new_partner'),
      NULL
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_notify_staff_new_address
AFTER INSERT ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.notify_staff_on_new_address();


-- ---- 3.2 Nouveau contrat / police signée ----
CREATE OR REPLACE FUNCTION public.notify_staff_on_new_policy()
RETURNS TRIGGER AS $$
DECLARE
  v_client_name TEXT;
  v_product TEXT;
BEGIN
  SELECT TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
    INTO v_client_name
  FROM public.clients
  WHERE id = NEW.client_id;

  IF v_client_name IS NULL OR v_client_name = '' THEN
    v_client_name := 'client';
  END IF;

  v_product := COALESCE(NEW.product_type, 'contrat');

  PERFORM public.dispatch_staff_notification(
    NEW.tenant_id,
    'success',
    'Nouveau contrat signé',
    v_product || ' pour ' || v_client_name,
    'normal',
    '/crm/clients/' || NEW.client_id,
    jsonb_build_object('policy_id', NEW.id, 'client_id', NEW.client_id, 'event', 'new_policy'),
    NEW.client_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_notify_staff_new_policy
AFTER INSERT ON public.policies
FOR EACH ROW EXECUTE FUNCTION public.notify_staff_on_new_policy();


-- ---- 3.3 Changement de statut contrat ----
CREATE OR REPLACE FUNCTION public.notify_staff_on_policy_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_client_name TEXT;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
    INTO v_client_name
  FROM public.clients
  WHERE id = NEW.client_id;

  IF v_client_name IS NULL OR v_client_name = '' THEN
    v_client_name := 'client';
  END IF;

  IF NEW.status = 'cancelled' THEN
    PERFORM public.dispatch_staff_notification(
      NEW.tenant_id,
      'warning',
      'Contrat annulé',
      'Le contrat de ' || v_client_name || ' a été annulé',
      'high',
      '/crm/clients/' || NEW.client_id,
      jsonb_build_object('policy_id', NEW.id, 'client_id', NEW.client_id, 'event', 'policy_cancelled'),
      NEW.client_id
    );
  ELSIF NEW.status = 'active' AND OLD.status = 'pending' THEN
    PERFORM public.dispatch_staff_notification(
      NEW.tenant_id,
      'success',
      'Contrat activé',
      'Le contrat de ' || v_client_name || ' est maintenant actif',
      'normal',
      '/crm/clients/' || NEW.client_id,
      jsonb_build_object('policy_id', NEW.id, 'client_id', NEW.client_id, 'event', 'policy_activated'),
      NEW.client_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_notify_staff_policy_status
AFTER UPDATE ON public.policies
FOR EACH ROW EXECUTE FUNCTION public.notify_staff_on_policy_status_change();


-- ---- 3.4 Nouvelle commission ----
CREATE OR REPLACE FUNCTION public.notify_staff_on_new_commission()
RETURNS TRIGGER AS $$
DECLARE
  v_client_id UUID;
  v_amount TEXT;
BEGIN
  v_amount := TO_CHAR(COALESCE(NEW.amount, 0), 'FM999G999D00') || ' CHF';

  -- on remonte le client via la policy si possible (pour router vers agent/manager)
  IF NEW.policy_id IS NOT NULL THEN
    SELECT client_id INTO v_client_id FROM public.policies WHERE id = NEW.policy_id;
  END IF;

  PERFORM public.dispatch_staff_notification(
    NEW.tenant_id,
    'info',
    'Nouvelle commission',
    'Commission de ' || v_amount || ' enregistrée',
    'normal',
    '/crm/commissions',
    jsonb_build_object('commission_id', NEW.id, 'policy_id', NEW.policy_id, 'event', 'new_commission'),
    v_client_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_notify_staff_new_commission
AFTER INSERT ON public.commissions
FOR EACH ROW EXECUTE FUNCTION public.notify_staff_on_new_commission();


-- ---- 3.5 Commission payée ----
CREATE OR REPLACE FUNCTION public.notify_staff_on_commission_paid()
RETURNS TRIGGER AS $$
DECLARE
  v_client_id UUID;
  v_amount TEXT;
BEGIN
  IF NEW.status = OLD.status OR NEW.status <> 'paid' THEN
    RETURN NEW;
  END IF;

  v_amount := TO_CHAR(COALESCE(NEW.amount, 0), 'FM999G999D00') || ' CHF';

  IF NEW.policy_id IS NOT NULL THEN
    SELECT client_id INTO v_client_id FROM public.policies WHERE id = NEW.policy_id;
  END IF;

  PERFORM public.dispatch_staff_notification(
    NEW.tenant_id,
    'success',
    'Commission payée',
    'Commission de ' || v_amount || ' marquée comme payée',
    'normal',
    '/crm/commissions',
    jsonb_build_object('commission_id', NEW.id, 'policy_id', NEW.policy_id, 'event', 'commission_paid'),
    v_client_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_notify_staff_commission_paid
AFTER UPDATE ON public.commissions
FOR EACH ROW EXECUTE FUNCTION public.notify_staff_on_commission_paid();


-- ---- 3.6 Nouveau sinistre déclaré (côté staff) ----
-- Note : le trigger CLIENT notify_client_claim_status existe déjà pour notifier
-- le client. Ici on ajoute un trigger STAFF complémentaire pour informer
-- l'équipe lorsqu'un nouveau sinistre est créé.
CREATE OR REPLACE FUNCTION public.notify_staff_on_new_claim()
RETURNS TRIGGER AS $$
DECLARE
  v_client_name TEXT;
BEGIN
  SELECT TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
    INTO v_client_name
  FROM public.clients
  WHERE id = NEW.client_id;

  IF v_client_name IS NULL OR v_client_name = '' THEN
    v_client_name := 'client';
  END IF;

  PERFORM public.dispatch_staff_notification(
    NEW.tenant_id,
    'warning',
    'Nouveau sinistre déclaré',
    v_client_name || ' a déclaré un sinistre',
    'high',
    '/crm/sinistres/' || NEW.id,
    jsonb_build_object('claim_id', NEW.id, 'client_id', NEW.client_id, 'event', 'new_claim'),
    NEW.client_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_notify_staff_new_claim ON public.claims;
CREATE TRIGGER trigger_notify_staff_new_claim
AFTER INSERT ON public.claims
FOR EACH ROW EXECUTE FUNCTION public.notify_staff_on_new_claim();


-- ---- 3.7 Document déposé par un client (côté staff) ----
-- Note : notify_client_new_document notifie déjà le client. On ajoute un
-- trigger staff complémentaire pour que l'agent/manager soient au courant.
CREATE OR REPLACE FUNCTION public.notify_staff_on_new_document()
RETURNS TRIGGER AS $$
DECLARE
  v_client_id UUID;
  v_client_name TEXT;
BEGIN
  -- On ne s'intéresse qu'aux documents liés à un client (owner_type='client')
  IF NEW.owner_type IS NULL OR NEW.owner_type <> 'client' THEN
    RETURN NEW;
  END IF;

  v_client_id := NEW.owner_id;

  SELECT TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
    INTO v_client_name
  FROM public.clients
  WHERE id = v_client_id;

  IF v_client_name IS NULL OR v_client_name = '' THEN
    v_client_name := 'client';
  END IF;

  PERFORM public.dispatch_staff_notification(
    NEW.tenant_id,
    'info',
    'Nouveau document client',
    'Document ajouté pour ' || v_client_name || ' : ' || COALESCE(NEW.file_name, 'sans nom'),
    'normal',
    '/crm/clients/' || v_client_id,
    jsonb_build_object('document_id', NEW.id, 'client_id', v_client_id, 'event', 'new_document'),
    v_client_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_notify_staff_new_document ON public.documents;
CREATE TRIGGER trigger_notify_staff_new_document
AFTER INSERT ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.notify_staff_on_new_document();


-- ============================================================================
-- FIN DE MIGRATION
-- ============================================================================
-- Pour vérifier le bon fonctionnement après application :
--
--   1. Insérer un nouveau client de test sur un tenant
--      → vérifier qu'une notif arrive pour TOUS les admins+backoffice du tenant
--      → vérifier qu'une notif arrive pour l'agent assigné (si défini)
--      → vérifier qu'une notif arrive pour le manager de cet agent (si défini)
--
--   2. Aucune notif ne doit arriver à des admins d'AUTRES tenants
--
--   3. Les triggers CLIENT (notify_client_*) restent intacts
-- ============================================================================
