import { useState, useEffect } from "react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { Loader2, Phone, RefreshCw, ShieldCheck, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SmsVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  phoneNumber: string;
  verificationType: "login" | "contract_deposit";
  onVerified: () => void;
  onCancel?: () => void;
}

export function SmsVerificationDialog({
  open,
  onOpenChange,
  userId,
  phoneNumber,
  verificationType,
  onVerified,
  onCancel,
}: SmsVerificationDialogProps) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [testCode, setTestCode] = useState<string | null>(null);

  // Send code on open
  useEffect(() => {
    if (open && userId && phoneNumber) {
      sendCode();
    }
  }, [open, userId, phoneNumber]);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const sendCode = async () => {
    setSending(true);
    setTestCode(null);
    try {
      const { data, error } = await supabase.functions.invoke("send-verification-sms", {
        body: {
          userId,
          phoneNumber,
          verificationType,
        },
      });

      if (error) throw error;

      if (data.simulated && data.testCode) {
        setTestCode(data.testCode);
        toast.info("Mode test: code affiché ci-dessous");
      } else {
        toast.success("Code envoyé par SMS");
      }

      setCountdown(60); // 60 seconds before resend
    } catch (error) {
      console.error("Error sending SMS:", error);
      toast.error("Erreur lors de l'envoi du SMS");
    } finally {
      setSending(false);
    }
  };

  const verifyCode = async () => {
    if (code.length !== 6) {
      toast.error("Veuillez entrer le code à 6 chiffres");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-sms-code", {
        body: {
          userId,
          code,
          verificationType,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success("Vérification réussie !");
        onOpenChange(false);
        // Small delay to ensure dialog closes before calling onVerified
        setTimeout(() => {
          onVerified();
        }, 100);
      } else {
        toast.error(data.error || "Code incorrect");
        setCode("");
      }
    } catch (error: any) {
      console.error("Error verifying code:", error);
      const message = error?.message || "Erreur de vérification";
      toast.error(message);
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    onOpenChange(false);
  };

  const maskedPhone = phoneNumber.replace(/(\d{2})(\d+)(\d{2})/, "$1****$3");

  // Always render if we have user/phone data, regardless of open state
  // This prevents the dialog from disappearing unexpectedly
  if (!open && !userId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-lg border bg-card shadow-lg">
        <div className="flex items-start justify-between gap-4 border-b p-6">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 text-lg font-semibold leading-none tracking-tight">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Vérification SMS
            </h2>
            <p className="text-sm text-muted-foreground">
              {verificationType === "login"
                ? "Pour sécuriser votre connexion, entrez le code envoyé par SMS."
                : "Pour valider le dépôt de contrat, entrez le code envoyé par SMS."}
            </p>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleCancel}
            aria-label="Fermer"
            className="shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-6 p-6">
          {/* Phone display */}
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Phone className="h-4 w-4" />
            <span>Code envoyé au {maskedPhone}</span>
          </div>

          {/* Test code display (simulation mode) */}
          {testCode && (
            <div className="rounded-lg border bg-muted p-3 text-center">
              <p className="text-sm font-medium">
                Mode test - Code: <span className="font-mono text-lg">{testCode}</span>
              </p>
            </div>
          )}

          {/* OTP Input */}
          <div className="flex justify-center">
            <InputOTP value={code} onChange={setCode} maxLength={6} disabled={loading}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          {/* Resend button */}
          <div className="text-center">
            <Button variant="ghost" size="sm" onClick={sendCode} disabled={sending || countdown > 0}>
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {countdown > 0 ? `Renvoyer dans ${countdown}s` : "Renvoyer le code"}
            </Button>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={handleCancel} disabled={loading}>
              Annuler
            </Button>
            <Button className="flex-1" onClick={verifyCode} disabled={loading || code.length !== 6}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Vérifier
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
