-- Add new fields to clients table for insurance CRM
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS civil_status TEXT CHECK (civil_status IN ('célibataire', 'marié', 'divorcé', 'séparé', 'veuf')),
ADD COLUMN IF NOT EXISTS permit_type TEXT CHECK (permit_type IN ('B', 'C', 'G', 'L', 'Autre')),
ADD COLUMN IF NOT EXISTS nationality TEXT,
ADD COLUMN IF NOT EXISTS profession TEXT,
ADD COLUMN IF NOT EXISTS employer TEXT,
ADD COLUMN IF NOT EXISTS bank_name TEXT;

-- Note: iban column already exists in clients table

-- Create family_members table
CREATE TABLE IF NOT EXISTS public.family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  birth_date DATE,
  relation_type TEXT NOT NULL CHECK (relation_type IN ('conjoint', 'enfant', 'autre')),
  permit_type TEXT CHECK (permit_type IN ('B', 'C', 'G', 'L', 'Autre')),
  nationality TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on family_members
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

-- RLS policies for family_members
CREATE POLICY "Admins can manage all family members"
  ON public.family_members
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view family members for their clients"
  ON public.family_members
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'partner'::app_role) OR
    has_role(auth.uid(), 'agent'::app_role) OR
    EXISTS (
      SELECT 1 FROM public.clients
      WHERE clients.id = family_members.client_id
      AND (clients.user_id = auth.uid() OR clients.assigned_agent_id = auth.uid())
    )
  );

CREATE POLICY "Partners and agents can create family members"
  ON public.family_members
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'partner'::app_role) OR
    has_role(auth.uid(), 'agent'::app_role)
  );

CREATE POLICY "Partners and agents can update family members"
  ON public.family_members
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'partner'::app_role) OR
    has_role(auth.uid(), 'agent'::app_role)
  );

CREATE POLICY "Admins can delete family members"
  ON public.family_members
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_family_members_updated_at
  BEFORE UPDATE ON public.family_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_family_members_client_id ON public.family_members(client_id);