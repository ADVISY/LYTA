-- ============================================================================
-- Fix RLS INSERT : SECURITY DEFINER explicite pour bypasser sous-RLS
-- ============================================================================
-- Diagnostic confirmé : Matthieu (Admin Cabinet JCG) reçoit toast
-- "Accès refusé (tenant 7af2904e...). Code 42501" sur INSERT clients.
-- Code 42501 = vraie violation RLS Postgres.
--
-- Hypothèse forte : les sous-queries EXISTS(SELECT FROM user_tenant_assignments
-- WHERE ...) dans les WITH CHECK des policies actuelles passent elles-mêmes
-- par la RLS de user_tenant_assignments. Selon le contexte, cette sous-RLS
-- peut renvoyer 0 rows même quand l'enregistrement existe → EXISTS=false →
-- WITH CHECK rejette → INSERT bloqué.
--
-- Fix : on crée une fonction SECURITY DEFINER `user_is_member_of_tenant`
-- qui bypass les RLS pour la lookup membership. Puis on l'utilise dans
-- une nouvelle policy INSERT 'v3_simple_create_clients'.
-- ============================================================================

-- 1. Fonction helper qui contourne les RLS pour vérifier l'appartenance
CREATE OR REPLACE FUNCTION public.user_is_member_of_tenant(
  p_user_id uuid,
  p_tenant_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_user_id IS NOT NULL
    AND p_tenant_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.user_tenant_assignments uta
      WHERE uta.user_id = p_user_id
        AND uta.tenant_id = p_tenant_id
    );
$$;

GRANT EXECUTE ON FUNCTION public.user_is_member_of_tenant(uuid, uuid) TO authenticated;

-- 2. Nouvelle policy INSERT qui utilise UNIQUEMENT cette fonction
DROP POLICY IF EXISTS "v3_simple_create_clients" ON public.clients;
CREATE POLICY "v3_simple_create_clients"
ON public.clients
FOR INSERT
TO authenticated
WITH CHECK (
  public.user_is_member_of_tenant(auth.uid(), tenant_id)
);

-- 3. King notification
INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
VALUES (
  'RLS clients INSERT v3 : fonction SECURITY DEFINER ajoutee',
  'Fix tentatif #2 pour Matthieu JCG. Nouvelle fonction user_is_member_of_tenant() qui bypass les RLS dans la lookup membership. Policy v3 lance via auth.uid() + tenant_id de la row inseree.',
  'system_info', 'high',
  jsonb_build_object(
    'migration', '20260527200000_fix_clients_insert_via_security_definer',
    'tenant_concerne', 'JCG Consulting'
  )
);
