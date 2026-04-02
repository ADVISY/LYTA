import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PlanStats {
  count: number;
  mrr: number;
}

export interface TenantSubscription {
  plan: string;
  mrr: number;
  extraUsers: number;
  status: string;
  subscriptionId: string;
  customerId: string;
  currentPeriodEnd: string;
}

export interface RevenueChartData {
  month: string;
  revenue: number;
}

export interface StripeStats {
  mrr: number;
  arr: number;
  extraUsersMRR: number;
  upcomingInvoices: number;
  planStats: Record<string, PlanStats>;
  revenueChart: RevenueChartData[];
  totalActiveSubscriptions: number;
  totalPastDueSubscriptions: number;
  tenantSubscriptions: Record<string, TenantSubscription>;
  customerEmails: Record<string, string>;
}

export function useStripeStats() {
  return useQuery({
    queryKey: ['king-stripe-stats'],
    queryFn: async (): Promise<StripeStats | null> => {
      try {
        // Get session to ensure we have the auth token
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          console.error('No active session');
          return null;
        }

        const { data, error } = await supabase.functions.invoke('king-stripe-stats', {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
        });
        
        if (error) {
          console.error('Error fetching Stripe stats:', error);
          return null;
        }
        
        return data as StripeStats;
      } catch (err) {
        console.error('Error invoking king-stripe-stats:', err);
        return null;
      }
    },
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000,
  });
}
