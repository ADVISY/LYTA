import { supabase } from "@/integrations/supabase/client";

// TODO API: REST-style functions pour interagir avec l'API Supabase

export interface PolicyFilters {
  status?: string[];
  productId?: string;
  companyId?: string;
  from?: string;
  to?: string;
  partnerId?: string;
  clientId?: string;
}

export interface CreatePolicyInput {
  clientId: string;
  productId: string;
  partnerId: string;
  startDate: string;
  endDate?: string;
  premiumMonthly?: number;
  premiumYearly?: number;
  deductible?: number;
  currency?: string;
  policyNumber?: string;
  notes?: string;
}

export interface UpdatePolicyInput {
  status?: 'active' | 'pending' | 'suspended' | 'cancelled' | 'expired';
  endDate?: string;
  partnerId?: string;
  premiumMonthly?: number;
  premiumYearly?: number;
  deductible?: number;
  notes?: string;
}

// GET /api/partner/policies
export async function getPartnerPolicies(
  partnerId: string,
  filters?: PolicyFilters,
  page = 1,
  limit = 25
) {
  let query = supabase
    .from('policies')
    .select(`
      *,
      client:clients!inner (
        id,
        company_name,
        is_company,
        birthdate,
        profiles:user_id (full_name, email)
      ),
      product:insurance_products!inner (
        id,
        name,
        category,
        company:insurance_companies!inner (id, name)
      ),
      contracts (
        id,
        signature_status,
        signed_at,
        renewal_date
      ),
      commissions (
        id,
        amount,
        status
      )
    `, { count: 'exact' })
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false });

  // Apply filters
  if (filters?.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  }
  if (filters?.productId) {
    query = query.eq('product_id', filters.productId);
  }
  if (filters?.clientId) {
    query = query.eq('client_id', filters.clientId);
  }
  if (filters?.from) {
    query = query.gte('start_date', filters.from);
  }
  if (filters?.to) {
    query = query.lte('start_date', filters.to);
  }

  // Pagination
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) throw error;

  return {
    data: data || [],
    page,
    limit,
    total: count || 0,
  };
}

// GET /api/partner/policies/:id
export async function getPolicyById(policyId: string) {
  const { data, error } = await supabase
    .from('policies')
    .select(`
      *,
      client:clients!inner (
        *,
        profiles:user_id (full_name, email, phone)
      ),
      product:insurance_products!inner (
        *,
        company:insurance_companies!inner (*)
      ),
      partner:partners (
        *,
        profiles:user_id (full_name, email)
      ),
      contracts (
        *
      ),
      commissions (
        *
      ),
      documents:documents!owner_id (
        *
      )
    `)
    .eq('id', policyId)
    .single();

  if (error) throw error;
  return data;
}

// POST /api/partner/policies
export async function createPolicy(input: CreatePolicyInput) {
  const { data, error } = await supabase
    .from('policies')
    .insert({
      client_id: input.clientId,
      product_id: input.productId,
      partner_id: input.partnerId,
      start_date: input.startDate,
      end_date: input.endDate,
      premium_monthly: input.premiumMonthly,
      premium_yearly: input.premiumYearly,
      deductible: input.deductible,
      currency: input.currency || 'CHF',
      policy_number: input.policyNumber,
      notes: input.notes,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;

  // Create audit log
  await supabase.rpc('create_audit_log', {
    p_user_id: (await supabase.auth.getUser()).data.user?.id,
    p_action: 'CREATE_POLICY',
    p_entity: 'policy',
    p_entity_id: data.id,
    p_metadata: { policy_number: input.policyNumber },
  });

  return data;
}

// PATCH /api/partner/policies/:id
export async function updatePolicy(policyId: string, input: UpdatePolicyInput) {
  const { data, error } = await supabase
    .from('policies')
    .update(input)
    .eq('id', policyId)
    .select()
    .single();

  if (error) throw error;

  // Create audit log
  await supabase.rpc('create_audit_log', {
    p_user_id: (await supabase.auth.getUser()).data.user?.id,
    p_action: 'UPDATE_POLICY',
    p_entity: 'policy',
    p_entity_id: policyId,
    p_metadata: input as any,
  });

  return data;
}

// GET /api/client/me/policies
export async function getMyPolicies() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");

  const { data, error } = await supabase
    .from('policies')
    .select(`
      *,
      product:insurance_products!inner (
        *,
        company:insurance_companies!inner (*)
      ),
      partner:partners (
        profiles:user_id (full_name, email)
      ),
      contracts (*)
    `)
    .eq('client.user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}
