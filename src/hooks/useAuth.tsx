import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface AuthActionError {
  message: string;
}

interface PendingSmsVerificationState {
  userId: string;
  phoneNumber: string;
}

interface LoginData {
  role: string;
  tenant_slug: string | null;
  requires_sms: boolean;
  phone: string | null;
}

interface AuthActionResult {
  error: AuthActionError | null;
}

interface SignInResult extends AuthActionResult {
  requiresSmsVerification?: boolean;
  userId?: string;
  phoneNumber?: string;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return fallback;
}

function parseLoginData(value: unknown): LoginData | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const data = value as Record<string, unknown>;

  if (
    typeof data.role !== "string" ||
    (data.tenant_slug !== null && typeof data.tenant_slug !== "string") ||
    typeof data.requires_sms !== "boolean" ||
    (data.phone !== null && typeof data.phone !== "string")
  ) {
    return null;
  }

  return {
    role: data.role,
    tenant_slug: data.tenant_slug,
    requires_sms: data.requires_sms,
    phone: data.phone,
  };
}

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
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signUp: (email: string, password: string, firstName?: string, lastName?: string) => Promise<AuthActionResult>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<AuthActionResult>;
  updatePassword: (newPassword: string) => Promise<AuthActionResult>;
  completeSmsVerification: () => Promise<void>;
  loading: boolean;
  pendingSmsVerification: PendingSmsVerificationState | null;
  clearPendingVerification: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingSmsVerification, _setPendingSmsVerification] = useState<PendingSmsVerificationState | null>(() => {
    // Restore from sessionStorage to survive page refresh
    try {
      const stored = sessionStorage.getItem('pendingSmsVerification');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Wrapper that syncs to sessionStorage
  const setPendingSmsVerification = useCallback((value: PendingSmsVerificationState | null) => {
    _setPendingSmsVerification(value);
    if (value) {
      sessionStorage.setItem('pendingSmsVerification', JSON.stringify(value));
    } else {
      sessionStorage.removeItem('pendingSmsVerification');
    }
  }, []);
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener (must be registered before getSession)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

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
        // SECURITY: Ne jamais autoriser le login si la vérification échoue
        await supabase.auth.signOut();
        return { error: { message: "Erreur de vérification. Veuillez réessayer." } };
      }

      const parsedData = parseLoginData(loginData);

      // Store login data for redirect logic
      if (parsedData) {
        sessionStorage.setItem('userLoginData', JSON.stringify(parsedData));
      }

      // Enforce 2FA for KING users if platform setting requires it
      if (parsedData && !parsedData.requires_sms && parsedData.role === "king") {
        const { data: setting2fa } = await supabase.rpc("get_platform_setting", {
          setting_key: "king_2fa_required",
        });

        if (setting2fa === true || setting2fa === "true") {
          const phoneNumber = data.user.phone || parsedData.phone;
          if (phoneNumber) {
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
  }, [pendingSmsVerification, setPendingSmsVerification]);

  const clearPendingVerification = useCallback(() => {
    setPendingSmsVerification(null);
  }, [setPendingSmsVerification]);

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

    const redirectUrl = `${window.location.origin}/crm`;
    
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
    // Always clear local state and redirect, even if signOut fails
    setSession(null);
    setUser(null);
    setPendingSmsVerification(null);
    
    // Clear all session data to prevent role/session leakage
    sessionStorage.removeItem('lyta_active_role');
    sessionStorage.removeItem('loginTarget');
    sessionStorage.removeItem('lyta_login_space');
    sessionStorage.removeItem('userLoginData');
    
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
        return {
          error: {
            message: getErrorMessage(
              response.error,
              "Erreur lors de l'envoi du mail de réinitialisation."
            ),
          },
        };
      }

      if (response.data?.error) {
        return { error: { message: response.data.error } };
      }

      return { error: null };
    } catch (err: unknown) {
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

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
