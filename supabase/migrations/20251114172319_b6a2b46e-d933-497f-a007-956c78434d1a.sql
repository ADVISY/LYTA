-- Étape 1 : Ajouter les nouvelles valeurs à l'enum app_role
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'agent';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'backoffice';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'compta';