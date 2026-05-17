-- ============================================================================
-- king_audit_log — trace les actions sensibles côté plateforme
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.king_audit_log (
  id BIGSERIAL PRIMARY KEY,

  action_type TEXT NOT NULL,    -- ex: 'tenant.suspended', 'tenant.deleted', 'tenant.plan_changed', 'tenant.impersonate', 'user.deleted', 'plan.modified'
  actor_user_id UUID REFERENCES auth.users(id),
  actor_role TEXT,               -- 'king' | 'admin' | etc.
  actor_email TEXT,

  target_type TEXT,              -- 'tenant' | 'user' | 'plan' | 'affiliate' | etc.
  target_id UUID,
  target_label TEXT,             -- nom lisible (ex: "Advisy", "admin@cabinet.ch")

  changes JSONB,                 -- { before: {...}, after: {...} }
  metadata JSONB,                -- contexte additionnel (ip, user_agent, raison...)

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_king_audit_log_period
  ON public.king_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_king_audit_log_actor
  ON public.king_audit_log(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_king_audit_log_target
  ON public.king_audit_log(target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_king_audit_log_action
  ON public.king_audit_log(action_type, created_at DESC);

COMMENT ON TABLE public.king_audit_log IS
  'Trace toutes les actions sensibles côté plateforme (suspension/suppression tenant, changement plan, impersonation, etc.) avec qui a fait quoi quand.';

-- RLS : king-only en lecture, service_role en écriture
ALTER TABLE public.king_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_log_king_select ON public.king_audit_log;
CREATE POLICY audit_log_king_select ON public.king_audit_log
  FOR SELECT TO authenticated
  USING (public.is_king());

GRANT SELECT ON public.king_audit_log TO authenticated;
GRANT INSERT ON public.king_audit_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE king_audit_log_id_seq TO service_role;
