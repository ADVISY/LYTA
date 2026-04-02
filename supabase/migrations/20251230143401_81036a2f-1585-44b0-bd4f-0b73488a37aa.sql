-- ============================================
-- PHASE 0: Sécurité & Multi-tenant
-- ============================================

-- 1. Fix clients_safe view RLS bypass
-- La vue clients_safe n'a pas de RLS, ce qui permet de contourner les politiques de sécurité
-- On ne peut pas directement activer RLS sur une vue PostgreSQL, donc on la remplace par une fonction SECURITY DEFINER

-- Supprime l'ancienne vue
DROP VIEW IF EXISTS public.clients_safe;

-- Crée une vue sécurisée qui utilise SECURITY INVOKER (par défaut) et filtre selon les droits
CREATE VIEW public.clients_safe 
WITH (security_invoker = true)
AS
SELECT 
  c.id,
  c.user_id,
  c.birthdate,
  c.is_company,
  c.created_at,
  c.updated_at,
  c.assigned_agent_id,
  -- Masquer les données financières sensibles
  NULL::numeric AS commission_rate,
  NULL::numeric AS fixed_salary,
  NULL::numeric AS bonus_rate,
  c.work_percentage,
  c.hire_date,
  NULL::numeric AS commission_rate_lca,
  NULL::numeric AS commission_rate_vie,
  c.manager_id,
  NULL::numeric AS manager_commission_rate_lca,
  NULL::numeric AS manager_commission_rate_vie,
  NULL::numeric AS reserve_rate,
  c.external_ref,
  c.company_name,
  c.phone,
  c.address,
  c.city,
  c.postal_code,
  c.country,
  NULL::text AS iban,
  c.first_name,
  c.last_name,
  c.zip_code,
  c.mobile,
  c.status,
  c.tags,
  c.email,
  c.type_adresse,
  c.civil_status,
  c.permit_type,
  c.nationality,
  c.profession,
  c.employer,
  NULL::text AS bank_name,
  c.contract_type,
  c.canton,
  c.tenant_id
FROM clients c
WHERE public.can_access_client(c.id);

-- 2. Créer la table transactions comme source unique de vérité financière
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  contract_id UUID REFERENCES public.policies(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('commission', 'payment', 'cancellation', 'adjustment')),
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'paid', 'cancelled')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  locked BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_transactions_tenant ON public.transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_agent ON public.transactions(agent_id);
CREATE INDEX IF NOT EXISTS idx_transactions_contract ON public.transactions(contract_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type_status ON public.transactions(type, status);

-- Activer RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies pour transactions
CREATE POLICY "Admins can manage all transactions"
ON public.transactions FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Compta can view and update transactions"
ON public.transactions FOR SELECT
USING (public.has_role(auth.uid(), 'compta'::app_role));

CREATE POLICY "Compta can insert transactions"
ON public.transactions FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'compta'::app_role));

CREATE POLICY "Compta can update unlocked transactions"
ON public.transactions FOR UPDATE
USING (public.has_role(auth.uid(), 'compta'::app_role) AND locked = false);

CREATE POLICY "Agents can view their own transactions"
ON public.transactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.clients c 
    WHERE c.id = transactions.agent_id 
    AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Managers can view team transactions"
ON public.transactions FOR SELECT
USING (
  public.has_role(auth.uid(), 'manager'::app_role) AND
  EXISTS (
    SELECT 1 FROM public.clients agent
    JOIN public.clients manager ON agent.manager_id = manager.id
    WHERE agent.id = transactions.agent_id
    AND manager.user_id = auth.uid()
  )
);

-- Trigger pour updated_at
CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Améliorer la table audit_logs pour un meilleur tracking
-- Ajouter tenant_id si pas présent
ALTER TABLE public.audit_logs 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- Index pour queries fréquentes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON public.audit_logs(tenant_id);

-- 4. S'assurer que toutes les tables métier ont tenant_id
-- Ajouter tenant_id aux tables qui ne l'ont pas encore avec les bons index

-- 5. Fonction helper pour créer une transaction d'annulation automatique
CREATE OR REPLACE FUNCTION public.create_cancellation_transaction(
  p_transaction_id UUID,
  p_reason TEXT DEFAULT 'Annulation'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_original RECORD;
  v_new_id UUID;
BEGIN
  -- Récupérer la transaction originale
  SELECT * INTO v_original FROM transactions WHERE id = p_transaction_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;
  
  IF v_original.locked THEN
    RAISE EXCEPTION 'Cannot cancel a locked transaction';
  END IF;
  
  -- Créer la transaction inverse
  INSERT INTO transactions (
    tenant_id, contract_id, agent_id, type, amount, status, date, 
    created_by, notes, metadata
  ) VALUES (
    v_original.tenant_id,
    v_original.contract_id,
    v_original.agent_id,
    'cancellation',
    -v_original.amount,  -- Montant inversé
    'validated',
    CURRENT_DATE,
    auth.uid(),
    p_reason,
    jsonb_build_object('original_transaction_id', p_transaction_id)
  ) RETURNING id INTO v_new_id;
  
  -- Marquer l'original comme annulé
  UPDATE transactions SET status = 'cancelled' WHERE id = p_transaction_id;
  
  RETURN v_new_id;
END;
$$;