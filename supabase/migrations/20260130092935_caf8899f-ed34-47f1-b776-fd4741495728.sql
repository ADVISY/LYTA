-- Corriger la vue tenant_consumption_summary pour éviter SECURITY DEFINER
-- On la remplace par une fonction RLS-safe

DROP VIEW IF EXISTS public.tenant_consumption_summary;

-- Créer une fonction SECURITY DEFINER à la place (plus sûr et contrôlé)
CREATE OR REPLACE FUNCTION public.get_tenant_consumption_summary()
RETURNS TABLE (
  tenant_id UUID,
  tenant_name TEXT,
  tenant_status TEXT,
  tenant_plan TEXT,
  storage_limit_gb NUMERIC,
  sms_limit_monthly INTEGER,
  email_limit_monthly INTEGER,
  ai_docs_limit_monthly INTEGER,
  users_limit INTEGER,
  ai_enabled BOOLEAN,
  storage_used_bytes BIGINT,
  storage_used_gb NUMERIC,
  sms_used INTEGER,
  email_used INTEGER,
  ai_docs_used INTEGER,
  active_users INTEGER,
  storage_percent NUMERIC,
  sms_percent NUMERIC,
  email_percent NUMERIC,
  ai_docs_percent NUMERIC,
  users_percent NUMERIC,
  current_year INTEGER,
  current_month INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Vérifier que l'utilisateur est KING
  IF NOT public.is_king() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    t.id AS tenant_id,
    t.name::TEXT AS tenant_name,
    t.status::TEXT AS tenant_status,
    t.plan::TEXT AS tenant_plan,
    
    COALESCE(tl.storage_limit_gb, 5)::NUMERIC AS storage_limit_gb,
    COALESCE(tl.sms_limit_monthly, 100)::INTEGER AS sms_limit_monthly,
    COALESCE(tl.email_limit_monthly, 500)::INTEGER AS email_limit_monthly,
    COALESCE(tl.ai_docs_limit_monthly, 50)::INTEGER AS ai_docs_limit_monthly,
    COALESCE(tl.users_limit, 5)::INTEGER AS users_limit,
    COALESCE(tl.ai_enabled, true)::BOOLEAN AS ai_enabled,
    
    COALESCE(tc.storage_used_bytes, 0)::BIGINT AS storage_used_bytes,
    ROUND(COALESCE(tc.storage_used_bytes, 0)::NUMERIC / (1024 * 1024 * 1024), 2)::NUMERIC AS storage_used_gb,
    COALESCE(tc.sms_used, 0)::INTEGER AS sms_used,
    COALESCE(tc.email_used, 0)::INTEGER AS email_used,
    COALESCE(tc.ai_docs_used, 0)::INTEGER AS ai_docs_used,
    COALESCE(tc.active_users, 0)::INTEGER AS active_users,
    
    CASE WHEN COALESCE(tl.storage_limit_gb, 5) > 0 
      THEN ROUND((COALESCE(tc.storage_used_bytes, 0)::NUMERIC / (1024 * 1024 * 1024)) / tl.storage_limit_gb * 100, 1)
      ELSE 0 
    END::NUMERIC AS storage_percent,
    
    CASE WHEN COALESCE(tl.sms_limit_monthly, 100) > 0 
      THEN ROUND(COALESCE(tc.sms_used, 0)::NUMERIC / tl.sms_limit_monthly * 100, 1)
      ELSE 0 
    END::NUMERIC AS sms_percent,
    
    CASE WHEN COALESCE(tl.email_limit_monthly, 500) > 0 
      THEN ROUND(COALESCE(tc.email_used, 0)::NUMERIC / tl.email_limit_monthly * 100, 1)
      ELSE 0 
    END::NUMERIC AS email_percent,
    
    CASE WHEN COALESCE(tl.ai_docs_limit_monthly, 50) > 0 
      THEN ROUND(COALESCE(tc.ai_docs_used, 0)::NUMERIC / tl.ai_docs_limit_monthly * 100, 1)
      ELSE 0 
    END::NUMERIC AS ai_docs_percent,
    
    CASE WHEN COALESCE(tl.users_limit, 5) > 0 
      THEN ROUND(COALESCE(tc.active_users, 0)::NUMERIC / tl.users_limit * 100, 1)
      ELSE 0 
    END::NUMERIC AS users_percent,
    
    EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER AS current_year,
    EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER AS current_month

  FROM public.tenants t
  LEFT JOIN public.tenant_limits tl ON tl.tenant_id = t.id
  LEFT JOIN public.tenant_consumption tc ON tc.tenant_id = t.id
    AND tc.period_year = EXTRACT(YEAR FROM CURRENT_DATE)
    AND tc.period_month = EXTRACT(MONTH FROM CURRENT_DATE);
END;
$$;