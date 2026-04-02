-- Function to call edge function for client notification emails
CREATE OR REPLACE FUNCTION public.send_client_notification_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client_id UUID;
  v_is_client_notification BOOLEAN := false;
BEGIN
  -- Only process notifications for client users (those with client records)
  -- Check if this notification is for a client portal event
  IF NEW.kind IN ('contract', 'document', 'claim', 'message', 'invoice') THEN
    -- Check if the user has a client record
    SELECT c.id INTO v_client_id
    FROM public.clients c
    WHERE c.user_id = NEW.user_id
    LIMIT 1;
    
    IF v_client_id IS NOT NULL THEN
      v_is_client_notification := true;
    END IF;
  END IF;
  
  -- If this is a client notification, schedule email sending via edge function
  IF v_is_client_notification THEN
    -- Use pg_net extension to call edge function asynchronously (if available)
    -- For now, we'll just log that an email should be sent
    -- The actual email will be triggered via application code
    RAISE NOTICE 'Client notification created: % for client %', NEW.kind, v_client_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Note: The actual email sending is handled by calling the edge function from the frontend
-- when the notification trigger fires. The triggers we created earlier insert into notifications table,
-- and the frontend useNotifications hook will handle calling the email edge function.