-- Ajouter le rôle 'king' à l'enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'king';