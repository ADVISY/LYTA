import { supabase } from "@/integrations/supabase/client";

// TODO API: Analytics endpoints pour les KPIs et rapports

export type Scope = 'partner' | 'admin';

export interface AnalyticsKPI {
  contractsActive: number;
  premiumsMonthly: number;
  commissionsYTD: number;
  churnRate: number;
}

// GET /api/analytics/kpi
export async function getAnalyticsKPI(
  scope: Scope,
  from?: string,
  to?: string,
  partnerId?: string
): Promise<AnalyticsKPI> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");

  // Get active contracts count
  let contractsQuery = supabase
    .from('policies')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active');

  if (scope === 'partner' && partnerId) {
    contractsQuery = contractsQuery.eq('partner_id', partnerId);
  }

  const { count: activeContracts } = await contractsQuery;

  // Get monthly premiums total
  let premiumsQuery = supabase
    .from('policies')
    .select('premium_monthly')
    .eq('status', 'active');

  if (scope === 'partner' && partnerId) {
    premiumsQuery = premiumsQuery.eq('partner_id', partnerId);
  }

  const { data: policies } = await premiumsQuery;
  const monthlyPremiums = policies?.reduce((sum, p) => sum + (Number(p.premium_monthly) || 0), 0) || 0;

  // Get YTD commissions
  const currentYear = new Date().getFullYear();
  let commissionsQuery = supabase
    .from('commissions')
    .select('amount')
    .eq('period_year', currentYear);

  if (scope === 'partner' && partnerId) {
    commissionsQuery = commissionsQuery.eq('partner_id', partnerId);
  }

  const { data: commissions } = await commissionsQuery;
  const commissionsYTD = commissions?.reduce((sum, c) => sum + Number(c.amount), 0) || 0;

  // Calculate churn rate (simplified: cancelled contracts / total contracts * 100)
  let cancelledQuery = supabase
    .from('policies')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'cancelled');

  if (scope === 'partner' && partnerId) {
    cancelledQuery = cancelledQuery.eq('partner_id', partnerId);
  }
  if (from) cancelledQuery = cancelledQuery.gte('created_at', from);
  if (to) cancelledQuery = cancelledQuery.lte('created_at', to);

  const { count: cancelledCount } = await cancelledQuery;

  let totalQuery = supabase
    .from('policies')
    .select('id', { count: 'exact', head: true });

  if (scope === 'partner' && partnerId) {
    totalQuery = totalQuery.eq('partner_id', partnerId);
  }

  const { count: totalCount } = await totalQuery;

  const churnRate = totalCount ? ((cancelledCount || 0) / totalCount) * 100 : 0;

  return {
    contractsActive: activeContracts || 0,
    premiumsMonthly: monthlyPremiums,
    commissionsYTD,
    churnRate: Math.round(churnRate * 100) / 100,
  };
}

// GET /api/analytics/distribution
export async function getDistribution(
  dimension: 'product' | 'company',
  partnerId?: string
) {
  let query = supabase
    .from('policies')
    .select(`
      id,
      product:insurance_products!inner (
        id,
        name,
        category,
        company:insurance_companies!inner (
          id,
          name
        )
      )
    `)
    .eq('status', 'active');

  if (partnerId) {
    query = query.eq('partner_id', partnerId);
  }

  const { data, error } = await query;

  if (error) throw error;

  // Group by dimension
  const distribution = new Map<string, number>();

  data?.forEach((policy: any) => {
    const key = dimension === 'product' 
      ? policy.product.name 
      : policy.product.company.name;
    
    distribution.set(key, (distribution.get(key) || 0) + 1);
  });

  return Array.from(distribution.entries()).map(([name, count]) => ({
    name,
    count,
  }));
}

// GET /api/analytics/premiums/timeseries
export async function getPremiumsTimeseries(
  granularity: 'month' | 'week' = 'month',
  from?: string,
  to?: string,
  partnerId?: string
) {
  let query = supabase
    .from('policies')
    .select('premium_yearly, premium_monthly, start_date, status')
    .order('start_date');

  if (partnerId) {
    query = query.eq('partner_id', partnerId);
  }
  if (from) query = query.gte('start_date', from);
  if (to) query = query.lte('start_date', to);

  const { data, error } = await query;

  if (error) throw error;

  // Group by month
  const grouped = new Map<string, number>();

  data?.forEach((policy) => {
    const date = new Date(policy.start_date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const amount = Number(policy.premium_yearly) || (Number(policy.premium_monthly) * 12) || 0;
    grouped.set(key, (grouped.get(key) || 0) + amount);
  });

  return Array.from(grouped.entries()).map(([period, amount]) => ({
    period,
    amount,
  }));
}
