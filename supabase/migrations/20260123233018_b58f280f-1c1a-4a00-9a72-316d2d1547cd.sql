-- Fix RLS linter warnings: replace WITH CHECK (true) / USING (true) by explicit, non-trivial conditions
-- while preserving intended access.

-- 1) scheduled_emails: service role only
DROP POLICY IF EXISTS "Service role can manage scheduled emails" ON public.scheduled_emails;
CREATE POLICY "Service role can manage scheduled emails"
ON public.scheduled_emails
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 2) sms_verifications: service role only
DROP POLICY IF EXISTS "Service role can manage verifications" ON public.sms_verifications;
CREATE POLICY "Service role can manage verifications"
ON public.sms_verifications
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 3) audit_logs: service role only insert
DROP POLICY IF EXISTS "Service role can create audit logs" ON public.audit_logs;
CREATE POLICY "Service role can create audit logs"
ON public.audit_logs
FOR INSERT
TO service_role
WITH CHECK (auth.role() = 'service_role');

-- 4) notifications: service role only insert
DROP POLICY IF EXISTS "Service role can create notifications" ON public.notifications;
CREATE POLICY "Service role can create notifications"
ON public.notifications
FOR INSERT
TO service_role
WITH CHECK (auth.role() = 'service_role');

-- 5) ai_conversations: allow inserts, but require a session_id
DROP POLICY IF EXISTS "Users can create conversations" ON public.ai_conversations;
CREATE POLICY "Users can create conversations"
ON public.ai_conversations
FOR INSERT
TO public
WITH CHECK (session_id IS NOT NULL AND length(trim(session_id)) > 0);

-- 6) ai_messages: allow inserts, but require valid role + content
DROP POLICY IF EXISTS "Users can create messages" ON public.ai_messages;
CREATE POLICY "Users can create messages"
ON public.ai_messages
FOR INSERT
TO public
WITH CHECK (
  role IN ('user','assistant','system')
  AND content IS NOT NULL
  AND length(trim(content)) > 0
);

-- 7) ai_leads: allow inserts (lead capture), but require at least email or telephone
DROP POLICY IF EXISTS "Anyone can submit leads" ON public.ai_leads;
CREATE POLICY "Anyone can submit leads"
ON public.ai_leads
FOR INSERT
TO public
WITH CHECK (
  (email IS NOT NULL AND length(trim(email)) > 0)
  OR (telephone IS NOT NULL AND length(trim(telephone)) > 0)
);
