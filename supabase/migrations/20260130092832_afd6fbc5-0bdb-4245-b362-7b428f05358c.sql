-- =============================================
-- TENANT LIMITS & CONSUMPTION MANAGEMENT SYSTEM
-- =============================================

-- Table des limites par tenant (les quotas alloués)
CREATE TABLE public.tenant_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Limites de stockage (en GB)
  storage_limit_gb NUMERIC(10, 2) NOT NULL DEFAULT 5.00,
  
  -- Limites mensuelles
  sms_limit_monthly INTEGER NOT NULL DEFAULT 100,
  email_limit_monthly INTEGER NOT NULL DEFAULT 500,
  ai_docs_limit_monthly INTEGER NOT NULL DEFAULT 50,
  
  -- Limite utilisateurs
  users_limit INTEGER NOT NULL DEFAULT 5,
  
  -- IA activée pour ce tenant
  ai_enabled BOOLEAN NOT NULL DEFAULT true,
  
  -- Métadonnées
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT tenant_limits_tenant_unique UNIQUE(tenant_id)
);

-- Table de consommation mensuelle (reset chaque mois)
CREATE TABLE public.tenant_consumption (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Période (mois/année)
  period_year INTEGER NOT NULL,
  period_month INTEGER NOT NULL,
  
  -- Consommation stockage (en bytes pour précision, converti en GB à l'affichage)
  storage_used_bytes BIGINT NOT NULL DEFAULT 0,
  
  -- Consommation mensuelle
  sms_used INTEGER NOT NULL DEFAULT 0,
  email_used INTEGER NOT NULL DEFAULT 0,
  ai_docs_used INTEGER NOT NULL DEFAULT 0,
  
  -- Nombre d'utilisateurs actifs (snapshot)
  active_users INTEGER NOT NULL DEFAULT 0,
  
  -- Métadonnées
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT tenant_consumption_period_unique UNIQUE(tenant_id, period_year, period_month)
);

-- Table d'audit des modifications de limites (traçabilité)
CREATE TABLE public.tenant_limits_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Qui a fait le changement
  changed_by UUID REFERENCES auth.users(id),
  
  -- Type de limite modifiée
  limit_type TEXT NOT NULL, -- 'storage', 'sms', 'email', 'ai_docs', 'users', 'ai_enabled'
  
  -- Valeurs avant/après
  old_value TEXT,
  new_value TEXT,
  
  -- Raison du changement (optionnel)
  reason TEXT,
  
  -- Horodatage
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index pour performance
CREATE INDEX idx_tenant_limits_tenant ON public.tenant_limits(tenant_id);
CREATE INDEX idx_tenant_consumption_tenant ON public.tenant_consumption(tenant_id);
CREATE INDEX idx_tenant_consumption_period ON public.tenant_consumption(period_year, period_month);
CREATE INDEX idx_tenant_limits_audit_tenant ON public.tenant_limits_audit(tenant_id);
CREATE INDEX idx_tenant_limits_audit_created ON public.tenant_limits_audit(created_at DESC);

-- Trigger updated_at pour tenant_limits
CREATE TRIGGER update_tenant_limits_updated_at
  BEFORE UPDATE ON public.tenant_limits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger updated_at pour tenant_consumption
CREATE TRIGGER update_tenant_consumption_updated_at
  BEFORE UPDATE ON public.tenant_consumption
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Fonction pour créer les limites par défaut lors de création tenant
CREATE OR REPLACE FUNCTION public.create_default_tenant_limits()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.tenant_limits (tenant_id)
  VALUES (NEW.id)
  ON CONFLICT (tenant_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger pour créer limites par défaut
CREATE TRIGGER on_tenant_created_create_limits
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_tenant_limits();

-- Fonction pour obtenir ou créer la consommation du mois en cours
CREATE OR REPLACE FUNCTION public.get_or_create_tenant_consumption(p_tenant_id UUID)
RETURNS UUID AS $$
DECLARE
  v_year INTEGER;
  v_month INTEGER;
  v_consumption_id UUID;
  v_active_users INTEGER;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE);
  v_month := EXTRACT(MONTH FROM CURRENT_DATE);
  
  -- Compter les utilisateurs actifs du tenant
  SELECT COUNT(DISTINCT uta.user_id) INTO v_active_users
  FROM public.user_tenant_assignments uta
  WHERE uta.tenant_id = p_tenant_id;
  
  -- Insérer ou mettre à jour
  INSERT INTO public.tenant_consumption (
    tenant_id, period_year, period_month, active_users
  ) VALUES (
    p_tenant_id, v_year, v_month, COALESCE(v_active_users, 0)
  )
  ON CONFLICT (tenant_id, period_year, period_month) 
  DO UPDATE SET 
    active_users = COALESCE(v_active_users, 0),
    updated_at = now()
  RETURNING id INTO v_consumption_id;
  
  RETURN v_consumption_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fonction pour mettre à jour le compteur de stockage
CREATE OR REPLACE FUNCTION public.update_tenant_storage_usage(p_tenant_id UUID)
RETURNS BIGINT AS $$
DECLARE
  v_total_bytes BIGINT;
BEGIN
  -- Calculer le stockage total utilisé par le tenant
  SELECT COALESCE(SUM(d.size_bytes), 0) INTO v_total_bytes
  FROM public.documents d
  WHERE d.tenant_id = p_tenant_id;
  
  -- Mettre à jour la consommation du mois
  PERFORM get_or_create_tenant_consumption(p_tenant_id);
  
  UPDATE public.tenant_consumption
  SET storage_used_bytes = v_total_bytes, updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND period_year = EXTRACT(YEAR FROM CURRENT_DATE)
    AND period_month = EXTRACT(MONTH FROM CURRENT_DATE);
  
  RETURN v_total_bytes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fonction pour incrémenter un compteur de consommation
CREATE OR REPLACE FUNCTION public.increment_tenant_consumption(
  p_tenant_id UUID,
  p_type TEXT, -- 'sms', 'email', 'ai_docs'
  p_amount INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
BEGIN
  -- S'assurer que la ligne existe
  PERFORM get_or_create_tenant_consumption(p_tenant_id);
  
  -- Incrémenter le compteur approprié
  IF p_type = 'sms' THEN
    UPDATE public.tenant_consumption
    SET sms_used = sms_used + p_amount, updated_at = now()
    WHERE tenant_id = p_tenant_id
      AND period_year = EXTRACT(YEAR FROM CURRENT_DATE)
      AND period_month = EXTRACT(MONTH FROM CURRENT_DATE);
  ELSIF p_type = 'email' THEN
    UPDATE public.tenant_consumption
    SET email_used = email_used + p_amount, updated_at = now()
    WHERE tenant_id = p_tenant_id
      AND period_year = EXTRACT(YEAR FROM CURRENT_DATE)
      AND period_month = EXTRACT(MONTH FROM CURRENT_DATE);
  ELSIF p_type = 'ai_docs' THEN
    UPDATE public.tenant_consumption
    SET ai_docs_used = ai_docs_used + p_amount, updated_at = now()
    WHERE tenant_id = p_tenant_id
      AND period_year = EXTRACT(YEAR FROM CURRENT_DATE)
      AND period_month = EXTRACT(MONTH FROM CURRENT_DATE);
  ELSE
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fonction pour logger les changements de limites
CREATE OR REPLACE FUNCTION public.log_tenant_limit_change(
  p_tenant_id UUID,
  p_limit_type TEXT,
  p_old_value TEXT,
  p_new_value TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_audit_id UUID;
BEGIN
  INSERT INTO public.tenant_limits_audit (
    tenant_id, changed_by, limit_type, old_value, new_value, reason
  ) VALUES (
    p_tenant_id, auth.uid(), p_limit_type, p_old_value, p_new_value, p_reason
  ) RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Vue pour obtenir la consommation avec les pourcentages
CREATE OR REPLACE VIEW public.tenant_consumption_summary AS
SELECT 
  t.id AS tenant_id,
  t.name AS tenant_name,
  t.status AS tenant_status,
  t.plan AS tenant_plan,
  
  -- Limites
  COALESCE(tl.storage_limit_gb, 5) AS storage_limit_gb,
  COALESCE(tl.sms_limit_monthly, 100) AS sms_limit_monthly,
  COALESCE(tl.email_limit_monthly, 500) AS email_limit_monthly,
  COALESCE(tl.ai_docs_limit_monthly, 50) AS ai_docs_limit_monthly,
  COALESCE(tl.users_limit, 5) AS users_limit,
  COALESCE(tl.ai_enabled, true) AS ai_enabled,
  
  -- Consommation actuelle
  COALESCE(tc.storage_used_bytes, 0) AS storage_used_bytes,
  ROUND(COALESCE(tc.storage_used_bytes, 0)::NUMERIC / (1024 * 1024 * 1024), 2) AS storage_used_gb,
  COALESCE(tc.sms_used, 0) AS sms_used,
  COALESCE(tc.email_used, 0) AS email_used,
  COALESCE(tc.ai_docs_used, 0) AS ai_docs_used,
  COALESCE(tc.active_users, 0) AS active_users,
  
  -- Pourcentages
  CASE WHEN COALESCE(tl.storage_limit_gb, 5) > 0 
    THEN ROUND((COALESCE(tc.storage_used_bytes, 0)::NUMERIC / (1024 * 1024 * 1024)) / tl.storage_limit_gb * 100, 1)
    ELSE 0 
  END AS storage_percent,
  
  CASE WHEN COALESCE(tl.sms_limit_monthly, 100) > 0 
    THEN ROUND(COALESCE(tc.sms_used, 0)::NUMERIC / tl.sms_limit_monthly * 100, 1)
    ELSE 0 
  END AS sms_percent,
  
  CASE WHEN COALESCE(tl.email_limit_monthly, 500) > 0 
    THEN ROUND(COALESCE(tc.email_used, 0)::NUMERIC / tl.email_limit_monthly * 100, 1)
    ELSE 0 
  END AS email_percent,
  
  CASE WHEN COALESCE(tl.ai_docs_limit_monthly, 50) > 0 
    THEN ROUND(COALESCE(tc.ai_docs_used, 0)::NUMERIC / tl.ai_docs_limit_monthly * 100, 1)
    ELSE 0 
  END AS ai_docs_percent,
  
  CASE WHEN COALESCE(tl.users_limit, 5) > 0 
    THEN ROUND(COALESCE(tc.active_users, 0)::NUMERIC / tl.users_limit * 100, 1)
    ELSE 0 
  END AS users_percent,
  
  -- Période actuelle
  EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER AS current_year,
  EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER AS current_month

FROM public.tenants t
LEFT JOIN public.tenant_limits tl ON tl.tenant_id = t.id
LEFT JOIN public.tenant_consumption tc ON tc.tenant_id = t.id
  AND tc.period_year = EXTRACT(YEAR FROM CURRENT_DATE)
  AND tc.period_month = EXTRACT(MONTH FROM CURRENT_DATE);

-- RLS Policies
ALTER TABLE public.tenant_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_consumption ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_limits_audit ENABLE ROW LEVEL SECURITY;

-- KING peut tout voir et modifier
CREATE POLICY "KING can manage tenant_limits"
  ON public.tenant_limits FOR ALL
  USING (public.is_king())
  WITH CHECK (public.is_king());

CREATE POLICY "KING can manage tenant_consumption"
  ON public.tenant_consumption FOR ALL
  USING (public.is_king())
  WITH CHECK (public.is_king());

CREATE POLICY "KING can view tenant_limits_audit"
  ON public.tenant_limits_audit FOR SELECT
  USING (public.is_king());

CREATE POLICY "KING can insert tenant_limits_audit"
  ON public.tenant_limits_audit FOR INSERT
  WITH CHECK (public.is_king());

-- Créer les limites par défaut pour tous les tenants existants
INSERT INTO public.tenant_limits (tenant_id)
SELECT id FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- Créer la consommation du mois en cours pour tous les tenants
INSERT INTO public.tenant_consumption (tenant_id, period_year, period_month, active_users)
SELECT 
  t.id,
  EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
  EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER,
  (SELECT COUNT(DISTINCT uta.user_id) FROM public.user_tenant_assignments uta WHERE uta.tenant_id = t.id)
FROM public.tenants t
ON CONFLICT (tenant_id, period_year, period_month) DO NOTHING;