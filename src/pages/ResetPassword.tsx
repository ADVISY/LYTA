import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useNavigate } from "react-router-dom";
import lytaLogo from "@/assets/lyta-logo-full.svg";
import { supabase } from "@/integrations/supabase/client";
import { supabaseConfig } from "@/integrations/supabase/config";
import { Loader2 } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { clearSessionEnforcerState } from "@/lib/sessionEnforcerStorage";

type LoginSpace = "client" | "team" | "king";
type PendingRecoveryLink =
  | { kind: "token_hash"; tokenHash: string }
  | { kind: "code"; code: string }
  | { kind: "session"; accessToken: string; refreshToken: string }
  | { kind: "confirmation_url"; url: string };

const RECOVERY_URL_PARAMS = [
  "token_hash",
  "confirmation_url",
  "code",
  "access_token",
  "refresh_token",
  "error",
  "error_code",
  "error_description",
];

function getRequestedLoginSpace(search: string): LoginSpace | null {
  const params = new URLSearchParams(search);
  const value = params.get("space") || params.get("login");
  return value === "client" || value === "team" || value === "king" ? value : null;
}

function getRecoveryErrorMessage(
  queryParams: URLSearchParams,
  hashParams: URLSearchParams,
): string | null {
  const error = queryParams.get("error") ?? hashParams.get("error");
  const errorCode = queryParams.get("error_code") ?? hashParams.get("error_code");
  const errorDescription = queryParams.get("error_description") ?? hashParams.get("error_description");

  if (!error && !errorCode && !errorDescription) {
    return null;
  }

  const normalized = `${errorCode ?? ""} ${errorDescription ?? ""}`.toLowerCase();
  if (normalized.includes("expired") || normalized.includes("invalid") || normalized.includes("otp")) {
    return "Le lien de reinitialisation est invalide ou expire. Veuillez demander un nouveau lien.";
  }

  return errorDescription || "Une erreur est survenue lors du traitement du lien.";
}

function buildSupabaseRecoveryActionUrl(tokenHash: string, currentHref: string): string {
  const redirectUrl = new URL(currentHref);

  RECOVERY_URL_PARAMS.forEach((param) => redirectUrl.searchParams.delete(param));
  redirectUrl.hash = "";
  redirectUrl.searchParams.set("type", "recovery");
  redirectUrl.searchParams.set("verify_fallback", "1");

  const verifyUrl = new URL("/auth/v1/verify", supabaseConfig.url);
  verifyUrl.searchParams.set("token", tokenHash);
  verifyUrl.searchParams.set("type", "recovery");
  verifyUrl.searchParams.set("redirect_to", redirectUrl.toString());

  return verifyUrl.toString();
}

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isProcessingToken, setIsProcessingToken] = useState(true);
  const [isVerifyingLink, setIsVerifyingLink] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [pendingRecoveryLink, setPendingRecoveryLink] = useState<PendingRecoveryLink | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const processedUrlRef = useRef<string | null>(null);
  const completedRef = useRef(false);
  const requestedLoginSpaceRef = useRef<LoginSpace | null>(null);
  const recoveryFlowActiveRef = useRef(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[ResetPassword] Auth state change:", event, !!session);

      if (session && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "PASSWORD_RECOVERY")) {
        console.log("[ResetPassword] Session ready");
        recoveryFlowActiveRef.current = true;
        setSessionReady(true);
        setPendingRecoveryLink(null);
        setIsProcessingToken(false);
        setTokenError(null);
      }

      if (event === "SIGNED_OUT" && !completedRef.current && !recoveryFlowActiveRef.current) {
        setTokenError("Votre session a expire. Veuillez demander un nouveau lien de reinitialisation.");
        setIsProcessingToken(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const prepareRecoveryToken = async () => {
      const currentUrlKey = `${location.pathname}${location.search}${location.hash}`;
      if (processedUrlRef.current === currentUrlKey) return;
      processedUrlRef.current = currentUrlKey;

      try {
        setIsProcessingToken(true);
        setTokenError(null);
        setPendingRecoveryLink(null);
        setSessionReady(false);

        const hashParams = new URLSearchParams(location.hash.substring(1));
        const queryParams = new URLSearchParams(location.search);
        const requestedLoginSpace = getRequestedLoginSpace(location.search);
        if (requestedLoginSpace) {
          requestedLoginSpaceRef.current = requestedLoginSpace;
        }

        const recoveryErrorMessage = getRecoveryErrorMessage(queryParams, hashParams);
        if (recoveryErrorMessage) {
          setTokenError(recoveryErrorMessage);
          return;
        }

        const code = queryParams.get("code");
        const tokenHash = queryParams.get("token_hash");
        const confirmationUrl = queryParams.get("confirmation_url");
        const accessToken = hashParams.get("access_token") ?? queryParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token") ?? queryParams.get("refresh_token");
        const tokenType = hashParams.get("type") ?? queryParams.get("type");
        const hasRecoveryToken =
          confirmationUrl ||
          (tokenHash && tokenType === "recovery") ||
          code ||
          (accessToken && refreshToken);
        recoveryFlowActiveRef.current = Boolean(hasRecoveryToken);

        console.log("[ResetPassword] Preparing token...", {
          hasAccessToken: !!accessToken,
          tokenType,
          hasRefreshToken: !!refreshToken,
          hasCode: !!code,
          hasTokenHash: !!tokenHash,
          hasConfirmationUrl: !!confirmationUrl,
        });

        if (hasRecoveryToken) {
          clearSessionEnforcerState();
        }

        if (confirmationUrl) {
          setPendingRecoveryLink({ kind: "confirmation_url", url: confirmationUrl });
          return;
        }

        if (tokenHash && tokenType === "recovery") {
          setPendingRecoveryLink({ kind: "token_hash", tokenHash });
          return;
        }

        if (code) {
          setPendingRecoveryLink({ kind: "code", code });
          return;
        }

        if (accessToken && refreshToken) {
          setPendingRecoveryLink({ kind: "session", accessToken, refreshToken });
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          console.log("[ResetPassword] Existing session found");
          setSessionReady(true);
        } else {
          setTokenError("Aucun lien de reinitialisation valide trouve. Veuillez demander un nouveau lien depuis la page de connexion.");
        }
      } catch (err) {
        console.error("[ResetPassword] Error preparing recovery token:", err);
        setTokenError("Une erreur est survenue lors du traitement du lien.");
      } finally {
        setIsProcessingToken(false);
      }
    };

    const timeout = setTimeout(prepareRecoveryToken, 100);
    return () => clearTimeout(timeout);
  }, [location.hash, location.search, location.pathname]);

  const confirmSessionReady = async (sessionFromResponse?: unknown) => {
    let nextSession = sessionFromResponse;

    if (!nextSession) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const { data: { session } } = await supabase.auth.getSession();
      nextSession = session;
    }

    if (nextSession) {
      console.log("[ResetPassword] Session established successfully");
      window.history.replaceState({}, document.title, location.pathname);
      recoveryFlowActiveRef.current = true;
      setSessionReady(true);
      setPendingRecoveryLink(null);
      setTokenError(null);
      return;
    }

    console.error("[ResetPassword] No session after recovery verification");
    setTokenError("Le lien de reinitialisation est invalide ou expire.");
  };

  const handleVerifyRecoveryLink = async () => {
    if (!pendingRecoveryLink) return;

    setIsVerifyingLink(true);
    setTokenError(null);

    try {
      if (pendingRecoveryLink.kind === "confirmation_url") {
        const confirmationUrl = new URL(pendingRecoveryLink.url);
        const supabaseOrigin = new URL(supabaseConfig.url).origin;

        if (confirmationUrl.origin !== supabaseOrigin) {
          throw new Error("Lien de confirmation invalide.");
        }

        window.location.href = confirmationUrl.toString();
        return;
      }

      if (pendingRecoveryLink.kind === "token_hash") {
        const { data, error } = await supabase.auth.verifyOtp({
          type: "recovery",
          token_hash: pendingRecoveryLink.tokenHash,
        });

        if (error) {
          console.error("[ResetPassword] Error verifying OTP:", error);
          window.location.href = buildSupabaseRecoveryActionUrl(
            pendingRecoveryLink.tokenHash,
            window.location.href,
          );
          return;
        }

        await confirmSessionReady(data.session);
        return;
      }

      if (pendingRecoveryLink.kind === "code") {
        const { data, error } = await supabase.auth.exchangeCodeForSession(pendingRecoveryLink.code);
        if (error) {
          console.error("[ResetPassword] Error exchanging code:", error);
          setTokenError("Le lien de reinitialisation est invalide ou expire. Veuillez demander un nouveau lien.");
          return;
        }

        await confirmSessionReady(data.session);
        return;
      }

      const { data, error } = await supabase.auth.setSession({
        access_token: pendingRecoveryLink.accessToken,
        refresh_token: pendingRecoveryLink.refreshToken,
      });

      if (error) {
        console.error("[ResetPassword] Error setting session:", error);
        setTokenError("Le lien de reinitialisation est invalide ou expire. Veuillez demander un nouveau lien.");
        return;
      }

      await confirmSessionReady(data.session);
    } catch (error) {
      console.error("[ResetPassword] Error confirming recovery link:", error);
      setTokenError(error instanceof Error ? error.message : "Une erreur est survenue lors du traitement du lien.");
    } finally {
      setIsVerifyingLink(false);
    }
  };

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
        description: "Le mot de passe doit contenir au moins 6 caracteres.",
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
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        console.error("[ResetPassword] No session found at submit time");
        toast({
          title: "Erreur",
          description: "Votre session a expire. Veuillez demander un nouveau lien de reinitialisation.",
          variant: "destructive",
        });
        setTokenError("Votre session a expire. Veuillez demander un nouveau lien de reinitialisation.");
        return;
      }

      console.log("[ResetPassword] Session valid, updating password for user:", session.user.id);

      const { error } = await supabase.auth.updateUser({ password });

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
          title: "Mot de passe cree",
          description: "Votre mot de passe a ete cree avec succes. Vous pouvez maintenant vous connecter.",
        });

        completedRef.current = true;
        await supabase.auth.signOut();
        const loginSpace = requestedLoginSpaceRef.current;
        navigate(loginSpace ? `/connexion?space=${loginSpace}` : "/connexion", { replace: true });
      }
    } catch (error: unknown) {
      console.error("[ResetPassword] Unexpected error:", error);
      const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue.";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (isProcessingToken || (!sessionReady && !tokenError && !pendingRecoveryLink)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted to-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Verification du lien...</p>
        </div>
      </div>
    );
  }

  if (pendingRecoveryLink && !sessionReady && !tokenError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted to-background">
        <main className="min-h-screen flex flex-col items-center justify-center px-4 py-20">
          <div className="text-center mb-8">
            <BrandLogo src={lytaLogo} name="LYTA" platform imgClassName="h-24 sm:h-32 mx-auto" />
          </div>

          <div className="w-full max-w-md p-8 rounded-2xl bg-card/95 backdrop-blur-sm border border-border/50 shadow-xl text-center">
            <h2 className="text-xl font-bold text-foreground mb-4">Confirmer le lien</h2>
            <p className="text-muted-foreground mb-6">
              Cliquez sur continuer pour ouvrir le formulaire de mot de passe.
            </p>
            <Button
              onClick={handleVerifyRecoveryLink}
              disabled={isVerifyingLink}
              className="w-full"
            >
              {isVerifyingLink ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verification...
                </>
              ) : (
                "Continuer"
              )}
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted to-background">
        <main className="min-h-screen flex flex-col items-center justify-center px-4 py-20">
          <div className="text-center mb-8">
            <BrandLogo src={lytaLogo} name="LYTA" platform imgClassName="h-24 sm:h-32 mx-auto" />
          </div>

          <div className="w-full max-w-md p-8 rounded-2xl bg-card/95 backdrop-blur-sm border border-border/50 shadow-xl text-center">
            <h2 className="text-xl font-bold text-foreground mb-4">Lien expire</h2>
            <p className="text-muted-foreground mb-6">{tokenError}</p>
            <Button
              onClick={() => {
                const loginSpace = requestedLoginSpaceRef.current;
                navigate(loginSpace ? `/connexion?space=${loginSpace}` : "/connexion", { replace: true });
              }}
              className="w-full"
            >
              Retour a la connexion
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
          <BrandLogo src={lytaLogo} name="LYTA" platform imgClassName="h-24 sm:h-32 mx-auto" />
        </div>

        <div className="w-full max-w-md p-8 rounded-2xl bg-card/95 backdrop-blur-sm border border-border/50 shadow-xl">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-foreground">Creer votre mot de passe</h2>
            <p className="text-sm text-muted-foreground">Definissez un mot de passe securise pour acceder a votre espace</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
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
                placeholder="********"
                autoComplete="new-password"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full mt-6"
            >
              {loading ? "Creation en cours..." : "Creer mon mot de passe"}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
};

export default ResetPassword;
