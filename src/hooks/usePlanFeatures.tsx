import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserTenant } from '@/hooks/useUserTenant';
import { 
  TenantPlan, 
  PlanModule, 
  getEnabledModules, 
  isModuleEnabled,
  PLAN_CONFIGS,
  MODULE_DISPLAY_NAMES 
} from '@/config/plans';

interface TenantPlanInfo {
  plan: TenantPlan;
  planStatus: 'active' | 'suspended';
  billingStatus: 'paid' | 'trial' | 'past_due' | 'canceled';
  seatsIncluded: number;
  seatsPrice: number;
}

interface UsePlanFeaturesReturn {
  /** Current tenant plan */
  plan: TenantPlan;
  /** Plan display name */
  planDisplayName: string;
  /** All enabled modules for the current plan */
  enabledModules: PlanModule[];
  /** Check if a specific module is enabled */
  hasModule: (module: PlanModule) => boolean;
  /** Check if multiple modules are enabled (any) */
  hasAnyModule: (modules: PlanModule[]) => boolean;
  /** Check if multiple modules are enabled (all) */
  hasAllModules: (modules: PlanModule[]) => boolean;
  /** Get display name for a module */
  getModuleName: (module: PlanModule) => string;
  /** Plan status (active/suspended) */
  planStatus: 'active' | 'suspended';
  /** Billing status */
  billingStatus: 'paid' | 'trial' | 'past_due' | 'canceled';
  /** Number of seats included */
  seatsIncluded: number;
  /** Price per additional seat */
  seatsPrice: number;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: string | null;
  /** Refresh plan info */
  refresh: () => Promise<void>;
}

/**
 * Hook to access plan features and module gating
 */
export function usePlanFeatures(): UsePlanFeaturesReturn {
  const { tenantId, loading: tenantLoading } = useUserTenant();
  const [planInfo, setPlanInfo] = useState<TenantPlanInfo>({
    plan: 'start',
    planStatus: 'active',
    billingStatus: 'trial',
    seatsIncluded: 1,
    seatsPrice: 20,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlanInfo = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('tenants')
        .select('plan, plan_status, billing_status, seats_included, seats_price')
        .eq('id', tenantId)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching plan info:', fetchError);
        setError('Erreur lors du chargement du plan');
        return;
      }

      if (data) {
        setPlanInfo({
          plan: (data.plan as TenantPlan) || 'start',
          planStatus: (data.plan_status as 'active' | 'suspended') || 'active',
          billingStatus: (data.billing_status as 'paid' | 'trial' | 'past_due' | 'canceled') || 'trial',
          seatsIncluded: data.seats_included || 1,
          seatsPrice: data.seats_price || 20,
        });
      }
    } catch (err) {
      console.error('Error in plan fetch:', err);
      setError('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (!tenantLoading) {
      fetchPlanInfo();
    }
  }, [tenantId, tenantLoading, fetchPlanInfo]);

  const enabledModules = getEnabledModules(planInfo.plan);

  const hasModule = useCallback(
    (module: PlanModule) => isModuleEnabled(planInfo.plan, module),
    [planInfo.plan]
  );

  const hasAnyModule = useCallback(
    (modules: PlanModule[]) => modules.some((m) => hasModule(m)),
    [hasModule]
  );

  const hasAllModules = useCallback(
    (modules: PlanModule[]) => modules.every((m) => hasModule(m)),
    [hasModule]
  );

  const getModuleName = useCallback(
    (module: PlanModule) => MODULE_DISPLAY_NAMES[module] || module,
    []
  );

  return {
    plan: planInfo.plan,
    planDisplayName: PLAN_CONFIGS[planInfo.plan]?.displayName || 'Start',
    enabledModules,
    hasModule,
    hasAnyModule,
    hasAllModules,
    getModuleName,
    planStatus: planInfo.planStatus,
    billingStatus: planInfo.billingStatus,
    seatsIncluded: planInfo.seatsIncluded,
    seatsPrice: planInfo.seatsPrice,
    loading: loading || tenantLoading,
    error,
    refresh: fetchPlanInfo,
  };
}

/**
 * Hook to get active user count for a tenant (for seat management)
 */
export function useTenantSeats() {
  const { tenantId, loading: tenantLoading } = useUserTenant();
  const [activeUsers, setActiveUsers] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActiveUsers = async () => {
      if (!tenantId) {
        setLoading(false);
        return;
      }

      try {
        // Count users assigned to this tenant
        const { count, error } = await supabase
          .from('user_tenant_assignments')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId);

        if (!error && count !== null) {
          setActiveUsers(count);
        }
      } catch (err) {
        console.error('Error fetching active users:', err);
      } finally {
        setLoading(false);
      }
    };

    if (!tenantLoading) {
      fetchActiveUsers();
    }
  }, [tenantId, tenantLoading]);

  return {
    activeUsers,
    loading: loading || tenantLoading,
  };
}
