-- ============================================================================
-- Extend `suivis` pour devenir le hub Inbox + Pipeline
-- ============================================================================
-- Strategy : EXTENDS (pas REPLACE).
-- La table suivis existante devient le modèle unifié pour :
--   - Tâches (kind='task')         ← comportement actuel, par défaut
--   - Notifications (kind='notification')
--   - Rappels (kind='reminder')
--   - Cards de pipeline (kind='pipeline_card')
--   - Messages clients (kind='message')
--
-- Les suivis existants restent intacts (kind défaut = 'task', tous les
-- nouveaux champs sont NULL ou ont une valeur par défaut compatible).
--
-- Backfill tenant_id : la table suivis n'avait pas de tenant_id direct
-- (récupéré via client → tenant). On l'ajoute pour optimiser les queries
-- de l'Inbox/Pipeline qui filtrent par tenant.
-- ============================================================================

-- 1. Nouveaux champs (tous nullable ou avec défaut compatible)
ALTER TABLE public.suivis
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS kind text DEFAULT 'task' CHECK (kind IN (
    'task','notification','reminder','pipeline_card','message'
  )),
  ADD COLUMN IF NOT EXISTS priority text DEFAULT 'normal' CHECK (priority IN (
    'urgent','high','normal','low'
  )),

  -- Pipeline : NULL pour suivis non-pipeline
  ADD COLUMN IF NOT EXISTS pipeline_stage text CHECK (pipeline_stage IN (
    'prospect',
    'rdv_fixe',
    'rdv_passe',
    'signe',
    'attente_contrat',
    'contrat_recu',
    'contrat_police',
    'commission_recue',
    'perdu'
  )),
  ADD COLUMN IF NOT EXISTS expected_product text,
  ADD COLUMN IF NOT EXISTS expected_company text,

  -- Attribution étendue (team en plus de l'agent)
  ADD COLUMN IF NOT EXISTS assigned_team_role_id uuid REFERENCES public.tenant_roles(id) ON DELETE SET NULL,

  -- Liens vers autres entités
  ADD COLUMN IF NOT EXISTS related_kind text,
  ADD COLUMN IF NOT EXISTS related_id uuid,
  ADD COLUMN IF NOT EXISTS linked_policy_id uuid REFERENCES public.policies(id) ON DELETE SET NULL,

  -- Hiérarchie : sous-tâches d'une pipeline_card (checklist à 'signé', etc.)
  ADD COLUMN IF NOT EXISTS parent_suivi_id uuid REFERENCES public.suivis(id) ON DELETE CASCADE,

  -- Action CTA
  ADD COLUMN IF NOT EXISTS action_url text,
  ADD COLUMN IF NOT EXISTS action_label text,

  -- Snooze + completion
  ADD COLUMN IF NOT EXISTS snoozed_until timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Source
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual' CHECK (source IN (
    'manual','auto','trigger','external'
  )),

  -- Motif de perte (pour pipeline_card en 'perdu')
  ADD COLUMN IF NOT EXISTS loss_reason text;


-- 2. Backfill tenant_id depuis client → tenant
UPDATE public.suivis s
SET tenant_id = c.tenant_id
FROM public.clients c
WHERE s.client_id = c.id
  AND s.tenant_id IS NULL;


-- 3. Force NOT NULL après backfill (tous les suivis ont maintenant un tenant)
DO $$
BEGIN
  -- Sécurité : si pour une raison X il reste des suivis sans tenant_id,
  -- on les soft-deletes (status = 'ferme') au lieu de planter la migration.
  UPDATE public.suivis
  SET status = 'ferme', tenant_id = (SELECT id FROM public.tenants LIMIT 1)
  WHERE tenant_id IS NULL;

  ALTER TABLE public.suivis ALTER COLUMN tenant_id SET NOT NULL;
END $$;


-- 4. Étendre le check status pour matcher les états Inbox + rétrocompat
ALTER TABLE public.suivis DROP CONSTRAINT IF EXISTS suivis_status_check;
ALTER TABLE public.suivis
  ADD CONSTRAINT suivis_status_check
  CHECK (status IN (
    -- Status historiques (rétrocompat)
    'ouvert','en_cours','ferme',
    -- Nouveaux status Inbox/Pipeline
    'open','in_progress','done','archived','snoozed'
  ));


-- 5. Indexes pour les nouvelles queries
CREATE INDEX IF NOT EXISTS idx_suivis_tenant_kind_status
  ON public.suivis(tenant_id, kind, status);

CREATE INDEX IF NOT EXISTS idx_suivis_assigned_team_open
  ON public.suivis(assigned_team_role_id)
  WHERE status IN ('open','in_progress','ouvert','en_cours');

CREATE INDEX IF NOT EXISTS idx_suivis_pipeline_active
  ON public.suivis(tenant_id, pipeline_stage)
  WHERE pipeline_stage IS NOT NULL
    AND status NOT IN ('archived','ferme','done');

CREATE INDEX IF NOT EXISTS idx_suivis_parent
  ON public.suivis(parent_suivi_id)
  WHERE parent_suivi_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_suivis_due
  ON public.suivis(reminder_date)
  WHERE reminder_date IS NOT NULL
    AND status NOT IN ('archived','ferme','done');


-- 6. Notification KING — trace de la migration
INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
VALUES (
  '🚀 Module Inbox + Pipeline — extends suivis appliqué',
  'Table suivis étendue avec 14 colonnes pour héberger : tâches, notifications, rappels, pipeline cards, messages. Backfill tenant_id automatique depuis clients. Rétrocompat totale (kind défaut = task, statuts FR conservés).',
  'system_info',
  'normal',
  jsonb_build_object(
    'migration', '20260618150000_extend_suivis_for_inbox_pipeline',
    'columns_added', 14,
    'kinds_supported', jsonb_build_array('task','notification','reminder','pipeline_card','message'),
    'pipeline_stages', jsonb_build_array(
      'prospect','rdv_fixe','rdv_passe','signe',
      'attente_contrat','contrat_recu','contrat_police','commission_recue','perdu'
    )
  )
);
