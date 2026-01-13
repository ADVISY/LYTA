import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

// Session timeout: 1 hour in milliseconds
const SESSION_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour
const ACTIVITY_CHECK_INTERVAL_MS = 60 * 1000; // Check every minute

/**
 * Check if a password has been exposed in known data breaches
 * Uses HaveIBeenPwned API with k-anonymity
 */
async function checkPasswordCompromised(password: string): Promise<{ isCompromised: boolean; count: number }> {
  try {
    const buffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-1', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
    });

    if (!response.ok) {
      return { isCompromised: false, count: 0 };
    }

    const text = await response.text();
    const lines = text.split('\n');

    for (const line of lines) {
      const [hashSuffix, countStr] = line.split(':');
      if (hashSuffix?.trim().toUpperCase() === suffix) {
        const count = parseInt(countStr?.trim() || '0', 10);
        return { isCompromised: count > 0, count };
      }
    }

    return { isCompromised: false, count: 0 };
  } catch (err) {
    console.error('Error checking password:', err);
    return { isCompromised: false, count: 0 };
  }
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<{ error: any; requiresSmsVerification?: boolean; userId?: string; phoneNumber?: string }>;
  signUp: (email: string, password: string, firstName?: string, lastName?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  updatePassword: (newPassword: string) => Promise<{ error: any }>;
  completeSmsVerification: () => void;
  loading: boolean;
  pendingSmsVerification: {
    userId: string;
    phoneNumber: string;
  } | null;
  clearPendingVerification: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingSmsVerification, setPendingSmsVerification] = useState<{
    userId: string;
    phoneNumber: string;
  } | null>(null);
  const navigate = useNavigate();
  
  // Track last activity time for session timeout
  const lastActivityRef = useRef<number>(Date.now());
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update last activity on user interaction
  const updateLastActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    sessionStorage.setItem('lastActivity', String(lastActivityRef.current));
  }, []);

  // Check for session timeout due to inactivity
  const checkSessionTimeout = useCallback(async () => {
    const lastActivity = Number(sessionStorage.getItem('lastActivity') || lastActivityRef.current);
    const timeSinceActivity = Date.now() - lastActivity;
    
    if (timeSinceActivity >= SESSION_TIMEOUT_MS && session) {
      console.log('Session expired due to inactivity (1 hour)');
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      sessionStorage.removeItem('lastActivity');
      sessionStorage.removeItem('userLoginData');
      navigate('/connexion');
    }
  }, [session, navigate]);

  // Set up activity tracking and timeout checking
  useEffect(() => {
    // Activity events to track
    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    
    activityEvents.forEach(event => {
      window.addEventListener(event, updateLastActivity, { passive: true });
    });
    
    // Check for timeout periodically
    activityTimeoutRef.current = setInterval(checkSessionTimeout, ACTIVITY_CHECK_INTERVAL_MS);
    
    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, updateLastActivity);
      });
      if (activityTimeoutRef.current) {
        clearInterval(activityTimeoutRef.current);
      }
    };
  }, [updateLastActivity, checkSessionTimeout]);

  // Logout on page close/unload (security measure)
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Mark session as should-logout for next load
      sessionStorage.setItem('shouldLogout', 'true');
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // User is leaving - mark for logout
        sessionStorage.setItem('shouldLogout', 'true');
      } else if (document.visibilityState === 'visible') {
        // User returned - check if we should logout
        const shouldLogout = sessionStorage.getItem('shouldLogout');
        const lastActivity = Number(sessionStorage.getItem('lastActivity') || 0);
        const timeSinceActivity = Date.now() - lastActivity;
        
        // If returning after more than 5 minutes of being hidden, force re-login
        if (shouldLogout === 'true' && timeSinceActivity > 5 * 60 * 1000) {
          sessionStorage.removeItem('shouldLogout');
          supabase.auth.signOut().then(() => {
            setSession(null);
            setUser(null);
            navigate('/connexion');
          });
        } else {
          sessionStorage.removeItem('shouldLogout');
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [navigate]);

  useEffect(() => {
    // Check if we should force logout on page load (came from redirect or page close)
    const shouldLogout = sessionStorage.getItem('shouldLogout');
    if (shouldLogout === 'true') {
      sessionStorage.removeItem('shouldLogout');
      supabase.auth.signOut().then(() => {
        setSession(null);
        setUser(null);
        setLoading(false);
      });
      return;
    }

    // Set up auth state listener (must be registered before getSession)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // SECURITY: Force re-login on redirect from email verification
      // Users should not be auto-logged in from email links
      if (event === 'SIGNED_IN' && window.location.href.includes('access_token')) {
        console.log('Blocking auto-login from email redirect');
        supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setLoading(false);
        navigate('/connexion');
        return;
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      // Initialize activity tracking on login
      if (session) {
        updateLastActivity();
      }
    });

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      // Check if session is still valid based on last activity
      const lastActivity = Number(sessionStorage.getItem('lastActivity') || 0);
      const timeSinceActivity = Date.now() - lastActivity;
      
      if (session && lastActivity > 0 && timeSinceActivity >= SESSION_TIMEOUT_MS) {
        // Session expired due to inactivity
        console.log('Existing session expired due to inactivity');
        supabase.auth.signOut();
        setSession(null);
        setUser(null);
        sessionStorage.removeItem('lastActivity');
      } else {
        setSession(session);
        setUser(session?.user ?? null);
        if (session) {
          updateLastActivity();
        }
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate, updateLastActivity]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error };
    }

    if (data.user) {
      // SINGLE RPC call to get ALL login data at once (role, tenant, sms requirement, phone)
      const { data: loginData, error: rpcError } = await supabase.rpc(
        "get_user_login_data",
        { p_user_id: data.user.id }
      );

      if (rpcError) {
        console.error("Error fetching login data:", rpcError);
        // Fallback: allow login without extra checks
        return { error: null };
      }

      // Cast to expected shape
      const parsedData = loginData as {
        role: string;
        tenant_slug: string | null;
        requires_sms: boolean;
        phone: string | null;
      } | null;

      // Store login data for redirect logic
      if (parsedData) {
        sessionStorage.setItem('userLoginData', JSON.stringify(parsedData));
      }

      if (parsedData?.requires_sms) {
        const phoneNumber = parsedData.phone || data.user.phone;

        if (!phoneNumber) {
          await supabase.auth.signOut();
          return { 
            error: { 
              message: "Numéro de téléphone requis pour la vérification SMS. Contactez l'administrateur." 
            } 
          };
        }

        setPendingSmsVerification({
          userId: data.user.id,
          phoneNumber,
        });

        return { 
          error: null, 
          requiresSmsVerification: true,
          userId: data.user.id,
          phoneNumber,
        };
      }
    }

    return { error: null };
  };

  const completeSmsVerification = useCallback(async () => {
    if (!pendingSmsVerification) return;

    // Re-authenticate the user after SMS verification
    // The session should still be valid or we need to re-login
    setPendingSmsVerification(null);
    
    // Refresh session
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setSession(session);
      setUser(session.user);
    }
  }, [pendingSmsVerification]);

  const clearPendingVerification = useCallback(() => {
    setPendingSmsVerification(null);
  }, []);

  const signUp = async (email: string, password: string, firstName?: string, lastName?: string) => {
    // Check if password has been compromised (HaveIBeenPwned)
    try {
      const result = await checkPasswordCompromised(password);
      if (result.isCompromised) {
        return { 
          error: { 
            message: `Ce mot de passe a été exposé dans ${result.count.toLocaleString()} fuites de données. Veuillez en choisir un autre plus sécurisé.` 
          } 
        };
      }
    } catch (err) {
      console.warn('Password check failed, proceeding with signup:', err);
    }

    // SECURITY: Redirect to login page after email verification, not auto-login
    // The user must manually enter their credentials
    const redirectUrl = `${window.location.origin}/connexion?verified=true`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          first_name: firstName,
          last_name: lastName,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      // Session might already be expired/invalid - ignore error
      console.log("Logout completed (session may have been expired)");
    }
    // Clear all session data
    sessionStorage.removeItem('lastActivity');
    sessionStorage.removeItem('userLoginData');
    sessionStorage.removeItem('shouldLogout');
    // Always clear local state and redirect, even if signOut fails
    setSession(null);
    setUser(null);
    setPendingSmsVerification(null);
    navigate("/connexion");
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = `${window.location.origin}/reset-password`;
    
    try {
      // Use custom edge function for branded password reset emails
      const response = await supabase.functions.invoke('send-password-reset', {
        body: { email, redirectUrl }
      });

      if (response.error) {
        console.error("Password reset error:", response.error);
        return { error: response.error };
      }

      if (response.data?.error) {
        return { error: { message: response.data.error } };
      }

      return { error: null };
    } catch (err: any) {
      console.error("Password reset exception:", err);
      // Fallback to Supabase default if edge function fails
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });
      return { error };
    }
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    return { error };
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      signIn, 
      signUp, 
      signOut, 
      resetPassword, 
      updatePassword, 
      completeSmsVerification,
      loading,
      pendingSmsVerification,
      clearPendingVerification,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
