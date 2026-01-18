import { useAuth } from "@/hooks/useAuth";
import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const location = useLocation();
  const [isValidating, setIsValidating] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Server-side validation of user session and role
  useEffect(() => {
    const validateSession = async () => {
      if (loading) return;
      
      if (!user) {
        setIsValidating(false);
        setIsAuthorized(false);
        return;
      }

      try {
        // Verify session is still valid on server
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
          console.error("[ProtectedRoute] Invalid session, forcing logout");
          sessionStorage.clear();
          await signOut();
          setIsAuthorized(false);
          setIsValidating(false);
          return;
        }

        // Verify user exists in database
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, is_active')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError || !profile) {
          console.error("[ProtectedRoute] User profile not found");
          sessionStorage.clear();
          await signOut();
          setIsAuthorized(false);
          setIsValidating(false);
          return;
        }

        // Check if user is active
        if (profile.is_active === false) {
          console.error("[ProtectedRoute] User account is deactivated");
          sessionStorage.clear();
          await signOut();
          setIsAuthorized(false);
          setIsValidating(false);
          return;
        }

        // Load roles (user can have multiple roles)
        const { data: rolesData, error: rolesError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (rolesError) {
          console.error("[ProtectedRoute] Error fetching user roles", rolesError);
          setIsAuthorized(false);
          setIsValidating(false);
          return;
        }

        const roles = (rolesData ?? []).map((r) => r.role as string);
        const currentPath = location.pathname;

        // Strict space separation: the chosen space must be present
        const intendedSpace =
          sessionStorage.getItem('lyta_login_space') ||
          sessionStorage.getItem('loginTarget');

        if (!intendedSpace) {
          console.error("[ProtectedRoute] Missing intended space (force re-login)");
          setIsAuthorized(false);
          setIsValidating(false);
          return;
        }

        const isKing = roles.includes('king');
        const hasClientRole = roles.includes('client');
        const hasTeamRole = roles.some((r) => r !== 'client' && r !== 'king');

        // SECURITY: Validate role matches route
        if (currentPath.startsWith('/king')) {
          if (intendedSpace !== 'king' || !isKing) {
            console.error("[ProtectedRoute] Unauthorized access to king route");
            setIsAuthorized(false);
            setIsValidating(false);
            return;
          }
        }

        // SECURITY: CRM/Team routes - must be in TEAM space and have a tenant role
        if (currentPath.startsWith('/crm')) {
          if (intendedSpace !== 'team') {
            console.error("[ProtectedRoute] Non-team space user trying to access CRM via URL");
            setIsAuthorized(false);
            setIsValidating(false);
            return;
          }

          if (isKing) {
            console.error("[ProtectedRoute] King user trying to access CRM");
            setIsAuthorized(false);
            setIsValidating(false);
            return;
          }

          // Validate tenant membership (server-side)
          const { data: assignment, error: assignmentError } = await supabase
            .from('user_tenant_assignments')
            .select('tenant_id, is_platform_admin')
            .eq('user_id', user.id)
            .not('tenant_id', 'is', null)
            .maybeSingle();

          if (assignmentError || !assignment?.tenant_id) {
            console.error("[ProtectedRoute] User has no tenant assignment for CRM", assignmentError);
            setIsAuthorized(false);
            setIsValidating(false);
            return;
          }

          // Platform admins are allowed regardless of tenant role assignment
          if (!(assignment as any).is_platform_admin) {
            const { data: tenantRoles, error: tenantRolesError } = await supabase
              .from('user_tenant_roles')
              .select('id')
              .eq('user_id', user.id)
              .eq('tenant_id', assignment.tenant_id)
              .limit(1);

            if (tenantRolesError || (tenantRoles?.length ?? 0) === 0) {
              console.error("[ProtectedRoute] User has no tenant role for CRM", tenantRolesError);
              setIsAuthorized(false);
              setIsValidating(false);
              return;
            }
          }
        }

        // SECURITY: Client space routes - must be in CLIENT space and have a client record/role
        if (currentPath.startsWith('/espace-client')) {
          if (intendedSpace !== 'client') {
            console.error("[ProtectedRoute] Non-client space user trying to access client space via URL");
            setIsAuthorized(false);
            setIsValidating(false);
            return;
          }

          if (!hasClientRole) {
            const { data: clientRecord } = await supabase
              .from('clients')
              .select('id')
              .eq('user_id', user.id)
              .maybeSingle();

            if (!clientRecord) {
              console.error("[ProtectedRoute] User has no client record for client space");
              setIsAuthorized(false);
              setIsValidating(false);
              return;
            }
          }
        }

        setIsAuthorized(true);
        setIsValidating(false);
      } catch (error) {
        console.error("[ProtectedRoute] Validation error:", error);
        setIsAuthorized(false);
        setIsValidating(false);
      }
    };

    validateSession();
  }, [user, loading, location.pathname, signOut]);

  if (loading || isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user || !isAuthorized) {
    // Clear any stale session data
    sessionStorage.removeItem('lyta_active_role');
    sessionStorage.removeItem('loginTarget');
    sessionStorage.removeItem('lyta_login_space');
    sessionStorage.removeItem('userLoginData');
    return <Navigate to="/connexion" replace />;
  }

  return <>{children}</>;
}
