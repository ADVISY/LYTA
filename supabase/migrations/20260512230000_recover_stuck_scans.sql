-- ============================================================================
-- One-shot recovery: scans stuck in 'processing' > 5 min → marked failed
-- ============================================================================
-- The Edge function should always conclude with status='completed' or
-- status='failed', but a runtime crash can leave a scan stuck in
-- 'processing' indefinitely. This pass releases anything older than 5 min
-- so the broker can re-launch a fresh scan.
-- ============================================================================

UPDATE public.document_scans
SET status = 'failed',
    error_message = COALESCE(error_message, 'Recovered from stuck processing state'),
    updated_at = now()
WHERE status = 'processing'
  AND created_at < now() - interval '5 minutes';
