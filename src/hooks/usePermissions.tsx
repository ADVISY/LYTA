import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";

// Permission modules and actions types
export type PermissionModule = 
  | 'clients' 
  | 'contracts' 
  | 'partners' 
  | 'products' 
  | 'collaborators' 
  | 'commissions' 
  | 'decomptes' 
  | 'payout' 
  | 'dashboard' 
  | 'settings';

export type PermissionAction = 
  | 'view' 
  | 'create' 
  | 'update' 
  | 'delete' 
  | 'export' 
  | 'deposit' 
  | 'cancel' 
  | 'generate' 
  | 'validate' 
  | 'modify_rules';

export type DashboardScope = 'personal' | 'team' | 'global';
export type CommissionScope = 'none' | 'own' | 'team' | 'all';

interface UserPermissions {
  permissions: Map<string, boolean>;
  dashboardScope: DashboardScope;
  commissionScope: CommissionScope;
  roles: string[];
  isAdmin: boolean;
}

interface UsePermissionsReturn {
  can: (module: PermissionModule, action: PermissionAction) => boolean;
  canAny: (module: PermissionModule, actions: PermissionAction[]) => boolean;
  canAll: (module: PermissionModule, actions: PermissionAction[]) => boolean;
  dashboardScope: DashboardScope;
  commissionScope: CommissionScope;
  roles: string[];
  isAdmin: boolean;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export function usePermissions(): UsePermissionsReturn {
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const [permissions, setPermissions] = useState<UserPermissions>({
    permissions: new Map(),
    dashboardScope: 'personal',
    commissionScope: 'none',
    roles: [],
    isAdmin: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  const loadPermissions = useCallback(async () => {
    if (!user?.id || !tenantId) {
      setIsLoading(false);
      return;
    }

    try {
      // Get user's roles for this tenant
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_tenant_roles')
        .select(`
          role_id,
          tenant_roles (
            id,
            name,
            is_active,
            dashboard_scope,
            can_see_own_commissions,
            can_see_team_commissions,
            can_see_all_commissions
          )
        `)
        .eq('user_id', user.id)
        .eq('tenant_id', tenantId);

      if (rolesError) {
        console.error('Error loading user roles:', rolesError);
        setIsLoading(false);
        return;
      }

      // Filter active roles
      const activeRoles = userRoles?.filter(ur => ur.tenant_roles?.is_active) || [];
      const roleNames = activeRoles.map(ur => ur.tenant_roles?.name || '').filter(Boolean);
      const roleIds = activeRoles.map(ur => ur.role_id);

      // Check if user is admin
      const isAdmin = roleNames.some(name => 
        name.toLowerCase().includes('admin') || name.toLowerCase() === 'administrateur'
      );

      // Calculate dashboard scope (highest privilege wins)
      let dashboardScope: DashboardScope = 'personal';
      for (const ur of activeRoles) {
        const scope = ur.tenant_roles?.dashboard_scope as DashboardScope | undefined;
        if (scope === 'global') {
          dashboardScope = 'global';
          break;
        }
        if (scope === 'team' && dashboardScope === 'personal') {
          dashboardScope = 'team';
        }
      }

      // Calculate commission scope (highest privilege wins)
      let commissionScope: CommissionScope = 'none';
      for (const ur of activeRoles) {
        if (ur.tenant_roles?.can_see_all_commissions) {
          commissionScope = 'all';
          break;
        }
        if (ur.tenant_roles?.can_see_team_commissions && commissionScope !== 'all' && commissionScope !== 'team') {
          commissionScope = 'team';
        }
        if (ur.tenant_roles?.can_see_own_commissions && commissionScope === 'none') {
          commissionScope = 'own';
        }
      }

      // Get all permissions for user's roles
      if (roleIds.length > 0) {
        const { data: rolePermissions, error: permError } = await supabase
          .from('tenant_role_permissions')
          .select('module, action, allowed')
          .in('role_id', roleIds)
          .eq('allowed', true);

        if (permError) {
          console.error('Error loading permissions:', permError);
        }

        const permMap = new Map<string, boolean>();
        rolePermissions?.forEach(p => {
          const key = `${p.module}:${p.action}`;
          permMap.set(key, true);
        });

        setPermissions({
          permissions: permMap,
          dashboardScope,
          commissionScope,
          roles: roleNames,
          isAdmin,
        });
      } else {
        setPermissions({
          permissions: new Map(),
          dashboardScope: 'personal',
          commissionScope: 'none',
          roles: [],
          isAdmin: false,
        });
      }
    } catch (error) {
      console.error('Error loading permissions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, tenantId]);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  // Check if user has a specific permission
  const can = useCallback((module: PermissionModule, action: PermissionAction): boolean => {
    // Admins have all permissions
    if (permissions.isAdmin) return true;
    
    const key = `${module}:${action}`;
    return permissions.permissions.get(key) || false;
  }, [permissions]);

  // Check if user has any of the specified permissions
  const canAny = useCallback((module: PermissionModule, actions: PermissionAction[]): boolean => {
    if (permissions.isAdmin) return true;
    return actions.some(action => can(module, action));
  }, [permissions.isAdmin, can]);

  // Check if user has all of the specified permissions
  const canAll = useCallback((module: PermissionModule, actions: PermissionAction[]): boolean => {
    if (permissions.isAdmin) return true;
    return actions.every(action => can(module, action));
  }, [permissions.isAdmin, can]);

  return {
    can,
    canAny,
    canAll,
    dashboardScope: permissions.dashboardScope,
    commissionScope: permissions.commissionScope,
    roles: permissions.roles,
    isAdmin: permissions.isAdmin,
    isLoading,
    refresh: loadPermissions,
  };
}

// Helper component for conditional rendering based on permissions
interface PermissionGateProps {
  module: PermissionModule;
  action: PermissionAction;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermissionGate({ module, action, children, fallback = null }: PermissionGateProps) {
  const { can, isLoading } = usePermissions();

  if (isLoading) {
    return null;
  }

  if (can(module, action)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
