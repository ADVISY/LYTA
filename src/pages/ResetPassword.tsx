import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useLocation } from "react-router-dom";
import lytaLogo from "@/assets/lyta-logo-full.svg";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isProcessingToken, setIsProcessingToken] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const processedRef = useRef(false);

  // Listen for auth state changes - Supabase may auto-process recovery tokens
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[ResetPassword] Auth state change:", event, !!session);

      // Only mark ready when we actually have a session.
      if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'PASSWORD_RECOVERY')) {
        console.log("[ResetPassword] Session ready");
        setSessionReady(true);
        setIsProcessingToken(false);
        setTokenError(null);
      }

      // If we get signed out while on this page, show a clear error.
      if (event === 'SIGNED_OUT') {
        setTokenError("Votre session a expiré. Veuillez demander un nouveau lien de réinitialisation.");
        setIsProcessingToken(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Process the recovery token from URL hash or query params
    const processRecoveryToken = async () => {
      if (processedRef.current) return;
      processedRef.current = true;

      try {
        // Check URL hash for token (Supabase format: #access_token=...&type=recovery)
        const hashParams = new URLSearchParams(location.hash.substring(1));

        // Also check query params for code flow
        const queryParams = new URLSearchParams(location.search);
        const code = queryParams.get('code');
        const tokenHash = queryParams.get('token_hash');

        // Support both hash and query variants
        const accessToken = hashParams.get('access_token') ?? queryParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') ?? queryParams.get('refresh_token');
        const tokenType = hashParams.get('type') ?? queryParams.get('type');

        console.log("[ResetPassword] Processing token...", { 
          hasAccessToken: !!accessToken, 
          tokenType, 
          hasRefreshToken: !!refreshToken,
          hasCode: !!code,
          hasTokenHash: !!tokenHash,
        });

        // Preferred flow: token_hash (most robust, no redirect verification needed)
        if (tokenHash && tokenType === 'recovery') {
          const { error } = await supabase.auth.verifyOtp({
            type: 'recovery',
            token_hash: tokenHash,
          });

          if (error) {
            console.error("[ResetPassword] Error verifying OTP:", error);
            setTokenError("Le lien de réinitialisation est invalide ou expiré. Veuillez demander un nouveau lien.");
            setIsProcessingToken(false);
            return;
          }

          // Clear URL to prevent re-processing
          window.history.replaceState({}, document.title, location.pathname);
          
          // Wait for session to be established and verify
          await new Promise(resolve => setTimeout(resolve, 800));
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session) {
            console.log("[ResetPassword] Session established successfully");
            setSessionReady(true);
          } else {
            console.error("[ResetPassword] No session after verifyOtp");
            setTokenError("Le lien de réinitialisation est invalide ou expiré.");
          }
        } else if (code) {
          // Exchange code for session (PKCE flow)
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error("[ResetPassword] Error exchanging code:", error);
            setTokenError("Le lien de réinitialisation est invalide ou expiré. Veuillez demander un nouveau lien.");
            setIsProcessingToken(false);
            return;
          }

          // Clear URL
          window.history.replaceState({}, document.title, location.pathname);
          
          await new Promise(resolve => setTimeout(resolve, 800));
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session) {
            console.log("[ResetPassword] Session established via PKCE");
            setSessionReady(true);
          } else {
            console.error("[ResetPassword] No session after code exchange");
            setTokenError("Le lien de réinitialisation est invalide ou expiré.");
          }
        } else if (accessToken && refreshToken) {
          // Legacy implicit flow: setSession from tokens
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error("[ResetPassword] Error setting session:", error);
            setTokenError("Le lien de réinitialisation est invalide ou expiré. Veuillez demander un nouveau lien.");
            setIsProcessingToken(false);
            return;
          }

          window.history.replaceState({}, document.title, location.pathname);

          await new Promise(resolve => setTimeout(resolve, 800));
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            console.log("[ResetPassword] Session established from tokens");
            setSessionReady(true);
          } else {
            console.error("[ResetPassword] No session after setSession");
            setTokenError("Le lien de réinitialisation est invalide ou expiré.");
          }
        } else {
          // No token in URL - check if we already have a valid session (maybe from onAuthStateChange)
          await new Promise(resolve => setTimeout(resolve, 1000));
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            console.log("[ResetPassword] Existing session found");
            setSessionReady(true);
          } else if (!sessionReady) {
            // Only show error if onAuthStateChange hasn't set sessionReady
            setTokenError("Aucun lien de réinitialisation valide trouvé. Veuillez demander un nouveau lien depuis la page de connexion.");
          }
        }
      } catch (err) {
        console.error("[ResetPassword] Error processing recovery token:", err);
        setTokenError("Une erreur est survenue lors du traitement du lien.");
      } finally {
        setIsProcessingToken(false);
      }
    };

    // Small delay to let onAuthStateChange fire first
    const timeout = setTimeout(processRecoveryToken, 100);
    return () => clearTimeout(timeout);
  }, [location.hash, location.search, location.pathname, sessionReady]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || !confirmPassword) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Erreur",
        description: "Le mot de passe doit contenir au moins 6 caractères.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Erreur",
        description: "Les mots de passe ne correspondent pas.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Verify session exists before attempting update
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error("[ResetPassword] No session found at submit time");
        toast({
          title: "Erreur",
          description: "Votre session a expiré. Veuillez demander un nouveau lien de réinitialisation.",
          variant: "destructive",
        });
        setTokenError("Votre session a expiré. Veuillez demander un nouveau lien de réinitialisation.");
        return;
      }

      console.log("[ResetPassword] Session valid, updating password for user:", session.user.id);

      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        console.error("[ResetPassword] Error updating password:", error);
        toast({
          title: "Erreur",
          description: error.message,
          variant: "destructive",
        });
      } else {
        console.log("[ResetPassword] Password updated successfully");
        toast({
          title: "Mot de passe créé",
          description: "Votre mot de passe a été créé avec succès. Vous pouvez maintenant vous connecter.",
        });
        
        // Sign out and redirect to login
        await supabase.auth.signOut();
        navigate("/connexion");
      }
    } catch (error: any) {
      console.error("[ResetPassword] Unexpected error:", error);
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Show loading while processing token or waiting for session
  if (isProcessingToken || (!sessionReady && !tokenError)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted to-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Vérification du lien...</p>
        </div>
      </div>
    );
  }

  // Show error if token is invalid
  if (tokenError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted to-background">
        <main className="min-h-screen flex flex-col items-center justify-center px-4 py-20">
          <div className="text-center mb-8">
            <img 
              src={lytaLogo} 
              alt="LYTA" 
              className="h-24 sm:h-32 mx-auto"
            />
          </div>
          
          <div className="w-full max-w-md p-8 rounded-2xl bg-card/95 backdrop-blur-sm border border-border/50 shadow-xl text-center">
            <h2 className="text-xl font-bold text-foreground mb-4">Lien expiré</h2>
            <p className="text-muted-foreground mb-6">{tokenError}</p>
            <Button onClick={() => navigate("/connexion")} className="w-full">
              Retour à la connexion
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted to-background">
      <main className="min-h-screen flex flex-col items-center justify-center px-4 py-20">
        <div className="text-center mb-8">
          <img 
            src={lytaLogo} 
            alt="LYTA" 
            className="h-24 sm:h-32 mx-auto"
          />
        </div>

        <div className="w-full max-w-md p-8 rounded-2xl bg-card/95 backdrop-blur-sm border border-border/50 shadow-xl">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-foreground">Créer votre mot de passe</h2>
            <p className="text-sm text-muted-foreground">Définissez un mot de passe sécurisé pour accéder à votre espace</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>

            <Button 
              type="submit" 
              disabled={loading}
              className="w-full mt-6"
            >
              {loading ? "Création en cours..." : "Créer mon mot de passe"}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
};

export default ResetPassword;
