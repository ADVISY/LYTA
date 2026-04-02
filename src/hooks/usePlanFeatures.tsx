import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserTenant } from '@/hooks/useUserTenant';
import { 
  TenantPlan, 
  PlanModule, 
  getEnabledModules as getStaticEnabledModules, 
  isModuleEnabled as isStaticModuleEnabled,
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

// Cache for plan modules from database
let cachedPlanModules: Record<string, string[]> | null = null;
let cachedModuleNames: Record<string, string> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch plan modules from database (with caching)
 */
async function fetchPlanModulesFromDB(): Promise<{ planModules: Record<string, string[]>; moduleNames: Record<string, string> }> {
  const now = Date.now();
  
  // Return cached data if still valid
  if (cachedPlanModules && cachedModuleNames && (now - cacheTimestamp) < CACHE_TTL) {
    return { planModules: cachedPlanModules, moduleNames: cachedModuleNames };
  }

  try {
    const [planModulesRes, modulesRes] = await Promise.all([
      supabase.from('plan_modules').select('plan_id, module_id'),
      supabase.from('platform_modules').select('id, display_name')
    ]);

    const planModules: Record<string, string[]> = {};
    const moduleNames: Record<string, string> = {};

    if (planModulesRes.data) {
      for (const pm of planModulesRes.data) {
        if (!planModules[pm.plan_id]) planModules[pm.plan_id] = [];
        planModules[pm.plan_id].push(pm.module_id);
      }
    }

    if (modulesRes.data) {
      for (const m of modulesRes.data) {
        moduleNames[m.id] = m.display_name;
      }
    }

    // Update cache
    cachedPlanModules = planModules;
    cachedModuleNames = moduleNames;
    cacheTimestamp = now;

    return { planModules, moduleNames };
  } catch (error) {
    console.error('Error fetching plan modules from DB:', error);
    // Fallback to static config
    return { planModules: {}, moduleNames: {} };
  }
}

/**
 * Hook to access plan features and module gating
 * Uses database-driven configuration with fallback to static config
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
  const [dbPlanModules, setDbPlanModules] = useState<Record<string, string[]>>({});
  const [dbModuleNames, setDbModuleNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlanInfo = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Fetch tenant plan info and DB modules in parallel
      const [tenantRes, dbData] = await Promise.all([
        supabase
          .from('tenants')
          .select('plan, plan_status, billing_status, seats_included, seats_price')
          .eq('id', tenantId)
          .maybeSingle(),
        fetchPlanModulesFromDB()
      ]);

      if (tenantRes.error) {
        console.error('Error fetching plan info:', tenantRes.error);
        setError('Erreur lors du chargement du plan');
        return;
      }

      if (tenantRes.data) {
        setPlanInfo({
          plan: (tenantRes.data.plan as TenantPlan) || 'start',
          planStatus: (tenantRes.data.plan_status as 'active' | 'suspended') || 'active',
          billingStatus: (tenantRes.data.billing_status as 'paid' | 'trial' | 'past_due' | 'canceled') || 'trial',
          seatsIncluded: tenantRes.data.seats_included || 1,
          seatsPrice: tenantRes.data.seats_price || 20,
        });
      }

      setDbPlanModules(dbData.planModules);
      setDbModuleNames(dbData.moduleNames);
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

  // Get enabled modules - prefer DB, fallback to static
  const enabledModules = useCallback(() => {
    const dbModules = dbPlanModules[planInfo.plan];
    if (dbModules && dbModules.length > 0) {
      return dbModules as PlanModule[];
    }
    // Fallback to static config
    return getStaticEnabledModules(planInfo.plan);
  }, [planInfo.plan, dbPlanModules])();

  const hasModule = useCallback(
    (module: PlanModule) => {
      const dbModules = dbPlanModules[planInfo.plan];
      if (dbModules && dbModules.length > 0) {
        return dbModules.includes(module);
      }
      // Fallback to static
      return isStaticModuleEnabled(planInfo.plan, module);
    },
    [planInfo.plan, dbPlanModules]
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
    (module: PlanModule) => {
      // Prefer DB name, fallback to static
      return dbModuleNames[module] || MODULE_DISPLAY_NAMES[module] || module;
    },
    [dbModuleNames]
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
