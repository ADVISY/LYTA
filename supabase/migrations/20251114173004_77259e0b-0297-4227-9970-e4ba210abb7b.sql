-- Étape 3 : Activer RLS et créer les policies

-- 1. Corriger la fonction update_updated_at_column pour la sécurité
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 2. RLS et Policies pour suivis
ALTER TABLE suivis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view suivis for their clients or assigned to them"
  ON suivis FOR SELECT
  USING (
    has_role(auth.uid(), 'admin') OR
    assigned_agent_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM clients 
      WHERE clients.id = suivis.client_id 
      AND (clients.user_id = auth.uid() OR clients.assigned_agent_id = auth.uid())
    )
  );

CREATE POLICY "Agents can create suivis"
  ON suivis FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'agent') OR 
    has_role(auth.uid(), 'manager')
  );

CREATE POLICY "Agents can update their suivis"
  ON suivis FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin') OR 
    assigned_agent_id = auth.uid()
  );

CREATE POLICY "Admins can delete suivis"
  ON suivis FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- 3. RLS et Policies pour propositions
ALTER TABLE propositions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view propositions for their clients"
  ON propositions FOR SELECT
  USING (
    has_role(auth.uid(), 'admin') OR
    agent_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM clients 
      WHERE clients.id = propositions.client_id 
      AND (clients.user_id = auth.uid() OR clients.assigned_agent_id = auth.uid())
    )
  );

CREATE POLICY "Agents can create propositions"
  ON propositions FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'agent') OR 
    has_role(auth.uid(), 'manager')
  );

CREATE POLICY "Agents can update their propositions"
  ON propositions FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin') OR 
    agent_id = auth.uid()
  );

CREATE POLICY "Admins can delete propositions"
  ON propositions FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- 4. RLS et Policies pour commission_part_agent
ALTER TABLE commission_part_agent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own commission parts"
  ON commission_part_agent FOR SELECT
  USING (
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'compta') OR
    agent_id = auth.uid()
  );

CREATE POLICY "Admins and compta can manage commission parts"
  ON commission_part_agent FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'compta')
  );

CREATE POLICY "Admins and compta can update commission parts"
  ON commission_part_agent FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'compta')
  );

CREATE POLICY "Admins can delete commission parts"
  ON commission_part_agent FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- 5. RLS et Policies pour messages_clients
ALTER TABLE messages_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages for their clients"
  ON messages_clients FOR SELECT
  USING (
    has_role(auth.uid(), 'admin') OR
    EXISTS (
      SELECT 1 FROM clients 
      WHERE clients.id = messages_clients.client_id 
      AND (clients.user_id = auth.uid() OR clients.assigned_agent_id = auth.uid())
    )
  );

CREATE POLICY "Users can create messages"
  ON messages_clients FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'agent') OR 
    has_role(auth.uid(), 'manager') OR
    has_role(auth.uid(), 'backoffice')
  );

CREATE POLICY "Admins can delete messages"
  ON messages_clients FOR DELETE
  USING (has_role(auth.uid(), 'admin'));