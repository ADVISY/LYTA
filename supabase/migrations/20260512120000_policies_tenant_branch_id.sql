-- ============================================================================
-- Per-policy branch override
-- ============================================================================
-- Until now the branch shown on a contract card was always inherited from
-- the linked insurance_product.tenant_branch_id. The broker could change
-- that at the catalog level (Partners page), but it would affect every
-- contract using that product.
--
-- We now allow each policy to optionally carry its own branch override:
--   - policies.tenant_branch_id NULL → use the product's branch (default)
--   - policies.tenant_branch_id set  → display this branch on this contract
--
-- Useful when the same product is sold in slightly different configurations
-- (e.g. a generic "Swica BASIS" product that the broker wants to display as
-- "Santé LAMal + LCA" on one customer and pure "LAMal" on another).
-- ============================================================================

ALTER TABLE public.policies
  ADD COLUMN IF NOT EXISTS tenant_branch_id UUID REFERENCES public.tenant_branches(id);

CREATE INDEX IF NOT EXISTS idx_policies_tenant_branch
  ON public.policies(tenant_branch_id);

COMMENT ON COLUMN public.policies.tenant_branch_id IS
  'Optional per-contract branch override. When NULL, the UI falls back to the linked product''s tenant_branch.';
