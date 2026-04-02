-- Allow client_id to be nullable for pending contract deposits
ALTER TABLE public.policies ALTER COLUMN client_id DROP NOT NULL;