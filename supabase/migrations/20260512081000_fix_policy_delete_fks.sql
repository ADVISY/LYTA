-- ============================================================================
-- Fix policy deletion: relax foreign keys that silently block DELETE
-- ============================================================================
-- Two child tables reference policies(id) without an ON DELETE clause, so
-- deleting a policy with any linked row raises a FK violation that the
-- frontend reports as a generic "Impossible de supprimer".
--
-- We switch both FKs to ON DELETE SET NULL — historical accounting rows
-- (retrocommissions, decompte_lines) are preserved with policy_id = NULL,
-- which is the standard pattern for accounting data when the source contract
-- is removed.
-- ============================================================================

-- retrocommissions
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.retrocommissions'::regclass
    AND contype = 'f'
    AND pg_get_constraintdef(oid) LIKE '%policy_id%REFERENCES public.policies%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.retrocommissions DROP CONSTRAINT %I', v_constraint_name);
  END IF;
  ALTER TABLE public.retrocommissions DROP CONSTRAINT IF EXISTS retrocommissions_policy_id_fkey;

  ALTER TABLE public.retrocommissions
    ADD CONSTRAINT retrocommissions_policy_id_fkey
    FOREIGN KEY (policy_id) REFERENCES public.policies(id) ON DELETE SET NULL;
END;
$$;

-- decompte_lines
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.decompte_lines'::regclass
    AND contype = 'f'
    AND pg_get_constraintdef(oid) LIKE '%policy_id%REFERENCES public.policies%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.decompte_lines DROP CONSTRAINT %I', v_constraint_name);
  END IF;
  ALTER TABLE public.decompte_lines DROP CONSTRAINT IF EXISTS decompte_lines_policy_id_fkey;

  ALTER TABLE public.decompte_lines
    ADD CONSTRAINT decompte_lines_policy_id_fkey
    FOREIGN KEY (policy_id) REFERENCES public.policies(id) ON DELETE SET NULL;
END;
$$;

-- commissions (most common cause of delete failure)
DO $$
DECLARE
  v_constraint_name TEXT;
  v_def TEXT;
BEGIN
  SELECT conname, pg_get_constraintdef(oid) INTO v_constraint_name, v_def
  FROM pg_constraint
  WHERE conrelid = 'public.commissions'::regclass
    AND contype = 'f'
    AND pg_get_constraintdef(oid) LIKE '%policy_id%REFERENCES public.policies%';

  IF v_constraint_name IS NOT NULL AND v_def NOT LIKE '%ON DELETE%' THEN
    EXECUTE format('ALTER TABLE public.commissions DROP CONSTRAINT %I', v_constraint_name);
    ALTER TABLE public.commissions
      ADD CONSTRAINT commissions_policy_id_fkey
      FOREIGN KEY (policy_id) REFERENCES public.policies(id) ON DELETE SET NULL;
  END IF;
END;
$$;
