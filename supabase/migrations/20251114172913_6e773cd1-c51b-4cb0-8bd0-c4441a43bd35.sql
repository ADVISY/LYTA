-- Étape 2 : Créer les tables et relations

-- 1. Ajouter les champs manquants à profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 2. Modifier la table clients
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS assigned_agent_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS zip_code TEXT,
ADD COLUMN IF NOT EXISTS mobile TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'prospect',
ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Ajouter contrainte sur status si pas déjà présente
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clients_status_check'
  ) THEN
    ALTER TABLE clients ADD CONSTRAINT clients_status_check 
    CHECK (status IN ('prospect', 'actif', 'résilié', 'dormant'));
  END IF;
END $$;

-- 3. Créer la table Suivis
CREATE TABLE IF NOT EXISTS suivis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  assigned_agent_id UUID REFERENCES profiles(id),
  type TEXT,
  status TEXT DEFAULT 'ouvert',
  title TEXT NOT NULL,
  description TEXT,
  reminder_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT suivis_status_check CHECK (status IN ('ouvert', 'en_cours', 'fermé'))
);

-- 4. Créer la table Propositions
CREATE TABLE IF NOT EXISTS propositions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES profiles(id),
  company_name TEXT,
  product_type TEXT,
  monthly_premium NUMERIC,
  yearly_premium NUMERIC,
  status TEXT DEFAULT 'brouillon',
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT propositions_status_check CHECK (status IN ('brouillon', 'envoyée', 'signée', 'refusée'))
);

-- 5. Adapter policies (contrats)
ALTER TABLE policies
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS product_type TEXT;

-- 6. Adapter commissions
ALTER TABLE commissions
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'acquisition',
ADD COLUMN IF NOT EXISTS total_amount NUMERIC,
ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'commissions_type_check'
  ) THEN
    ALTER TABLE commissions ADD CONSTRAINT commissions_type_check 
    CHECK (type IN ('acquisition', 'renouvellement', 'ristourne'));
  END IF;
END $$;

-- 7. Créer CommissionPartAgent
CREATE TABLE IF NOT EXISTS commission_part_agent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id UUID NOT NULL REFERENCES commissions(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES profiles(id),
  rate NUMERIC NOT NULL,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Créer Messages
CREATE TABLE IF NOT EXISTS messages_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  channel TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT messages_direction_check CHECK (direction IN ('entrant', 'sortant')),
  CONSTRAINT messages_channel_check CHECK (channel IN ('email', 'whatsapp', 'sms', 'autre'))
);

-- 9. Triggers pour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_suivis_updated_at ON suivis;
CREATE TRIGGER update_suivis_updated_at 
  BEFORE UPDATE ON suivis 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_propositions_updated_at ON propositions;
CREATE TRIGGER update_propositions_updated_at 
  BEFORE UPDATE ON propositions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 10. Index pour performances
CREATE INDEX IF NOT EXISTS idx_clients_assigned_agent ON clients(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_suivis_client ON suivis(client_id);
CREATE INDEX IF NOT EXISTS idx_suivis_agent ON suivis(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_propositions_client ON propositions(client_id);
CREATE INDEX IF NOT EXISTS idx_propositions_agent ON propositions(agent_id);
CREATE INDEX IF NOT EXISTS idx_commission_part_agent ON commission_part_agent(agent_id);
CREATE INDEX IF NOT EXISTS idx_messages_client ON messages_clients(client_id);