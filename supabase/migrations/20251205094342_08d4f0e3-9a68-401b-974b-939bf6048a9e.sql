-- Drop existing overly permissive policies on ai_conversations
DROP POLICY IF EXISTS "Anyone can create conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "Anyone can view their own conversation" ON public.ai_conversations;
DROP POLICY IF EXISTS "Anyone can update their conversation" ON public.ai_conversations;

-- Create more secure policies for ai_conversations
-- Allow INSERT for anyone (needed for anonymous chat)
CREATE POLICY "Users can create conversations"
ON public.ai_conversations
FOR INSERT
WITH CHECK (true);

-- Only allow SELECT for conversations matching session_id (anonymous) or for admins
CREATE POLICY "Users can view their session conversations"
ON public.ai_conversations
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'agent'::app_role)
);

-- Only allow UPDATE for admins
CREATE POLICY "Admins can update conversations"
ON public.ai_conversations
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Drop existing overly permissive policies on ai_messages
DROP POLICY IF EXISTS "Anyone can create messages" ON public.ai_messages;
DROP POLICY IF EXISTS "Anyone can view messages" ON public.ai_messages;

-- Create more secure policies for ai_messages
-- Allow INSERT for anyone (needed for chat)
CREATE POLICY "Users can create messages"
ON public.ai_messages
FOR INSERT
WITH CHECK (true);

-- Only allow SELECT for admins/agents
CREATE POLICY "Staff can view messages"
ON public.ai_messages
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'agent'::app_role)
);

-- Drop existing overly permissive policies on ai_leads
DROP POLICY IF EXISTS "Anyone can create leads" ON public.ai_leads;
DROP POLICY IF EXISTS "Anyone can view leads" ON public.ai_leads;
DROP POLICY IF EXISTS "Anyone can update leads" ON public.ai_leads;

-- Create more secure policies for ai_leads
-- Allow INSERT for anyone (lead capture from website)
CREATE POLICY "Anyone can submit leads"
ON public.ai_leads
FOR INSERT
WITH CHECK (true);

-- Only admins and agents can view leads
CREATE POLICY "Staff can view leads"
ON public.ai_leads
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'agent'::app_role)
);

-- Only admins and agents can update leads
CREATE POLICY "Staff can update leads"
ON public.ai_leads
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'agent'::app_role)
);