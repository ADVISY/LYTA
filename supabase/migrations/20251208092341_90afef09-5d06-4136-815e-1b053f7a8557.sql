-- Ajouter les champs financiers pour les collaborateurs
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS commission_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS fixed_salary NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS bonus_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS contract_type TEXT DEFAULT 'cdi',
ADD COLUMN IF NOT EXISTS work_percentage NUMERIC DEFAULT 100,
ADD COLUMN IF NOT EXISTS hire_date DATE;

-- Commentaires pour documentation
COMMENT ON COLUMN public.clients.commission_rate IS 'Taux de commission en pourcentage (0-100)';
COMMENT ON COLUMN public.clients.fixed_salary IS 'Salaire fixe mensuel en CHF';
COMMENT ON COLUMN public.clients.bonus_rate IS 'Taux de bonus en pourcentage';
COMMENT ON COLUMN public.clients.contract_type IS 'Type de contrat: cdi, cdd, freelance, stagiaire';
COMMENT ON COLUMN public.clients.work_percentage IS 'Taux de travail en pourcentage (ex: 80, 100)';
COMMENT ON COLUMN public.clients.hire_date IS 'Date d embauche';