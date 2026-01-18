-- Fix suivis.status values: align DB constraint with frontend values (no accent)

-- 1) Normalize existing data (in case some rows already use the accented variant)
UPDATE public.suivis
SET status = 'ferme'
WHERE status = 'fermé';

-- 2) Update CHECK constraint to accept the frontend values: ouvert | en_cours | ferme
ALTER TABLE public.suivis
DROP CONSTRAINT IF EXISTS suivis_status_check;

ALTER TABLE public.suivis
ADD CONSTRAINT suivis_status_check
CHECK (status = ANY (ARRAY['ouvert'::text, 'en_cours'::text, 'ferme'::text]));

-- 3) Fix reminder scheduler logic (was using 'completed' which isn't a valid status)
CREATE OR REPLACE FUNCTION public.schedule_follow_up_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Programmer les rappels de suivi
  INSERT INTO public.scheduled_emails (tenant_id, email_type, target_type, target_id, scheduled_for)
  SELECT 
    s.tenant_id,
    'follow_up',
    'suivi',
    s.id,
    s.reminder_date
  FROM public.suivis s
  JOIN public.tenant_email_automation tea ON tea.tenant_id = s.tenant_id
  WHERE s.reminder_date IS NOT NULL
    AND s.status != 'ferme'
    AND tea.enable_follow_up_reminder = true
    AND s.reminder_date > now()
    AND NOT EXISTS (
      SELECT 1 FROM public.scheduled_emails se 
      WHERE se.target_id = s.id 
        AND se.email_type = 'follow_up'
        AND se.status IN ('pending', 'sent')
    );
END;
$function$;