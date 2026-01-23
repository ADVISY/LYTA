import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useLocation } from "react-router-dom";
import lytaLogo from "@/assets/lyta-logo-full.svg";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isProcessingToken, setIsProcessingToken] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const { toast } = useToast();
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Process the recovery token from URL hash or query params
    const processRecoveryToken = async () => {
      try {
        // Check URL hash for token (Supabase format: #access_token=...&type=recovery)
        const hashParams = new URLSearchParams(location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const tokenType = hashParams.get('type');
        const refreshToken = hashParams.get('refresh_token');

        // Also check query params for code flow
        const queryParams = new URLSearchParams(location.search);
        const code = queryParams.get('code');

        if (accessToken && tokenType === 'recovery' && refreshToken) {
          // Set the session with the tokens from the URL
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error("Error setting session:", error);
            setTokenError("Le lien de réinitialisation est invalide ou expiré.");
          }
        } else if (code) {
          // Exchange code for session (PKCE flow)
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error("Error exchanging code:", error);
            setTokenError("Le lien de réinitialisation est invalide ou expiré.");
          }
        } else if (!session && !authLoading) {
          // No token in URL and no session - wait a bit for auth to process
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Check session again
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (!currentSession) {
            setTokenError("Aucun lien de réinitialisation valide trouvé.");
          }
        }
      } catch (err) {
        console.error("Error processing recovery token:", err);
        setTokenError("Une erreur est survenue lors du traitement du lien.");
      } finally {
        setIsProcessingToken(false);
      }
    };

    // Only process if auth is not loading
    if (!authLoading) {
      processRecoveryToken();
    }
  }, [location, session, authLoading]);

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
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        toast({
          title: "Erreur",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Mot de passe créé",
          description: "Votre mot de passe a été créé avec succès. Vous pouvez maintenant vous connecter.",
        });
        
        // Sign out and redirect to login
        await supabase.auth.signOut();
        navigate("/connexion");
      }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Show loading while processing token
  if (isProcessingToken || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
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
