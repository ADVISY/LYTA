-- Add gender/avatar fields to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('homme', 'femme', 'enfant')),
ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Add photo_url to profiles for collaborators
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS photo_url TEXT;