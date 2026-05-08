-- ============================================================================
-- Add 'pacsé' to civil_status accepted values
-- ============================================================================
--
-- Migration 20251118170043 set:
--   CHECK (civil_status IN ('célibataire', 'marié', 'divorcé', 'séparé', 'veuf'))
--
-- We extend it to also accept 'pacsé' (legal civil union, very common in
-- French-speaking Switzerland and France).
-- ============================================================================

-- Drop the old CHECK by name (auto-generated name based on column)
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_civil_status_check;

-- Recreate with the extended value list
ALTER TABLE public.clients
  ADD CONSTRAINT clients_civil_status_check
  CHECK (
    civil_status IS NULL
    OR civil_status IN ('célibataire', 'marié', 'pacsé', 'divorcé', 'séparé', 'veuf')
  );
