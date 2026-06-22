-- ============================================================================
-- Pipeline : auto-assigne l'agent du client à l'opportunité
-- ============================================================================
-- Problème : les opportunités créées sans agent explicite affichent
-- "Non assigné" sur le Kanban, alors que le client a un agent dans sa fiche.
--
-- Solution :
-- 1. Backfill des opps existantes (kind='pipeline_card') :
--    - On résout clients.assigned_agent_id (qui pointe vers un client
--      de type 'collaborateur')
--    - Puis on prend le user_id de ce collaborateur
--    - On stocke dans suivis.assigned_agent_id (FK vers profiles)
--
-- 2. Trigger BEFORE INSERT sur suivis pour pipeline_card :
--    Si assigned_agent_id est null à la création, on auto-remplit avec
--    le user_id de l'agent du client (même résolution).
--
-- ⚠️ Sécurité : aucun impact RLS. On ne fait que résoudre une FK existante.
-- ============================================================================


-- 1. BACKFILL des opportunités existantes
-- ───────────────────────────────────────────────────────────────────────────
UPDATE public.suivis s
SET assigned_agent_id = agent.user_id
FROM public.clients client_row
JOIN public.clients agent ON agent.id = client_row.assigned_agent_id
WHERE s.client_id = client_row.id
  AND s.kind = 'pipeline_card'
  AND s.assigned_agent_id IS NULL
  AND agent.user_id IS NOT NULL;


-- 2. FONCTION TRIGGER pour les futures insertions
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_suivis_auto_assign_agent_from_client()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_agent_user_id uuid;
BEGIN
  -- Ne s'applique qu'aux pipeline_card sans agent explicite
  IF NEW.kind <> 'pipeline_card' THEN
    RETURN NEW;
  END IF;
  IF NEW.assigned_agent_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Résout l'agent du client (clients.assigned_agent_id → collab.user_id)
  SELECT agent.user_id
  INTO v_agent_user_id
  FROM public.clients client_row
  JOIN public.clients agent ON agent.id = client_row.assigned_agent_id
  WHERE client_row.id = NEW.client_id;

  IF v_agent_user_id IS NOT NULL THEN
    NEW.assigned_agent_id := v_agent_user_id;
  END IF;

  RETURN NEW;
END;
$$;


-- 3. TRIGGER attaché à la table suivis
-- ───────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_suivis_auto_assign_agent ON public.suivis;
CREATE TRIGGER trg_suivis_auto_assign_agent
BEFORE INSERT ON public.suivis
FOR EACH ROW
EXECUTE FUNCTION public.tg_suivis_auto_assign_agent_from_client();


-- 4. Notification KING
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
VALUES (
  '🔧 Pipeline : auto-assignation agent depuis client',
  'Backfill + trigger BEFORE INSERT ajouté. Les opportunités pipeline_card sans agent explicite récupèrent maintenant automatiquement l''agent du client à la création.',
  'system_info',
  'normal',
  jsonb_build_object(
    'migration', '20260622140000_pipeline_auto_assign_agent_from_client',
    'trigger_name', 'trg_suivis_auto_assign_agent',
    'fallback_resolution', 'clients.assigned_agent_id → clients.user_id (collab) → suivis.assigned_agent_id'
  )
);
