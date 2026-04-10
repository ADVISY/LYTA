import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User, Session, createClient, FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { supabaseConfig } from "@/integrations/supabase/config";
import { useNavigate } from "react-router-dom";
import { clearSessionEnforcerState } from "@/lib/sessionEnforcerStorage";

interface AuthActionError {
  message: string;
}

interface PendingSmsVerificationState {
  userId: string;
  phoneNumber: string;
}

type SmsChallengeFunctionName = "send-verification-sms" | "verify-sms-code";

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

async function checkPasswordCompromised(password: string): Promise<{ isCompromised: boolean; count: number }> {
  try {
    const buffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-1", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();

    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
    });

    if (!response.ok) {
      return { isCompromised: false, count: 0 };
    }

    const text = await response.text();
    const lines = text.split("\n");

    for (const line of lines) {
      const [hashSuffix, countStr] = line.split(":");
      if (hashSuffix?.trim().toUpperCase() === suffix) {
        const count = parseInt(countStr?.trim() || "0", 10);
        return { isCompromised: count > 0, count };
      }
    }

    return { isCompromised: false, count: 0 };
  } catch (err) {
    console.error("Error checking password:", err);
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
  invokePendingAuthFunction: (
    name: SmsChallengeFunctionName,
    body: Record<string, unknown>,
  ) => Promise<unknown>;
  loading: boolean;
  pendingSmsVerification: PendingSmsVerificationState | null;
  clearPendingVerification: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SMS_CHALLENGE_STORAGE_KEY = "lyta_sms_challenge";

function createSmsChallengeClient() {
  return createClient<Database>(supabaseConfig.url, supabaseConfig.publishableKey, {
    auth: {
      storage: sessionStorage,
      storageKey: SMS_CHALLENGE_STORAGE_KEY,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingSmsVerification, _setPendingSmsVerification] = useState<PendingSmsVerificationState | null>(() => {
    try {
      const stored = sessionStorage.getItem("pendingSmsVerification");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const setPendingSmsVerification = useCallback((value: PendingSmsVerificationState | null) => {
    _setPendingSmsVerification(value);
    if (value) {
      sessionStorage.setItem("pendingSmsVerification", JSON.stringify(value));
    } else {
      sessionStorage.removeItem("pendingSmsVerification");
    }
  }, []);

  const navigate = useNavigate();

  const clearSmsChallengeSession = useCallback(async () => {
    try {
      const smsClient = createSmsChallengeClient();
      await smsClient.auth.signOut();
    } catch (error) {
      console.warn("Unable to clear SMS challenge session", error);
    } finally {
      sessionStorage.removeItem(SMS_CHALLENGE_STORAGE_KEY);
    }
  }, []);

  const promoteSmsChallengeSession = useCallback(async () => {
    const smsClient = createSmsChallengeClient();
    const { data: { session: challengeSession } } = await smsClient.auth.getSession();

    if (!challengeSession) {
      throw new Error("La session de verification SMS a expire. Veuillez vous reconnecter.");
    }

    const { error } = await supabase.auth.setSession({
      access_token: challengeSession.access_token,
      refresh_token: challengeSession.refresh_token,
    });

    if (error) {
      throw error;
    }

    await clearSmsChallengeSession();
  }, [clearSmsChallengeSession]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session: nextSession } }) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const syncPendingSmsState = async () => {
      if (!pendingSmsVerification) {
        return;
      }

      const smsClient = createSmsChallengeClient();
      const { data: { session: challengeSession } } = await smsClient.auth.getSession();

      if (!challengeSession) {
        setPendingSmsVerification(null);
      }
    };

    void syncPendingSmsState();
  }, [pendingSmsVerification, setPendingSmsVerification]);

  const invokePendingAuthFunction = useCallback(async (
    name: SmsChallengeFunctionName,
    body: Record<string, unknown>,
  ) => {
    const smsClient = createSmsChallengeClient();
    const { data: { session: challengeSession } } = await smsClient.auth.getSession();
    const client = challengeSession ? smsClient : supabase;
    const { data, error } = await client.functions.invoke(name, { body });

    if (error) {
      if (error instanceof FunctionsHttpError) {
        let message = `Erreur de service (${error.context.status})`;
        try {
          const payload = await error.context.json() as { error?: string; message?: string };
          if (payload.error || payload.message) {
            message = payload.error || payload.message || message;
          }
        } catch {
          // Ignore JSON parsing errors and keep the status-based fallback.
        }
        throw new Error(message);
      }
      throw error;
    }

    return data;
  }, []);

  const signIn = async (email: string, password: string) => {
    await clearSmsChallengeSession();
    setPendingSmsVerification(null);

    const smsClient = createSmsChallengeClient();
    const { data, error } = await smsClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error };
    }

    if (data.user) {
      const { data: loginData, error: rpcError } = await smsClient.rpc(
        "get_user_login_data",
        { p_user_id: data.user.id },
      );

      if (rpcError) {
        console.error("Error fetching login data:", rpcError);
        await clearSmsChallengeSession();
        return { error: { message: "Erreur de verification. Veuillez reessayer." } };
      }

      const parsedData = parseLoginData(loginData);

      if (parsedData) {
        sessionStorage.setItem("userLoginData", JSON.stringify(parsedData));
      }

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
          await clearSmsChallengeSession();
          return {
            error: {
              message: "Numero de telephone requis pour la verification SMS. Contactez l'administrateur.",
            },
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

    if (data.session) {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });

      if (sessionError) {
        await clearSmsChallengeSession();
        return { error: sessionError };
      }
    }

    await clearSmsChallengeSession();

    return { error: null };
  };

  const completeSmsVerification = useCallback(async () => {
    if (!pendingSmsVerification) {
      return;
    }

    await promoteSmsChallengeSession();
    setPendingSmsVerification(null);

    const { data: { session: nextSession } } = await supabase.auth.getSession();
    if (nextSession) {
      setSession(nextSession);
      setUser(nextSession.user);
    }
  }, [pendingSmsVerification, promoteSmsChallengeSession, setPendingSmsVerification]);

  const clearPendingVerification = useCallback(() => {
    setPendingSmsVerification(null);
    void clearSmsChallengeSession();
  }, [clearSmsChallengeSession, setPendingSmsVerification]);

  const signUp = async (email: string, password: string, firstName?: string, lastName?: string) => {
    try {
      const result = await checkPasswordCompromised(password);
      if (result.isCompromised) {
        return {
          error: {
            message: `Ce mot de passe a ete expose dans ${result.count.toLocaleString()} fuites de donnees. Veuillez en choisir un autre plus securise.`,
          },
        };
      }
    } catch (err) {
      console.warn("Password check failed, proceeding with signup:", err);
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

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      console.log("Logout completed (session may have been expired)");
    }

    setSession(null);
    setUser(null);
    setPendingSmsVerification(null);
    await clearSmsChallengeSession();

    sessionStorage.removeItem("lyta_active_role");
    sessionStorage.removeItem("loginTarget");
    sessionStorage.removeItem("lyta_login_space");
    sessionStorage.removeItem("userLoginData");
    clearSessionEnforcerState();

    navigate("/connexion");
  }, [clearSmsChallengeSession, navigate, setPendingSmsVerification]);

  const resetPassword = async (email: string) => {
    const redirectUrl = `${window.location.origin}/reset-password`;

    try {
      const response = await supabase.functions.invoke("send-password-reset", {
        body: { email, redirectUrl },
      });

      if (response.error) {
        console.error("Password reset error:", response.error);
        return {
          error: {
            message: getErrorMessage(
              response.error,
              "Erreur lors de l'envoi du mail de reinitialisation.",
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
    <AuthContext.Provider
      value={{
        user,
        session,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updatePassword,
        completeSmsVerification,
        invokePendingAuthFunction,
        loading,
        pendingSmsVerification,
        clearPendingVerification,
      }}
    >
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
