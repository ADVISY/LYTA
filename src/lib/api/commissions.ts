import { supabase } from "@/integrations/supabase/client";

// TODO API: REST-style functions pour les commissions

export interface CommissionFilters {
  status?: string[];
  productId?: string;
  companyId?: string;
  from?: string;
  to?: string;
  partnerId?: string;
}

export interface CreateCommissionInput {
  policyId: string;
  partnerId: string;
  amount: number;
  status: 'paid' | 'due' | 'pending';
  periodMonth?: number;
  periodYear?: number;
  paidAt?: string;
  notes?: string;
}

// GET /api/partner/commissions
export async function getPartnerCommissions(
  partnerId: string,
  filters?: CommissionFilters,
  page = 1,
  limit = 25
) {
  let query = supabase
    .from('commissions')
    .select(`
      *,
      policy:policies!inner (
        id,
        policy_number,
        client:clients!inner (
          company_name,
          is_company,
          profiles:user_id (full_name)
        ),
        product:insurance_products!inner (
          name,
          category,
          company:insurance_companies!inner (name)
        )
      )
    `, { count: 'exact' })
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false });

  // Apply filters
  if (filters?.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  }
  if (filters?.from) {
    query = query.gte('created_at', filters.from);
  }
  if (filters?.to) {
    query = query.lte('created_at', filters.to);
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

// POST /api/partner/commissions
export async function createCommission(input: CreateCommissionInput) {
  const { data, error } = await supabase
    .from('commissions')
    .insert({
      policy_id: input.policyId,
      partner_id: input.partnerId,
      amount: input.amount,
      status: input.status,
      period_month: input.periodMonth,
      period_year: input.periodYear,
      paid_at: input.paidAt,
      notes: input.notes,
    })
    .select()
    .single();

  if (error) throw error;

  // Create audit log
  await supabase.rpc('create_audit_log', {
    p_user_id: (await supabase.auth.getUser()).data.user?.id,
    p_action: 'CREATE_COMMISSION',
    p_entity: 'commission',
    p_entity_id: data.id,
    p_metadata: { amount: input.amount, policy_id: input.policyId },
  });

  return data;
}

// PATCH /api/partner/commissions/:id
export async function updateCommission(
  commissionId: string,
  updates: {
    status?: 'paid' | 'due' | 'pending';
    paidAt?: string;
    amount?: number;
    notes?: string;
  }
) {
  const { data, error } = await supabase
    .from('commissions')
    .update(updates)
    .eq('id', commissionId)
    .select()
    .single();

  if (error) throw error;

  // Create audit log
  await supabase.rpc('create_audit_log', {
    p_user_id: (await supabase.auth.getUser()).data.user?.id,
    p_action: 'UPDATE_COMMISSION',
    p_entity: 'commission',
    p_entity_id: commissionId,
    p_metadata: updates,
  });

  return data;
}

// GET /api/analytics/commissions/summary
export async function getCommissionsSummary(partnerId: string, from?: string, to?: string) {
  let query = supabase
    .from('commissions')
    .select('amount, status')
    .eq('partner_id', partnerId);

  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);

  const { data, error } = await query;

  if (error) throw error;

  const summary = {
    total: 0,
    paid: 0,
    due: 0,
    pending: 0,
  };

  data?.forEach((commission) => {
    const amount = Number(commission.amount);
    summary.total += amount;
    
    if (commission.status === 'paid') {
      summary.paid += amount;
    } else if (commission.status === 'due') {
      summary.due += amount;
    } else if (commission.status === 'pending') {
      summary.pending += amount;
    }
  });

  return summary;
}

// GET /api/analytics/commissions/timeseries
export async function getCommissionsTimeseries(
  partnerId: string,
  granularity: 'month' | 'week' = 'month',
  from?: string,
  to?: string
) {
  let query = supabase
    .from('commissions')
    .select('amount, created_at, period_month, period_year, status')
    .eq('partner_id', partnerId)
    .order('period_year', { ascending: true })
    .order('period_month', { ascending: true });

  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);

  const { data, error } = await query;

  if (error) throw error;

  // Group by period
  const grouped = new Map<string, number>();

  data?.forEach((commission) => {
    const key = `${commission.period_year}-${String(commission.period_month).padStart(2, '0')}`;
    const current = grouped.get(key) || 0;
    grouped.set(key, current + Number(commission.amount));
  });

  return Array.from(grouped.entries()).map(([period, amount]) => ({
    period,
    amount,
  }));
}
