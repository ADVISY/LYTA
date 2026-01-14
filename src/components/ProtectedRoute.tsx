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
          // Clear all session data
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

        // Get user role for route validation
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        const userRole = roleData?.role || 'client';
        const currentPath = location.pathname;

        // Validate role matches route
        if (currentPath.startsWith('/king') && userRole !== 'king') {
          console.error("[ProtectedRoute] Unauthorized access to king route");
          setIsAuthorized(false);
          setIsValidating(false);
          return;
        }

        if (currentPath.startsWith('/espace-client') && !['client', 'king'].includes(userRole)) {
          // Non-client users trying to access client space - check if they have a client record
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1800AD]" />
      </div>
    );
  }

  if (!user || !isAuthorized) {
    // Clear any stale session data
    sessionStorage.removeItem('lyta_active_role');
    sessionStorage.removeItem('loginTarget');
    sessionStorage.removeItem('userLoginData');
    return <Navigate to="/connexion" replace />;
  }

  return <>{children}</>;
}
