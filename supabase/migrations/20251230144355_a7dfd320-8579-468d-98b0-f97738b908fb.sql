
-- Fix security definer view - recreate with security invoker
DROP VIEW IF EXISTS public.documents_expiring_soon;

CREATE VIEW public.documents_expiring_soon 
WITH (security_invoker = true)
AS
SELECT 
  d.*,
  dr.reminder_date,
  dr.days_before,
  c.first_name || ' ' || c.last_name AS client_name,
  c.email AS client_email
FROM documents d
LEFT JOIN document_reminders dr ON dr.document_id = d.id AND dr.notification_sent = false
LEFT JOIN clients c ON d.owner_type = 'client' AND d.owner_id = c.id
WHERE d.expires_at IS NOT NULL
  AND d.expires_at <= CURRENT_DATE + INTERVAL '60 days'
ORDER BY d.expires_at ASC;
