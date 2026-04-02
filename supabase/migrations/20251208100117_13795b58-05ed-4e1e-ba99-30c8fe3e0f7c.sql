-- Drop the existing foreign key constraint that references profiles
-- This allows assigned_agent_id to reference any UUID (either profiles or clients collaborators)
ALTER TABLE public.clients 
DROP CONSTRAINT IF EXISTS clients_assigned_agent_id_fkey;