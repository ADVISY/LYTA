import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

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

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Only update if not pending SMS verification
        if (!pendingSmsVerification) {
          setSession(session);
          setUser(session?.user ?? null);
        }
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!pendingSmsVerification) {
        setSession(session);
        setUser(session?.user ?? null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [pendingSmsVerification]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error };
    }

    if (data.user) {
      // Check if user requires SMS verification (king or admin)
      const { data: requiresVerification } = await supabase.rpc(
        "requires_sms_verification",
        { p_user_id: data.user.id }
      );

      if (requiresVerification) {
        // Get user phone number from profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("phone")
          .eq("id", data.user.id)
          .single();

        const phoneNumber = profile?.phone || data.user.phone;

        if (!phoneNumber) {
          // No phone number, can't verify - sign out and return error
          await supabase.auth.signOut();
          return { 
            error: { 
              message: "Numéro de téléphone requis pour la vérification SMS. Contactez l'administrateur." 
            } 
          };
        }

        // Sign out temporarily until SMS is verified
        await supabase.auth.signOut();
        
        // Store pending verification
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
    navigate("/connexion");
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = `${window.location.origin}/reset-password`;
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    return { error };
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
