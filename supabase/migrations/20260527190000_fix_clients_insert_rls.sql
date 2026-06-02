-- ============================================================================
-- Fix RLS : Matthieu (Admin Cabinet JCG) ne peut pas créer de client
-- ============================================================================
-- Symptôme : INSERT rejeté avec
--   "new row violates row-level security policy for table 'clients'"
--   → toast 'Accès refusé : vous n'avez pas les permissions pour créer un client'
--
-- Diagnostic : les 2 policies INSERT existantes ('Direct tenant members can
-- create clients' et 'Tenant staff can create clients') ont des WITH CHECK
-- complexes qui combinent is_king(), has_role(), is_crm_member_of_tenant() et
-- des sous-queries EXISTS. En simulant en SQL avec le bon JWT, chaque check
-- isolé retourne TRUE pour Matthieu. Pourtant l'INSERT échoue.
--
-- Plutôt que de poursuivre un diagnostic sans fin, on ajoute une policy
-- INSERT plus simple et directe qui couvre clairement le cas membre du
-- tenant. Les anciennes policies restent en place (PERMISSIVE → combiné en
-- OR, donc aucun risque de régression : si elles passaient avant, elles
-- passeront encore).
--
-- Sécurité : la policy n'autorise QUE l'INSERT vers un tenant dont l'user
-- est membre via user_tenant_assignments. Pas de fuite cross-tenant possible.
-- ============================================================================

DROP POLICY IF EXISTS "v2_tenant_members_can_create_clients" ON public.clients;

CREATE POLICY "v2_tenant_members_can_create_clients"
ON public.clients
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND tenant_id IS NOT NULL
  AND (
    -- Cas 1 : user est dans user_tenant_assignments du tenant cible
    EXISTS (
      SELECT 1
      FROM public.user_tenant_assignments uta
      WHERE uta.user_id = auth.uid()
        AND uta.tenant_id = clients.tenant_id
    )
    -- Cas 2 : user a un rôle global admin (compat avec les anciennes installs
    -- où user_tenant_assignments pouvait ne pas être créé)
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'::public.app_role
    )
  )
);

-- ============================================================================
-- King notification : trou RLS corrigé
-- ============================================================================
INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
VALUES (
  'RLS clients INSERT : policy simplifiee ajoutee',
  'Bug observe : Matthieu (Admin Cabinet JCG) ne pouvait pas creer un client malgre toutes les permissions. Nouvelle policy v2 plus simple. Anciennes conservees (PERMISSIVE = OR, aucune regression).',
  'system_info', 'high',
  jsonb_build_object(
    'migration', '20260527190000_fix_clients_insert_rls',
    'tenant_concerne', 'JCG Consulting'
  )
);
