/**
 * SetupMFA — Page d'enrôlement TOTP (Google Authenticator, Authy, 1Password…).
 *
 * Accessible :
 *   - Automatiquement : un admin/king sans factor TOTP est redirigé ici après
 *     la fin du grace period 7j (via MFAEnforcer).
 *   - Volontairement : n'importe quel utilisateur peut enrôler son TOTP via
 *     un lien dans son profil (CRMParametres). Ce n'est pas obligatoire pour
 *     les rôles non-admin mais c'est encouragé.
 *
 * Flow Supabase MFA TOTP (3 étapes natives) :
 *   1. `supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName })`
 *      → renvoie un QR SVG + un secret texte (à scanner OU saisir
 *        manuellement dans l'app authenticator)
 *   2. User entre le code 6 chiffres → on appelle :
 *      `mfa.challenge({ factorId })` → renvoie challengeId
 *      `mfa.verify({ factorId, challengeId, code })` → confirme le facteur
 *   3. Success → factor passe en `status='verified'`, on redirige.
 *
 * Sécurité :
 *   - Si l'enroll échoue ou que l'user quitte avant verify, le factor reste
 *     en `unverified` côté Supabase. On nettoie au mount (cleanup des
 *     factors unverified d'enrolls précédents abandonnés).
 *   - On affiche le secret texte en clair pour permettre la saisie manuelle
 *     (cas des apps qui ne scannent pas, ou pour faire un backup),
 *     mais on prévient l'utilisateur dans un encart d'attention.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMFAStatus } from "@/hooks/useMFAStatus";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Shield,
  Loader2,
  CheckCircle2,
  Copy,
  AlertCircle,
  Smartphone,
  ArrowRight,
} from "lucide-react";

type Step = "loading" | "enroll" | "verify" | "success" | "error";

export default function SetupMFA() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasTotpFactor, refresh, isMfaRequired } = useMFAStatus();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Friendly name : email split avant @ + suffixe LYTA (visible dans l'app TOTP)
  const friendlyName = useMemo(() => {
    const local = user?.email?.split("@")[0] || "user";
    return `LYTA — ${local}`;
  }, [user?.email]);

  // Démarre l'enrollment au mount (sauf si déjà fait)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!user) {
        navigate("/connexion");
        return;
      }

      // Si l'user a DÉJÀ un factor TOTP verified, on ne re-enroll pas — on
      // l'envoie en page success direct.
      if (hasTotpFactor) {
        if (!cancelled) setStep("success");
        return;
      }

      try {
        // Nettoyage : on supprime les factors "unverified" qui traînent
        // d'un enroll abandonné, sinon Supabase râle qu'il y en a déjà.
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const stale = (factors?.totp ?? []).filter((f) => f.status !== "verified");
        for (const f of stale) {
          try {
            await supabase.auth.mfa.unenroll({ factorId: f.id });
          } catch {
            // ignore — on n'est pas bloquant si le cleanup échoue
          }
        }

        const { data, error } = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName,
        });
        if (cancelled) return;
        if (error) throw error;
        if (!data || data.type !== "totp") throw new Error("Réponse MFA invalide");

        setFactorId(data.id);
        setQrSvg(data.totp.qr_code);
        setSecret(data.totp.secret);
        setStep("enroll");
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMessage(msg);
        setStep("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, hasTotpFactor, navigate, friendlyName]);

  const handleVerify = async () => {
    if (!factorId || code.length !== 6) return;
    setVerifying(true);
    setErrorMessage(null);
    try {
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeErr) throw challengeErr;
      if (!challenge) throw new Error("Challenge MFA vide");

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyErr) throw verifyErr;

      // Refresh le hook pour que l'app sache que MFA est OK
      await refresh();
      setStep("success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      toast({
        title: "Code invalide",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copié dans le presse-papiers" });
  };

  const handleContinue = () => {
    // Retour à l'app : admin → /crm, king → /king, sinon /crm par défaut
    navigate("/crm");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 p-3 rounded-full bg-primary/10 w-fit">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">
            {step === "success" ? "2FA activé !" : "Activer la double authentification"}
          </CardTitle>
          <CardDescription>
            {step === "success"
              ? "Votre compte est désormais protégé par un facteur TOTP."
              : isMfaRequired
                ? "En tant qu'administrateur, vous devez activer le 2FA pour continuer."
                : "Sécurisez votre compte avec un code temporaire à 6 chiffres."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {step === "loading" && (
            <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Préparation du QR code…</p>
            </div>
          )}

          {step === "enroll" && qrSvg && secret && (
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Smartphone className="h-4 w-4" />
                  Étape 1 — Scanne ce QR code
                </div>
                <p className="text-sm text-muted-foreground">
                  Avec une app authenticator (Google Authenticator, Authy,
                  1Password, Bitwarden…).
                </p>
                <div
                  className="flex justify-center bg-white p-4 rounded-lg border"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="manual-secret" className="text-xs">
                  Ou saisis ce secret manuellement
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="manual-secret"
                    value={secret}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopy(secret)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 items-start p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md text-xs text-amber-900 dark:text-amber-100">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p>
                  <strong>Sauvegarde ce secret</strong> dans un endroit sûr (gestionnaire
                  de mots de passe). En cas de perte de ton téléphone, il te permettra
                  de re-configurer ton authenticator.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <Button
                  type="button"
                  onClick={() => setStep("verify")}
                  className="w-full gap-2"
                >
                  J'ai scanné — continuer
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === "verify" && (
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="text-sm font-medium">Étape 2 — Saisis le code</div>
                <p className="text-sm text-muted-foreground">
                  Entre les 6 chiffres affichés actuellement par ton app
                  authenticator.
                </p>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  className="text-center text-2xl tracking-widest font-mono h-14"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && code.length === 6 && !verifying) {
                      handleVerify();
                    }
                  }}
                />
              </div>

              {errorMessage && (
                <p className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                  {errorMessage}
                </p>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCode("");
                    setStep("enroll");
                  }}
                >
                  Retour QR
                </Button>
                <Button
                  type="button"
                  onClick={handleVerify}
                  disabled={code.length !== 6 || verifying}
                  className="flex-1 gap-2"
                >
                  {verifying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Vérification…
                    </>
                  ) : (
                    <>
                      Activer le 2FA
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === "success" && (
            <div className="space-y-4 text-center">
              <div className="mx-auto p-3 rounded-full bg-emerald-100 dark:bg-emerald-950/40 w-fit">
                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              </div>
              <p className="text-sm text-muted-foreground">
                À ta prochaine connexion, on te demandera ton code 6 chiffres
                en plus de ton mot de passe.
              </p>
              <Button
                type="button"
                onClick={handleContinue}
                className="w-full gap-2"
              >
                Retour au tableau de bord
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {step === "error" && (
            <div className="space-y-4 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
              <div>
                <p className="font-medium">Impossible de démarrer l'enrôlement</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {errorMessage || "Erreur inconnue. Réessaie ou contacte le support."}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => window.location.reload()}
                className="w-full"
              >
                Réessayer
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
