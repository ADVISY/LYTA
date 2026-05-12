-- ============================================================================
-- Relax DELETE RLS on policies so admin / manager / backoffice can delete
-- ============================================================================
-- Until now only the strict 'admin' role on the tenant could delete a policy
-- (via the FOR ALL policy that includes DELETE). In practice, brokerages
-- want their managers and backoffice staff to also be able to delete a
-- mistakenly-created contract, while agents and partners must NOT.
--
-- We add an explicit FOR DELETE policy that is more permissive than ALL
-- but still tenant-scoped, then keep the existing king bypass.
-- ============================================================================

DROP POLICY IF EXISTS "Tenant staff can delete policies" ON public.policies;

CREATE POLICY "Tenant staff can delete policies"
ON public.policies FOR DELETE
USING (
  public.is_king()
  OR (
    tenant_id = public.get_user_tenant_id()
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'manager'::app_role)
      OR public.has_role(auth.uid(), 'backoffice'::app_role)
    )
  )
);

COMMENT ON POLICY "Tenant staff can delete policies" ON public.policies IS
  'Allows admin / manager / backoffice staff of the tenant to delete policies. Agents and partners cannot delete.';
