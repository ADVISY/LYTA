-- Cleanup: orphan/half-filled client cards from earlier buggy scans.
-- These rows have either no name + no contract, or were inserted with
-- mismatched email/gender due to the field_name/extracted_value bug.
-- Removing them lets Habib retest from a clean slate.
--
-- Safe filter: only delete clients that
--   - belong to Advisy
--   - were created during the buggy window (12-13 mai 2026)
--   - AND have no policies attached (so we never destroy real contracts)
--   - AND were sourced from the ia_scan_wizard (audit_logs)
DO $$
DECLARE
  v_tenant UUID;
  v_deleted INTEGER;
BEGIN
  SELECT id INTO v_tenant FROM public.tenants WHERE slug = 'advisy';
  IF v_tenant IS NULL THEN RETURN; END IF;

  WITH targets AS (
    SELECT c.id
    FROM public.clients c
    WHERE c.tenant_id = v_tenant
      AND c.created_at >= '2026-05-12'::timestamptz
      AND c.created_at <  '2026-05-15'::timestamptz
      AND NOT EXISTS (SELECT 1 FROM public.policies p WHERE p.client_id = c.id)
  )
  DELETE FROM public.clients c
  USING targets
  WHERE c.id = targets.id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE 'Removed % polluted client cards (no policy attached, 12-14 mai)', v_deleted;
END;
$$;
