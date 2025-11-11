-- Create table for storing chat conversations
CREATE TABLE public.ai_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_type TEXT CHECK (user_type IN ('client', 'conseiller', 'unknown')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for storing individual messages
CREATE TABLE public.ai_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for qualified leads
CREATE TABLE public.ai_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  nom TEXT,
  prenom TEXT,
  email TEXT,
  telephone TEXT,
  canton TEXT,
  situation_familiale TEXT,
  notes TEXT,
  status TEXT DEFAULT 'nouveau' CHECK (status IN ('nouveau', 'contacte', 'converti', 'archive')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_leads ENABLE ROW LEVEL SECURITY;

-- Public access policies (no authentication required for the chat)
CREATE POLICY "Anyone can create conversations"
  ON public.ai_conversations
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view their own conversation"
  ON public.ai_conversations
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can update their conversation"
  ON public.ai_conversations
  FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can create messages"
  ON public.ai_messages
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view messages"
  ON public.ai_messages
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create leads"
  ON public.ai_leads
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view leads"
  ON public.ai_leads
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can update leads"
  ON public.ai_leads
  FOR UPDATE
  USING (true);

-- Create indexes for performance
CREATE INDEX idx_ai_messages_conversation_id ON public.ai_messages(conversation_id);
CREATE INDEX idx_ai_messages_created_at ON public.ai_messages(created_at);
CREATE INDEX idx_ai_leads_conversation_id ON public.ai_leads(conversation_id);
CREATE INDEX idx_ai_leads_status ON public.ai_leads(status);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_ai_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_ai_conversations_updated_at
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ai_updated_at_column();

CREATE TRIGGER update_ai_leads_updated_at
  BEFORE UPDATE ON public.ai_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ai_updated_at_column();