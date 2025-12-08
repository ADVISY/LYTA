-- Table des permissions par collaborateur
CREATE TABLE public.collaborator_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collaborator_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  module TEXT NOT NULL, -- 'adresses', 'contrats', 'commissions', 'suivis', 'documents', 'compagnies', 'collaborateurs'
  can_read BOOLEAN NOT NULL DEFAULT false,
  can_create BOOLEAN NOT NULL DEFAULT false,
  can_update BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(collaborator_id, module)
);

-- Enable RLS
ALTER TABLE public.collaborator_permissions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage all permissions"
ON public.collaborator_permissions
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can view permissions"
ON public.collaborator_permissions
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'agent'::app_role)
);

-- Trigger for updated_at
CREATE TRIGGER update_collaborator_permissions_updated_at
BEFORE UPDATE ON public.collaborator_permissions
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Index for faster lookups
CREATE INDEX idx_collaborator_permissions_collaborator ON public.collaborator_permissions(collaborator_id);
CREATE INDEX idx_collaborator_permissions_module ON public.collaborator_permissions(module);