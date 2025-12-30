
-- CRITICAL SECURITY FIX PART 2: Fix remaining tables with tenant isolation

-- 1. Fix decomptes table
DROP POLICY IF EXISTS "Admin and compta can manage decomptes" ON public.decomptes;
DROP POLICY IF EXISTS "Agents can view their own decomptes" ON public.decomptes;
DROP POLICY IF EXISTS "Managers can view team decomptes" ON public.decomptes;

CREATE POLICY "Kings have full access to decomptes"
ON public.decomptes FOR ALL
USING (is_king())
WITH CHECK (is_king());

CREATE POLICY "Tenant admins can manage decomptes"
ON public.decomptes FOR ALL
USING (tenant_id = get_user_tenant_id() AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'compta'::app_role)))
WITH CHECK (tenant_id = get_user_tenant_id() AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'compta'::app_role)));

CREATE POLICY "Tenant agents can view their decomptes"
ON public.decomptes FOR SELECT
USING (
  tenant_id = get_user_tenant_id()
  AND EXISTS (SELECT 1 FROM clients c WHERE c.id = decomptes.agent_id AND c.user_id = auth.uid())
);

CREATE POLICY "Tenant managers can view team decomptes"
ON public.decomptes FOR SELECT
USING (
  tenant_id = get_user_tenant_id()
  AND has_role(auth.uid(), 'manager'::app_role)
  AND EXISTS (
    SELECT 1 FROM clients agent
    JOIN clients manager ON agent.manager_id = manager.id
    WHERE agent.id = decomptes.agent_id AND manager.user_id = auth.uid()
  )
);

-- 2. Fix decompte_lines table  
DROP POLICY IF EXISTS "Admin and compta can manage decompte lines" ON public.decompte_lines;
DROP POLICY IF EXISTS "Users can view their decompte lines" ON public.decompte_lines;

CREATE POLICY "Kings have full access to decompte_lines"
ON public.decompte_lines FOR ALL
USING (is_king())
WITH CHECK (is_king());

CREATE POLICY "Tenant admins can manage decompte_lines"
ON public.decompte_lines FOR ALL
USING (
  EXISTS (SELECT 1 FROM decomptes d WHERE d.id = decompte_lines.decompte_id AND d.tenant_id = get_user_tenant_id())
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'compta'::app_role))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM decomptes d WHERE d.id = decompte_lines.decompte_id AND d.tenant_id = get_user_tenant_id())
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'compta'::app_role))
);

CREATE POLICY "Tenant users can view their decompte_lines"
ON public.decompte_lines FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM decomptes d
    JOIN clients c ON d.agent_id = c.id
    WHERE d.id = decompte_lines.decompte_id 
    AND d.tenant_id = get_user_tenant_id()
    AND c.user_id = auth.uid()
  )
);

-- 3. Fix transactions table
DROP POLICY IF EXISTS "Admins can manage all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Agents can view their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Compta can insert transactions" ON public.transactions;
DROP POLICY IF EXISTS "Compta can update unlocked transactions" ON public.transactions;
DROP POLICY IF EXISTS "Compta can view and update transactions" ON public.transactions;
DROP POLICY IF EXISTS "Managers can view team transactions" ON public.transactions;

CREATE POLICY "Kings have full access to transactions"
ON public.transactions FOR ALL
USING (is_king())
WITH CHECK (is_king());

CREATE POLICY "Tenant admins can manage transactions"
ON public.transactions FOR ALL
USING (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Tenant compta can manage transactions"
ON public.transactions FOR ALL
USING (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'compta'::app_role) AND (locked = false OR true))
WITH CHECK (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'compta'::app_role));

CREATE POLICY "Tenant agents can view their transactions"
ON public.transactions FOR SELECT
USING (
  tenant_id = get_user_tenant_id()
  AND EXISTS (SELECT 1 FROM clients c WHERE c.id = transactions.agent_id AND c.user_id = auth.uid())
);

CREATE POLICY "Tenant managers can view team transactions"
ON public.transactions FOR SELECT
USING (
  tenant_id = get_user_tenant_id()
  AND has_role(auth.uid(), 'manager'::app_role)
  AND EXISTS (
    SELECT 1 FROM clients agent
    JOIN clients manager ON agent.manager_id = manager.id
    WHERE agent.id = transactions.agent_id AND manager.user_id = auth.uid()
  )
);

-- 4. Fix family_members table (inherits tenant from client)
DROP POLICY IF EXISTS "Admins can delete family members" ON public.family_members;
DROP POLICY IF EXISTS "Admins can manage all family members" ON public.family_members;
DROP POLICY IF EXISTS "Staff can create family members" ON public.family_members;
DROP POLICY IF EXISTS "Staff can update family members" ON public.family_members;
DROP POLICY IF EXISTS "Users can view family members for their clients" ON public.family_members;

CREATE POLICY "Kings have full access to family_members"
ON public.family_members FOR ALL
USING (is_king())
WITH CHECK (is_king());

CREATE POLICY "Tenant users can view family_members"
ON public.family_members FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM clients c 
    WHERE c.id = family_members.client_id 
    AND c.tenant_id = get_user_tenant_id()
  )
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'partner'::app_role)
    OR has_role(auth.uid(), 'agent'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'backoffice'::app_role)
    OR EXISTS (SELECT 1 FROM clients c WHERE c.id = family_members.client_id AND (c.user_id = auth.uid() OR c.assigned_agent_id = auth.uid()))
  )
);

CREATE POLICY "Tenant staff can create family_members"
ON public.family_members FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM clients c WHERE c.id = family_members.client_id AND c.tenant_id = get_user_tenant_id())
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'partner'::app_role)
    OR has_role(auth.uid(), 'agent'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'backoffice'::app_role)
  )
);

CREATE POLICY "Tenant staff can update family_members"
ON public.family_members FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM clients c WHERE c.id = family_members.client_id AND c.tenant_id = get_user_tenant_id())
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'partner'::app_role)
    OR has_role(auth.uid(), 'agent'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'backoffice'::app_role)
  )
);

CREATE POLICY "Tenant admins can delete family_members"
ON public.family_members FOR DELETE
USING (
  EXISTS (SELECT 1 FROM clients c WHERE c.id = family_members.client_id AND c.tenant_id = get_user_tenant_id())
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- 5. Fix claims table
DROP POLICY IF EXISTS "claims_select_policy" ON public.claims;
DROP POLICY IF EXISTS "claims_insert_policy" ON public.claims;
DROP POLICY IF EXISTS "claims_update_policy" ON public.claims;
DROP POLICY IF EXISTS "claims_delete_policy" ON public.claims;

CREATE POLICY "Kings have full access to claims"
ON public.claims FOR ALL
USING (is_king())
WITH CHECK (is_king());

CREATE POLICY "Tenant users can view claims"
ON public.claims FOR SELECT
USING (
  tenant_id = get_user_tenant_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'backoffice'::app_role)
    OR EXISTS (SELECT 1 FROM clients c WHERE c.id = claims.client_id AND c.user_id = auth.uid())
  )
);

CREATE POLICY "Tenant staff can create claims"
ON public.claims FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'backoffice'::app_role)
    OR EXISTS (SELECT 1 FROM clients c WHERE c.id = claims.client_id AND c.user_id = auth.uid())
  )
);

CREATE POLICY "Tenant staff can update claims"
ON public.claims FOR UPDATE
USING (
  tenant_id = get_user_tenant_id()
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'backoffice'::app_role))
);

CREATE POLICY "Tenant admins can delete claims"
ON public.claims FOR DELETE
USING (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'admin'::app_role));

-- 6. Fix notifications table
DROP POLICY IF EXISTS "notifications_select_policy" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_policy" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_policy" ON public.notifications;
DROP POLICY IF EXISTS "Users can view their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

CREATE POLICY "Kings have full access to notifications"
ON public.notifications FOR ALL
USING (is_king())
WITH CHECK (is_king());

CREATE POLICY "Users can view their notifications"
ON public.notifications FOR SELECT
USING (
  user_id = auth.uid()
  AND (tenant_id IS NULL OR tenant_id = get_user_tenant_id())
);

CREATE POLICY "Users can update their notifications"
ON public.notifications FOR UPDATE
USING (
  user_id = auth.uid()
  AND (tenant_id IS NULL OR tenant_id = get_user_tenant_id())
);

CREATE POLICY "System can create notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);
