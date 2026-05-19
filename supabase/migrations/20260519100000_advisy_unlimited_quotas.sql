-- ============================================================================
-- Advisy : quotas illimités (cabinet interne d'Habib, billing_mode='internal')
-- ============================================================================
-- Advisy est le cabinet du fondateur (utilisation interne pour valider LYTA en
-- production). On lui met des quotas effectivement illimités (999999/mois) sur
-- ai_docs / sms / email pour qu'il ne soit jamais bloqué par les limites
-- destinées aux clients payants.
-- ============================================================================

-- 1. Quotas illimités
UPDATE public.tenant_limits
   SET ai_docs_limit_monthly = 999999,
       sms_limit_monthly = 999999,
       email_limit_monthly = 999999,
       updated_at = NOW()
 WHERE tenant_id = (SELECT id FROM public.tenants WHERE slug = 'advisy');

-- 2. Désactiver l'overage Stripe (sans objet vu que illimité + billing_mode='internal')
UPDATE public.tenants
   SET auto_overage_enabled = FALSE
 WHERE slug = 'advisy';

-- 3. Audit log (king notification pour traçabilité)
INSERT INTO public.king_notifications (title, message, kind, priority, tenant_id, tenant_name, metadata)
SELECT
  '∞ Quotas illimités appliqués',
  'Advisy passe en quotas illimités (cabinet interne).',
  'system_info', 'low',
  t.id, t.name,
  jsonb_build_object('reason', 'internal_cabinet', 'limits', '999999')
FROM public.tenants t
WHERE t.slug = 'advisy';
