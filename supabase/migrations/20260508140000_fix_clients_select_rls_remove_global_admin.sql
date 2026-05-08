-- ============================================================================
-- URGENT SECURITY FIX — RLS clients SELECT was leaking cross-tenant
-- ============================================================================
--
-- BUG (introduced by 20260505103500_allow_tenant_members_select_clients_for_returning.sql)
-- ----------------------------------------------------------------------------
-- The policy "Direct tenant members can view clients" used:
--
--   OR public.has_role(auth.uid(), 'admin'::public.app_role)
--
-- This is dangerously permissive: has_role() only checks the global app_role
-- and is not scoped to a tenant. Since the role "admin" in public.user_roles
-- does NOT carry a tenant_id, ANY user marked as admin on ANY tenant was able
-- to SELECT clients across ALL tenants — a cross-tenant data leak.
--
-- This was reported by an admin who saw clients of other tenants in the
-- "Publicité / envoi groupé" recipient picker.
--
-- FIX
-- ----------------------------------------------------------------------------
-- Remove the standalone has_role(..., 'admin') condition. The remaining
-- conditions still cover legitimate access:
--   - is_king()                                                   (super admin)
--   - EXISTS user_tenant_assignments uta WHERE tenant matches    (tenant admin)
--   - EXISTS user_tenant_roles + tenant_roles match              (custom roles)
--
-- Tenant admins are *always* in user_tenant_assignments for their tenant, so
-- this does not lose any legitimate access.
--
-- ROLLBACK: re-apply 20260505103500 to restore the previous (broken) policy.
-- ============================================================================

DROP POLICY IF EXISTS "Direct tenant members can view clients" ON public.clients;

CREATE POLICY "Direct tenant members can view clients"
ON public.clients
FOR SELECT
TO authenticated
USING (
  tenant_id IS NOT NULL
  AND auth.uid() IS NOT NULL
  AND (
    public.is_king()
    OR EXISTS (
      SELECT 1
      FROM public.user_tenant_assignments uta
      WHERE uta.user_id = auth.uid()
        AND uta.tenant_id = clients.tenant_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_tenant_roles utr
      JOIN public.tenant_roles tr ON tr.id = utr.role_id
      WHERE utr.user_id = auth.uid()
        AND tr.tenant_id = clients.tenant_id
        AND tr.is_active = true
        AND (
          utr.tenant_id = clients.tenant_id
          OR utr.tenant_id IS NULL
        )
    )
  )
);
