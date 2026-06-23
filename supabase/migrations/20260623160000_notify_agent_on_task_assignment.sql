-- ============================================================================
-- Trigger : créer une notification automatique quand une tâche est assignée
-- ============================================================================
-- Feedback Habib (23 juin 2026) : 'si on attribue une tâche à un agent
-- comment il le voit'.
--
-- Problème : aujourd'hui, quand on délègue une tâche (INSERT ou UPDATE de
-- assigned_agent_id sur suivis kind='task'), l'agent ne reçoit aucune
-- alerte. Il doit aller sur son dashboard pour la voir.
--
-- Solution : trigger BEFORE INSERT / AFTER UPDATE qui crée une notification
-- (kind='notification') pour l'agent assigné. Cette notif apparaît dans :
--   - Le bell-icon (badge rouge)
--   - Le widget Dashboard "Notifications & Tâches"
--
-- Comportement :
--   - INSERT d'une nouvelle tâche avec assigned_agent_id NOT NULL → notif
--   - UPDATE qui change l'assigned_agent_id (réassignation) → notif au
--     nouvel agent
--   - On évite les boucles : on ne crée pas de notif si la source est elle-même
--     'trigger' (pour ne pas spammer en cascade)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.tg_suivis_notify_on_task_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_should_notify boolean := false;
  v_client_name text;
  v_assigner_email text;
  v_assigner_name text;
BEGIN
  -- Ne s'applique qu'aux tâches (pas aux notifs/pipeline_cards)
  IF NEW.kind <> 'task' THEN
    RETURN NEW;
  END IF;

  -- Pas d'agent assigné → pas de notification
  IF NEW.assigned_agent_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Anti-spam : si la source est 'trigger', on évite de cascader
  IF NEW.source = 'trigger' THEN
    RETURN NEW;
  END IF;

  -- Déterminer si on doit notifier :
  --   - INSERT : oui si assigned_agent_id défini
  --   - UPDATE : oui si assigned_agent_id a changé
  IF TG_OP = 'INSERT' THEN
    v_should_notify := true;
  ELSIF TG_OP = 'UPDATE' THEN
    v_should_notify := (OLD.assigned_agent_id IS DISTINCT FROM NEW.assigned_agent_id);
  END IF;

  IF NOT v_should_notify THEN
    RETURN NEW;
  END IF;

  -- Récupérer le nom du client (pour contextualiser la notif)
  IF NEW.client_id IS NOT NULL THEN
    SELECT COALESCE(
      company_name,
      NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), ''),
      'Client inconnu'
    )
    INTO v_client_name
    FROM public.clients
    WHERE id = NEW.client_id;
  END IF;

  -- Récupérer l'email/nom de la personne qui assigne (pour transparence)
  SELECT email INTO v_assigner_email
  FROM auth.users
  WHERE id = COALESCE(NEW.created_by, auth.uid())
  LIMIT 1;

  v_assigner_name := SPLIT_PART(COALESCE(v_assigner_email, ''), '@', 1);

  -- Créer la notification pour l'agent assigné
  INSERT INTO public.suivis (
    tenant_id,
    client_id,
    kind,
    priority,
    status,
    title,
    description,
    assigned_agent_id,
    related_kind,
    related_id,
    action_url,
    action_label,
    source
  ) VALUES (
    NEW.tenant_id,
    NEW.client_id,
    'notification',
    CASE
      WHEN NEW.priority = 'urgent' THEN 'urgent'
      WHEN NEW.priority = 'high' THEN 'high'
      ELSE 'normal'
    END,
    'ouvert',
    CASE
      WHEN TG_OP = 'INSERT' THEN '📋 Nouvelle tâche : ' || NEW.title
      ELSE '🔄 Tâche réassignée : ' || NEW.title
    END,
    CASE
      WHEN v_client_name IS NOT NULL AND v_assigner_name IS NOT NULL THEN
        'Concerne ' || v_client_name || ' · Assignée par ' || v_assigner_name
      WHEN v_client_name IS NOT NULL THEN
        'Concerne ' || v_client_name
      WHEN v_assigner_name IS NOT NULL THEN
        'Assignée par ' || v_assigner_name
      ELSE
        NEW.description
    END,
    NEW.assigned_agent_id,
    'task',
    NEW.id,
    CASE
      WHEN NEW.client_id IS NOT NULL THEN '/crm/clients/' || NEW.client_id
      ELSE '/crm/suivis'
    END,
    'Voir la tâche',
    'trigger'
  );

  RETURN NEW;
END;
$$;


-- Trigger BEFORE INSERT OR UPDATE sur suivis
DROP TRIGGER IF EXISTS trg_suivis_notify_on_task_assignment ON public.suivis;
CREATE TRIGGER trg_suivis_notify_on_task_assignment
AFTER INSERT OR UPDATE OF assigned_agent_id ON public.suivis
FOR EACH ROW
EXECUTE FUNCTION public.tg_suivis_notify_on_task_assignment();


-- Notification KING
INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
VALUES (
  '🔔 Trigger : notif auto quand on assigne une tâche',
  'Ajout d''un trigger AFTER INSERT/UPDATE sur suivis qui crée automatiquement une notification (kind=notification) pour l''agent assigné quand on lui délègue une tâche. La notif apparaît dans le bell-icon + widget dashboard, avec contexte client + nom de la personne qui a assigné. Anti-spam : source=trigger ne déclenche pas de cascade.',
  'system_info',
  'normal',
  jsonb_build_object(
    'migration', '20260623160000_notify_agent_on_task_assignment',
    'trigger_name', 'trg_suivis_notify_on_task_assignment',
    'visible_in', jsonb_build_array('bell-icon', 'dashboard_widget')
  )
);
