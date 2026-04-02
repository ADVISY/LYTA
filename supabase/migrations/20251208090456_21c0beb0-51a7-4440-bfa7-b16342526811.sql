-- Drop the existing foreign key constraint that references profiles
ALTER TABLE public.commission_part_agent 
DROP CONSTRAINT IF EXISTS commission_part_agent_agent_id_fkey;

-- Add new foreign key constraint that references clients (collaborateurs)
ALTER TABLE public.commission_part_agent 
ADD CONSTRAINT commission_part_agent_agent_id_fkey 
FOREIGN KEY (agent_id) REFERENCES public.clients(id) ON DELETE CASCADE;