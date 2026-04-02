
-- CRITICAL SECURITY FIX: Add tenant isolation to all RLS policies

-- 1. Update can_access_client function to include tenant check
CREATE OR REPLACE FUNCTION public.can_access_client(client_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    -- King peut tout voir (super admin global)
    is_king()
    OR
    (
      -- FIRST: Check tenant isolation - user must be in same tenant as client
      EXISTS (
        SELECT 1 FROM clients c 
        WHERE c.id = client_id 
        AND c.tenant_id = get_user_tenant_id()
      )
      AND
      (
        -- Admin, backoffice, compta de ce tenant peuvent voir les clients du tenant
        has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'backoffice'::app_role)
        OR has_role(auth.uid(), 'compta'::app_role)
        OR
        -- Le client lui-même
        EXISTS (
          SELECT 1 FROM clients c 
          WHERE c.id = client_id AND c.user_id = auth.uid()
        )
        OR
        -- Agent/Partner/Manager assigné au client
        EXISTS (
          SELECT 1 FROM clients agent 
          WHERE agent.user_id = auth.uid()
          AND EXISTS (
            SELECT 1 FROM clients target 
            WHERE target.id = client_id 
            AND (target.assigned_agent_id = agent.id OR target.manager_id = agent.id)
          )
        )
      )
    )
$function$;

-- 2. Drop existing policies on clients table
DROP POLICY IF EXISTS "Admins have full access" ON public.clients;
DROP POLICY IF EXISTS "Clients can update their own profile" ON public.clients;
DROP POLICY IF EXISTS "Partners and admins can create clients" ON public.clients;
DROP POLICY IF EXISTS "Partners can update clients" ON public.clients;
DROP POLICY IF EXISTS "Users can view accessible clients" ON public.clients;

-- 3. Create new tenant-isolated policies for clients
CREATE POLICY "Kings have full access to all clients"
ON public.clients FOR ALL
USING (is_king())
WITH CHECK (is_king());

CREATE POLICY "Tenant users can view their clients"
ON public.clients FOR SELECT
USING (
  tenant_id = get_user_tenant_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'backoffice'::app_role)
    OR has_role(auth.uid(), 'compta'::app_role)
    OR has_role(auth.uid(), 'partner'::app_role)
    OR has_role(auth.uid(), 'agent'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR user_id = auth.uid()
  )
);

CREATE POLICY "Tenant admins can manage clients"
ON public.clients FOR ALL
USING (
  tenant_id = get_user_tenant_id()
  AND has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  tenant_id = get_user_tenant_id()
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Tenant staff can create clients"
ON public.clients FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'partner'::app_role)
    OR has_role(auth.uid(), 'agent'::app_role)
    OR has_role(auth.uid(), 'backoffice'::app_role)
  )
);

CREATE POLICY "Tenant staff can update clients"
ON public.clients FOR UPDATE
USING (
  tenant_id = get_user_tenant_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'partner'::app_role)
    OR has_role(auth.uid(), 'agent'::app_role)
    OR has_role(auth.uid(), 'backoffice'::app_role)
    OR user_id = auth.uid()
  )
);

CREATE POLICY "Tenant admins can delete clients"
ON public.clients FOR DELETE
USING (
  tenant_id = get_user_tenant_id()
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- 4. Fix policies table - add tenant isolation
DROP POLICY IF EXISTS "Admins can manage all policies" ON public.policies;
DROP POLICY IF EXISTS "Clients can view their own policies" ON public.policies;
DROP POLICY IF EXISTS "Partners can create policies for their clients" ON public.policies;

CREATE POLICY "Kings have full access to all policies"
ON public.policies FOR ALL
USING (is_king())
WITH CHECK (is_king());

CREATE POLICY "Tenant users can view their policies"
ON public.policies FOR SELECT
USING (
  tenant_id = get_user_tenant_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'backoffice'::app_role)
    OR has_role(auth.uid(), 'compta'::app_role)
    OR has_role(auth.uid(), 'partner'::app_role)
    OR has_role(auth.uid(), 'agent'::app_role)
    OR EXISTS (SELECT 1 FROM clients c WHERE c.id = policies.client_id AND c.user_id = auth.uid())
  )
);

CREATE POLICY "Tenant admins can manage policies"
ON public.policies FOR ALL
USING (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Tenant staff can create policies"
ON public.policies FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'partner'::app_role)
    OR has_role(auth.uid(), 'agent'::app_role)
  )
);

-- 5. Fix commissions table - add tenant isolation
DROP POLICY IF EXISTS "Admins can manage all commissions" ON public.commissions;
DROP POLICY IF EXISTS "Partners can view their own commissions" ON public.commissions;

CREATE POLICY "Kings have full access to commissions"
ON public.commissions FOR ALL
USING (is_king())
WITH CHECK (is_king());

CREATE POLICY "Tenant users can view their commissions"
ON public.commissions FOR SELECT
USING (
  tenant_id = get_user_tenant_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'compta'::app_role)
    OR EXISTS (SELECT 1 FROM partners p WHERE p.id = commissions.partner_id AND p.user_id = auth.uid())
  )
);

CREATE POLICY "Tenant admins can manage commissions"
ON public.commissions FOR ALL
USING (tenant_id = get_user_tenant_id() AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'compta'::app_role)))
WITH CHECK (tenant_id = get_user_tenant_id() AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'compta'::app_role)));

-- 6. Fix documents table - add tenant isolation  
DROP POLICY IF EXISTS "Admins can manage all documents" ON public.documents;
DROP POLICY IF EXISTS "Users can view their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can create documents" ON public.documents;

CREATE POLICY "Kings have full access to documents"
ON public.documents FOR ALL
USING (is_king())
WITH CHECK (is_king());

CREATE POLICY "Tenant users can view their documents"
ON public.documents FOR SELECT
USING (
  tenant_id = get_user_tenant_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'backoffice'::app_role)
    OR created_by = auth.uid()
    OR (owner_type = 'client' AND EXISTS (SELECT 1 FROM clients c WHERE c.id = documents.owner_id AND c.user_id = auth.uid()))
  )
);

CREATE POLICY "Tenant staff can create documents"
ON public.documents FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'backoffice'::app_role)
    OR has_role(auth.uid(), 'partner'::app_role)
    OR has_role(auth.uid(), 'agent'::app_role)
  )
);

CREATE POLICY "Tenant admins can manage documents"
ON public.documents FOR ALL
USING (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'admin'::app_role));

-- 7. Fix suivis table - add tenant isolation
DROP POLICY IF EXISTS "Admins can delete suivis" ON public.suivis;
DROP POLICY IF EXISTS "Agents can create suivis" ON public.suivis;
DROP POLICY IF EXISTS "Agents can update their suivis" ON public.suivis;
DROP POLICY IF EXISTS "Users can view suivis for their clients or assigned to them" ON public.suivis;

CREATE POLICY "Kings have full access to suivis"
ON public.suivis FOR ALL
USING (is_king())
WITH CHECK (is_king());

CREATE POLICY "Tenant users can view their suivis"
ON public.suivis FOR SELECT
USING (
  tenant_id = get_user_tenant_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR assigned_agent_id = auth.uid()
    OR EXISTS (SELECT 1 FROM clients c WHERE c.id = suivis.client_id AND (c.user_id = auth.uid() OR c.assigned_agent_id = auth.uid()))
  )
);

CREATE POLICY "Tenant staff can create suivis"
ON public.suivis FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'agent'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  )
);

CREATE POLICY "Tenant staff can update suivis"
ON public.suivis FOR UPDATE
USING (
  tenant_id = get_user_tenant_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR assigned_agent_id = auth.uid()
  )
);

CREATE POLICY "Tenant admins can delete suivis"
ON public.suivis FOR DELETE
USING (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'admin'::app_role));
