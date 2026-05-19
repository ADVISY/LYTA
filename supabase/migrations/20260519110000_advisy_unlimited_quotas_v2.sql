-- ============================================================================
-- Advisy unlimited quotas V2 — force INSERT si pas de ligne tenant_limits
-- ============================================================================
-- La v1 (20260519100000) faisait un UPDATE simple. Si Advisy n'avait pas de
-- ligne dans tenant_limits, l'UPDATE était silencieux. Cette v2 fait un
-- UPSERT propre.
-- ============================================================================

INSERT INTO public.tenant_limits (
  tenant_id,
  ai_docs_limit_monthly,
  sms_limit_monthly,
  email_limit_monthly,
  ai_enabled
)
SELECT id, 999999, 999999, 999999, TRUE
  FROM public.tenants
 WHERE LOWER(slug) = 'advisy' OR LOWER(name) LIKE '%advisy%'
ON CONFLICT (tenant_id) DO UPDATE
   SET ai_docs_limit_monthly = 999999,
       sms_limit_monthly = 999999,
       email_limit_monthly = 999999,
       ai_enabled = TRUE,
       updated_at = NOW();

-- Reset compteurs tenant_consumption (sinon le compteur reste haut malgré le bump des limites)
UPDATE public.tenant_consumption
   SET ai_docs_used = 0,
       sms_used = 0,
       email_used = 0
 WHERE tenant_id IN (
   SELECT id FROM public.tenants WHERE LOWER(slug) = 'advisy' OR LOWER(name) LIKE '%advisy%'
 );
