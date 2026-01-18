import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

type UserRole = 'king' | 'admin' | 'manager' | 'agent' | 'backoffice' | 'compta' | 'partner' | 'client' | null;

const ACTIVE_ROLE_KEY = 'lyta_active_role';

export function useUserRole() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [activeRole, setActiveRoleState] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  // Get stored active role from session
  const getStoredActiveRole = useCallback((): UserRole | null => {
    try {
      const stored = sessionStorage.getItem(ACTIVE_ROLE_KEY);
      return stored as UserRole;
    } catch {
      return null;
    }
  }, []);

  // Set active role and persist to session
  const setActiveRole = useCallback((role: UserRole) => {
    setActiveRoleState(role);
    if (role) {
      sessionStorage.setItem(ACTIVE_ROLE_KEY, role);
    } else {
      sessionStorage.removeItem(ACTIVE_ROLE_KEY);
    }
  }, []);

  // Clear active role (for logout) - clears ALL session auth data
  const clearActiveRole = useCallback(() => {
    setActiveRoleState(null);
    setRoles([]);
    sessionStorage.removeItem(ACTIVE_ROLE_KEY);
    sessionStorage.removeItem('loginTarget');
    sessionStorage.removeItem('lyta_login_space');
    sessionStorage.removeItem('userLoginData');
  }, []);

  useEffect(() => {
    async function fetchRoles() {
      if (!user) {
        setRoles([]);
        setActiveRoleState(null);
        setLoading(false);
        return;
      }

      try {
        console.log('[useUserRole] Fetching roles for user:', user.id);
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (error) throw error;

        const userRoles = (data || []).map(r => r.role as UserRole);
        console.log('[useUserRole] User roles:', userRoles);
        setRoles(userRoles);

        // Determine active role
        const storedRole = getStoredActiveRole();
        if (storedRole && userRoles.includes(storedRole)) {
          // Use stored role if valid
          setActiveRoleState(storedRole);
        } else if (userRoles.length === 1) {
          // Single role - use it
          setActiveRole(userRoles[0]);
        } else if (userRoles.length > 1) {
          // Multiple roles - prioritize based on login target
          const loginTarget = sessionStorage.getItem('lyta_login_space') || sessionStorage.getItem('loginTarget');
          if (loginTarget === 'king' && userRoles.includes('king')) {
            setActiveRole('king');
          } else if (loginTarget === 'client' && userRoles.includes('client')) {
            setActiveRole('client');
          } else if (loginTarget === 'team') {
            // For team, pick highest privilege non-client role
            const teamRoles: UserRole[] = ['king', 'admin', 'manager', 'agent', 'backoffice', 'compta', 'partner'];
            const bestRole = teamRoles.find(r => userRoles.includes(r));
            setActiveRole(bestRole || userRoles[0]);
          } else {
            // No target - use first available role
            setActiveRole(userRoles[0]);
          }
        } else {
          // No roles found
          setActiveRoleState(null);
        }
      } catch (error) {
        console.error('[useUserRole] Error fetching user roles:', error);
        setRoles([]);
        setActiveRoleState(null);
      } finally {
        setLoading(false);
      }
    }

    fetchRoles();
  }, [user, getStoredActiveRole, setActiveRole]);

  // For backwards compatibility, expose 'role' as activeRole
  const role = activeRole;

  return { 
    role,
    roles,
    activeRole,
    setActiveRole,
    clearActiveRole,
    hasMultipleRoles: roles.length > 1,
    hasRole: (r: UserRole) => roles.includes(r),
    loading, 
    isKing: activeRole === 'king',
    isAdmin: activeRole === 'admin',
    isManager: activeRole === 'manager',
    isAgent: activeRole === 'agent',
    isBackoffice: activeRole === 'backoffice',
    isCompta: activeRole === 'compta',
    isPartner: activeRole === 'partner',
    isClient: activeRole === 'client'
  };
}
