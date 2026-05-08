-- ============================================================================
-- URGENT SECURITY FIX — RLS propositions had NO tenant scoping
-- ============================================================================
--
-- BUG (introduced 2025-11-14, never fixed since)
-- ----------------------------------------------------------------------------
-- The policies on `propositions` defined in migration
-- 20251114173004_77259e0b-0297-4227-9970-e4ba210abb7b.sql used:
--
--   has_role(auth.uid(), 'admin') OR ...
--
-- WITHOUT any tenant_id scoping. Even though the table got a tenant_id
-- column on 2025-12-29, the policies were never updated to use it.
--
-- Result: any tenant admin could SELECT / INSERT / UPDATE / DELETE
-- propositions across ALL tenants. Active leak for ~6 months.
--
-- This is the same class of bug as the one fixed today on `clients`
-- (migration 20260508140000).
--
-- FIX
-- ----------------------------------------------------------------------------
-- Drop and recreate all 4 policies with `tenant_id = public.get_user_tenant_id()`
-- as a mandatory clause. The role-based logic is preserved so the change is
-- transparent for legitimate users.
--
-- ROLLBACK: re-apply 20251114173004 to restore the previous (broken) policies.
-- ============================================================================

DROP POLICY IF EXISTS "Users can view propositions for their clients" ON public.propositions;
DROP POLICY IF EXISTS "Agents can create propositions" ON public.propositions;
DROP POLICY IF EXISTS "Agents can update their propositions" ON public.propositions;
DROP POLICY IF EXISTS "Admins can delete propositions" ON public.propositions;


-- ----- SELECT -----
CREATE POLICY "Tenant users can view propositions"
ON public.propositions
FOR SELECT
TO authenticated
USING (
  public.is_king()
  OR (
    tenant_id = public.get_user_tenant_id()
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'manager'::public.app_role)
      OR public.has_role(auth.uid(), 'backoffice'::public.app_role)
      OR agent_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.id = propositions.client_id
          AND (c.user_id = auth.uid() OR c.assigned_agent_id = auth.uid())
      )
    )
  )
);


-- ----- INSERT -----
CREATE POLICY "Tenant staff can create propositions"
ON public.propositions
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_king()
  OR (
    tenant_id = public.get_user_tenant_id()
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'agent'::public.app_role)
      OR public.has_role(auth.uid(), 'manager'::public.app_role)
      OR public.has_role(auth.uid(), 'backoffice'::public.app_role)
    )
  )
);


-- ----- UPDATE -----
CREATE POLICY "Tenant staff can update propositions"
ON public.propositions
FOR UPDATE
TO authenticated
USING (
  public.is_king()
  OR (
    tenant_id = public.get_user_tenant_id()
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'manager'::public.app_role)
      OR agent_id = auth.uid()
    )
  )
);


-- ----- DELETE -----
CREATE POLICY "Tenant admins can delete propositions"
ON public.propositions
FOR DELETE
TO authenticated
USING (
  public.is_king()
  OR (
    tenant_id = public.get_user_tenant_id()
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);
