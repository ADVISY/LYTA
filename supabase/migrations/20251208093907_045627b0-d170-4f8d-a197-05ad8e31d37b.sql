-- Add manager_id to clients table for collaborator hierarchy
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_clients_manager_id ON public.clients(manager_id);

-- Add manager commission rates (percentage of team member's commission)
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS manager_commission_rate_lca numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS manager_commission_rate_vie numeric DEFAULT 0;