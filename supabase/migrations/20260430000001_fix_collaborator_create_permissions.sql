-- Allow collaborator creation to rely on collaborator permissions instead of
-- client permissions, and repair default role aliases that missed the 2026-04-28
-- permission backfill.

WITH role_permissions (role_names, module, action) AS (
  VALUES
    (ARRAY['Admin Cabinet', 'Administrateur', 'Admin'], 'clients', 'view'),
    (ARRAY['Admin Cabinet', 'Administrateur', 'Admin'], 'clients', 'create'),
    (ARRAY['Admin Cabinet', 'Administrateur', 'Admin'], 'clients', 'update'),
    (ARRAY['Admin Cabinet', 'Administrateur', 'Admin'], 'clients', 'delete'),
    (ARRAY['Admin Cabinet', 'Administrateur', 'Admin'], 'clients', 'export'),
    (ARRAY['Admin Cabinet', 'Administrateur', 'Admin'], 'contracts', 'view'),
    (ARRAY['Admin Cabinet', 'Administrateur', 'Admin'], 'contracts', 'deposit'),
    (ARRAY['Admin Cabinet', 'Administrateur', 'Admin'], 'contracts', 'update'),
    (ARRAY['Admin Cabinet', 'Administrateur', 'Admin'], 'contracts', 'cancel'),
    (ARRAY['Admin Cabinet', 'Administrateur', 'Admin'], 'contracts', 'export'),
    (ARRAY['Admin Cabinet', 'Administrateur', 'Admin'], 'partners', 'view'),
    (ARRAY['Admin Cabinet', 'Administrateur', 'Admin'], 'partners', 'create'),
    (ARRAY['Admin Cabinet', 'Administrateur', 'Admin'], 'partners', 'update'),
    (ARRAY['Admin Cabinet', 'Administrateur', 'Admin'], 'partners', 'delete'),
    (ARRAY['Admin Cabinet', 'Administrateur', 'Admin'], 'products', 'view'),
    (ARRAY['Admin Cabinet', 'Administrateur', 'Admin'], 'products', 'create'),
    (ARRAY['Admin Cabinet', 'Administrateur', 'Admin'], 'products', 'update'),
    (ARRAY['Admin Cabinet', 'Administrateur', 'Admin'], 'products', 'delete'),
    (ARRAY['Admin Cabinet', 'Administrateur', 'Admin'], 'collaborators', 'view'),
    (ARRAY['Admin Cabinet', 'Administrateur', 'Admin'], 'collaborators', 'create'),
    (ARRAY['Admin Cabinet', 'Administrateur', 'Admin'], 'collaborators', 'update'),
    (ARRAY['Admin Cabinet', 'Administrateur', 'Admin'], 'collaborators', 'delete'),
    (ARRAY['Admin Cabinet', 'Administrateur', 'Admin'], 'collaborators', 'export'),
    (ARRAY['Admin Cabinet', 'Administrateur', 'Admin'], 'commissions', 'view'),
    (ARRAY['Admin Cabinet', 'Administrateur', 'Admin'], 'commissions', 'modify_rules'),
    (ARRAY['Admin Cabinet', 'Administrateur', 'Admin'], 'commissions', 'export'),
    (ARRAY['Admin Cabinet', 'Administrateur', 'Admin'], 'decomptes', 'view'),
    (ARRAY['Admin Cabinet', 'Administrateur', 'Admin'], 'decomptes', 'generate'),
    (ARRAY['Admin Cabinet', 'Administrateur', 'Admin'], 'decomptes', 'export'),
    (ARRAY['Admin Cabinet', 'Administrateur', 'Admin'], 'payout', 'view'),
    (ARRAY['Admin Cabinet', 'Administrateur', 'Admin'], 'payout', 'generate'),
    (ARRAY['Admin Cabinet', 'Administrateur', 'Admin'], 'payout', 'validate'),
    (ARRAY['Admin Cabinet', 'Administrateur', 'Admin'], 'payout', 'export'),
    (ARRAY['Admin Cabinet', 'Administrateur', 'Admin'], 'dashboard', 'view'),
    (ARRAY['Admin Cabinet', 'Administrateur', 'Admin'], 'settings', 'view'),
    (ARRAY['Admin Cabinet', 'Administrateur', 'Admin'], 'settings', 'update'),

    (ARRAY['Manager'], 'clients', 'view'),
    (ARRAY['Manager'], 'clients', 'create'),
    (ARRAY['Manager'], 'clients', 'update'),
    (ARRAY['Manager'], 'clients', 'export'),
    (ARRAY['Manager'], 'contracts', 'view'),
    (ARRAY['Manager'], 'contracts', 'deposit'),
    (ARRAY['Manager'], 'contracts', 'update'),
    (ARRAY['Manager'], 'contracts', 'export'),
    (ARRAY['Manager'], 'collaborators', 'view'),
    (ARRAY['Manager'], 'commissions', 'view'),
    (ARRAY['Manager'], 'decomptes', 'view'),
    (ARRAY['Manager'], 'dashboard', 'view'),
    (ARRAY['Manager'], 'settings', 'view'),

    (ARRAY['Agent'], 'clients', 'view'),
    (ARRAY['Agent'], 'clients', 'create'),
    (ARRAY['Agent'], 'clients', 'update'),
    (ARRAY['Agent'], 'contracts', 'view'),
    (ARRAY['Agent'], 'contracts', 'deposit'),
    (ARRAY['Agent'], 'commissions', 'view'),
    (ARRAY['Agent'], 'dashboard', 'view'),

    (ARRAY['Back-office', 'Backoffice', 'Back Office'], 'clients', 'view'),
    (ARRAY['Back-office', 'Backoffice', 'Back Office'], 'clients', 'create'),
    (ARRAY['Back-office', 'Backoffice', 'Back Office'], 'clients', 'update'),
    (ARRAY['Back-office', 'Backoffice', 'Back Office'], 'clients', 'export'),
    (ARRAY['Back-office', 'Backoffice', 'Back Office'], 'contracts', 'view'),
    (ARRAY['Back-office', 'Backoffice', 'Back Office'], 'contracts', 'deposit'),
    (ARRAY['Back-office', 'Backoffice', 'Back Office'], 'contracts', 'update'),
    (ARRAY['Back-office', 'Backoffice', 'Back Office'], 'contracts', 'export'),
    (ARRAY['Back-office', 'Backoffice', 'Back Office'], 'partners', 'view'),
    (ARRAY['Back-office', 'Backoffice', 'Back Office'], 'products', 'view'),
    (ARRAY['Back-office', 'Backoffice', 'Back Office'], 'collaborators', 'view'),
    (ARRAY['Back-office', 'Backoffice', 'Back Office'], 'dashboard', 'view'),
    (ARRAY['Back-office', 'Backoffice', 'Back Office'], 'settings', 'view'),

    (ARRAY['Comptabilite', 'Comptabilité', 'Compta'], 'clients', 'view'),
    (ARRAY['Comptabilite', 'Comptabilité', 'Compta'], 'clients', 'export'),
    (ARRAY['Comptabilite', 'Comptabilité', 'Compta'], 'contracts', 'view'),
    (ARRAY['Comptabilite', 'Comptabilité', 'Compta'], 'contracts', 'export'),
    (ARRAY['Comptabilite', 'Comptabilité', 'Compta'], 'commissions', 'view'),
    (ARRAY['Comptabilite', 'Comptabilité', 'Compta'], 'commissions', 'modify_rules'),
    (ARRAY['Comptabilite', 'Comptabilité', 'Compta'], 'commissions', 'export'),
    (ARRAY['Comptabilite', 'Comptabilité', 'Compta'], 'decomptes', 'view'),
    (ARRAY['Comptabilite', 'Comptabilité', 'Compta'], 'decomptes', 'generate'),
    (ARRAY['Comptabilite', 'Comptabilité', 'Compta'], 'decomptes', 'export'),
    (ARRAY['Comptabilite', 'Comptabilité', 'Compta'], 'payout', 'view'),
    (ARRAY['Comptabilite', 'Comptabilité', 'Compta'], 'payout', 'generate'),
    (ARRAY['Comptabilite', 'Comptabilité', 'Compta'], 'payout', 'validate'),
    (ARRAY['Comptabilite', 'Comptabilité', 'Compta'], 'payout', 'export'),
    (ARRAY['Comptabilite', 'Comptabilité', 'Compta'], 'dashboard', 'view'),
    (ARRAY['Comptabilite', 'Comptabilité', 'Compta'], 'settings', 'view'),

    (ARRAY['Partenaire', 'Partner'], 'clients', 'view'),
    (ARRAY['Partenaire', 'Partner'], 'clients', 'create'),
    (ARRAY['Partenaire', 'Partner'], 'clients', 'update'),
    (ARRAY['Partenaire', 'Partner'], 'contracts', 'view'),
    (ARRAY['Partenaire', 'Partner'], 'contracts', 'deposit'),
    (ARRAY['Partenaire', 'Partner'], 'partners', 'view'),
    (ARRAY['Partenaire', 'Partner'], 'commissions', 'view'),
    (ARRAY['Partenaire', 'Partner'], 'dashboard', 'view')
)
INSERT INTO public.tenant_role_permissions (role_id, module, action, allowed)
SELECT
  tr.id,
  rp.module::public.permission_module,
  rp.action::public.permission_action,
  true
FROM public.tenant_roles tr
JOIN role_permissions rp ON tr.name = ANY(rp.role_names)
ON CONFLICT (role_id, module, action)
DO UPDATE SET allowed = true;

CREATE OR REPLACE FUNCTION public.has_tenant_permission_for_tenant(
  _tenant_id uuid,
  _module public.permission_module,
  _action public.permission_action
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_tenant_roles utr
    JOIN public.tenant_role_permissions trp ON trp.role_id = utr.role_id
    JOIN public.tenant_roles tr ON tr.id = utr.role_id
    WHERE utr.user_id = auth.uid()
      AND utr.tenant_id = _tenant_id
      AND tr.tenant_id = _tenant_id
      AND trp.module = _module
      AND trp.action = _action
      AND trp.allowed = true
      AND tr.is_active = true
  )
$$;

GRANT EXECUTE ON FUNCTION public.has_tenant_permission_for_tenant(
  uuid,
  public.permission_module,
  public.permission_action
) TO authenticated;

DROP POLICY IF EXISTS "Tenant staff can create clients" ON public.clients;

CREATE POLICY "Tenant staff can create clients"
ON public.clients
FOR INSERT
WITH CHECK (
  (
    public.is_king()
    OR EXISTS (
      SELECT 1
      FROM public.user_tenant_assignments uta
      WHERE uta.user_id = auth.uid()
        AND uta.tenant_id = clients.tenant_id
    )
  )
  AND (
    public.user_has_global_client_scope(tenant_id)
    OR public.has_tenant_permission_for_tenant(tenant_id, 'clients'::public.permission_module, 'create'::public.permission_action)
    OR (
      type_adresse = 'collaborateur'
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_tenant_permission_for_tenant(tenant_id, 'collaborators'::public.permission_module, 'create'::public.permission_action)
        OR public.has_tenant_permission_for_tenant(tenant_id, 'settings'::public.permission_module, 'update'::public.permission_action)
      )
    )
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
    OR public.has_role(auth.uid(), 'agent'::public.app_role)
    OR public.has_role(auth.uid(), 'partner'::public.app_role)
    OR public.has_role(auth.uid(), 'backoffice'::public.app_role)
  )
);
