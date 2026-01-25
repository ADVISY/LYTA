import { useAuth } from "@/hooks/useAuth";
import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

// Roles that REQUIRE SMS 2FA verification - ALL roles require SMS
const ROLES_REQUIRING_2FA = ['king', 'admin', 'manager', 'agent', 'backoffice', 'compta', 'partner', 'client'];

// How long a SMS verification is considered valid (in minutes)
const SMS_VERIFICATION_VALIDITY_MINUTES = 120; // 2 hours

/**
 * Check if we're on a tenant subdomain (e.g., advisy.lyta.ch)
 * Returns the tenant slug or null if on main platform
 */
function getTenantSlugFromHostname(): string | null {
  const hostname = window.location.hostname;
  
  // Skip for localhost and preview domains
  if (
    hostname === 'localhost' ||
    hostname.includes('lovable.app') ||
    hostname.includes('lovableproject.com') ||
    /^\d+\.\d+\.\d+\.\d+$/.test(hostname)
  ) {
    // Check for ?tenant= query param in dev
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('tenant');
  }
  
  // Extract subdomain from hostname like "advisy.lyta.ch"
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    const subdomain = parts[0];
    // Ignore common subdomains that are not tenants
    if (subdomain !== 'www' && subdomain !== 'app' && subdomain !== 'api') {
      return subdomain;
    }
  }
  
  return null;
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const location = useLocation();
  const [isValidating, setIsValidating] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const validationInProgress = useRef(false);

  // Server-side validation of user session, role, AND SMS 2FA
  useEffect(() => {
    const validateSession = async () => {
      if (loading) return;
      
      if (!user) {
        setIsValidating(false);
        setIsAuthorized(false);
        return;
      }

      // Prevent duplicate validations
      if (validationInProgress.current) return;
      validationInProgress.current = true;

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
          .select('id, is_active, phone')
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

        // ======== CRITICAL SECURITY: CROSS-DOMAIN SESSION HIJACK PREVENTION ========
        // When user has a Supabase session from another domain (e.g., KING on app.lyta.ch),
        // but opens a tenant subdomain (e.g., advisy.lyta.ch) in a new tab, the Supabase
        // session cookie is shared BUT sessionStorage is NOT.
        // This check ensures users must explicitly login on THIS domain.
        
        const currentTenantSlug = getTenantSlugFromHostname();
        const intendedSpace =
          sessionStorage.getItem('lyta_login_space') ||
          sessionStorage.getItem('loginTarget');

        // SECURITY: If there's no intended space in sessionStorage, the user did NOT
        // login through this domain's login flow - they have a stale cross-domain session
        if (!intendedSpace) {
          console.error("[ProtectedRoute] SECURITY: No login context - possible cross-domain session. Forcing re-login.");
          
          // Clear the session for this domain but DON'T call signOut() 
          // (which would affect ALL domains). Just clear local state and redirect.
          sessionStorage.clear();
          
          // For tenant subdomains, we need to sign out to prevent auto-redirect loops
          if (currentTenantSlug) {
            console.error("[ProtectedRoute] On tenant subdomain without valid login context - signing out");
            await signOut();
          }
          
          setIsAuthorized(false);
          setIsValidating(false);
          return;
        }
        
        // SECURITY: Verify the intended space matches the current domain context
        // If on a tenant subdomain, the user MUST have logged in with 'team' or 'client' space
        if (currentTenantSlug) {
          if (intendedSpace === 'king') {
            console.error("[ProtectedRoute] SECURITY: KING user accessing tenant domain - blocking");
            sessionStorage.clear();
            setIsAuthorized(false);
            setIsValidating(false);
            return;
          }
          
          // Verify user actually belongs to THIS tenant
          const { data: tenantCheck } = await supabase
            .from('user_tenant_assignments')
            .select('tenant_id, tenants!inner(slug)')
            .eq('user_id', user.id)
            .not('tenant_id', 'is', null)
            .maybeSingle();
          
          const userTenantSlug = (tenantCheck?.tenants as any)?.slug;
          
          if (!userTenantSlug || userTenantSlug !== currentTenantSlug) {
            console.error(`[ProtectedRoute] SECURITY: User tenant (${userTenantSlug}) does not match domain tenant (${currentTenantSlug})`);
            sessionStorage.clear();
            await signOut();
            setIsAuthorized(false);
            setIsValidating(false);
            return;
          }
        }
        // ======== END CROSS-DOMAIN SECURITY ========

        const isKing = roles.includes('king');
        const hasClientRole = roles.includes('client');

        // ======== CRITICAL SECURITY: STRICT SPACE VALIDATION ========
        // Validate that the intended space matches what the user is trying to access
        // AND that the user actually has access to that space
        
        // If user chose CLIENT space but is trying to access CRM or KING routes - BLOCK
        if (intendedSpace === 'client') {
          if (currentPath.startsWith('/crm') || currentPath.startsWith('/king')) {
            console.error("[ProtectedRoute] SECURITY: Client space user attempting to access restricted route via URL:", currentPath);
            sessionStorage.clear();
            await signOut();
            setIsAuthorized(false);
            setIsValidating(false);
            return;
          }
        }
        
        // If user chose TEAM space but is trying to access CLIENT or KING routes - BLOCK
        if (intendedSpace === 'team') {
          if (currentPath.startsWith('/espace-client') || currentPath.startsWith('/king')) {
            console.error("[ProtectedRoute] SECURITY: Team space user attempting to access restricted route via URL:", currentPath);
            sessionStorage.clear();
            await signOut();
            setIsAuthorized(false);
            setIsValidating(false);
            return;
          }
        }
        
        // If user chose KING space but is trying to access CRM or CLIENT routes - BLOCK
        if (intendedSpace === 'king') {
          if (currentPath.startsWith('/crm') || currentPath.startsWith('/espace-client')) {
            console.error("[ProtectedRoute] SECURITY: King space user attempting to access restricted route via URL:", currentPath);
            sessionStorage.clear();
            await signOut();
            setIsAuthorized(false);
            setIsValidating(false);
            return;
          }
        }
        // ======== END STRICT SPACE VALIDATION ========

        // ======== CRITICAL SECURITY: SMS 2FA VERIFICATION ========
        // Check if user has any role that requires 2FA
        const requiresSms2FA = roles.some(r => ROLES_REQUIRING_2FA.includes(r));
        
        if (requiresSms2FA) {
          // Verify that user has completed SMS verification recently
          const minValidTime = new Date();
          minValidTime.setMinutes(minValidTime.getMinutes() - SMS_VERIFICATION_VALIDITY_MINUTES);
          
          const { data: smsVerification, error: smsError } = await supabase
            .from('sms_verifications')
            .select('id, verified_at')
            .eq('user_id', user.id)
            .eq('verification_type', 'login')
            .not('verified_at', 'is', null)
            .gte('verified_at', minValidTime.toISOString())
            .order('verified_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (smsError) {
            console.error("[ProtectedRoute] Error checking SMS verification", smsError);
          }

          if (!smsVerification) {
            console.error("[ProtectedRoute] SECURITY: No valid SMS 2FA verification found for privileged user");
            // Clear session and force re-login with SMS
            sessionStorage.clear();
            await signOut();
            setIsAuthorized(false);
            setIsValidating(false);
            return;
          }

          console.log("[ProtectedRoute] SMS 2FA verified at:", smsVerification.verified_at);
        }
        // ======== END SMS 2FA VERIFICATION ========

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
      } finally {
        validationInProgress.current = false;
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
