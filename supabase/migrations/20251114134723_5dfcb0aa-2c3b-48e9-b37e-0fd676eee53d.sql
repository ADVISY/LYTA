-- Add foreign key constraint between clients.user_id and profiles.id
ALTER TABLE public.clients
ADD CONSTRAINT fk_clients_user_id
FOREIGN KEY (user_id)
REFERENCES public.profiles(id)
ON DELETE SET NULL;