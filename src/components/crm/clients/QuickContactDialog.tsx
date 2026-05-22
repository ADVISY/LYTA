/**
 * QuickContactDialog
 * ==================
 * Petite popup d'action rapide depuis la liste des Adresses (ou ailleurs) :
 * - Mode 'whatsapp' : compose un message + ouvre wa.me/{phone}
 * - Mode '3cx'      : ouvre tel:{phone} (intercepté par 3CX si installé)
 *
 * Affiche les numéros disponibles (phone fixe + mobile) → le broker choisit
 * lequel utiliser. Message pré-rempli optionnel pour WhatsApp.
 */
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { MessageCircle, Phone, ExternalLink } from "lucide-react";

export type QuickContactMode = "whatsapp" | "3cx";

interface QuickContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: QuickContactMode;
  client: {
    first_name?: string | null;
    last_name?: string | null;
    company_name?: string | null;
    phone?: string | null;
    mobile?: string | null;
  } | null;
  /** Templates pré-remplis pour WhatsApp (optionnel) */
  defaultMessage?: string;
}

/**
 * Normalise un numéro téléphone suisse en E.164 (sans espaces).
 * "+41 79 123 45 67" → "41791234567"
 * "079 123 45 67"    → "41791234567"
 * "0791234567"       → "41791234567"
 */
function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let p = String(raw).replace(/\D/g, "");  // garde uniquement les chiffres
  if (!p) return null;
  // Si commence par 0 et 10-11 chiffres, on assume CH → préfixe 41
  if (p.startsWith("0") && (p.length === 10 || p.length === 11)) {
    p = "41" + p.slice(1);
  }
  // Si commence par 41 ou 33 ou autre indicatif valide, on garde tel quel
  return p;
}

const DEFAULT_TEMPLATES = {
  intro: "Bonjour {prenom}, c'est {agent} de {cabinet}. Je vous contacte suite à votre demande.",
  followup: "Bonjour {prenom}, je reviens vers vous concernant votre dossier. Quand seriez-vous disponible pour un échange ?",
  rdv: "Bonjour {prenom}, suite à notre dernier échange, voici un lien pour réserver un créneau qui vous convient :",
  signature: "Bonjour {prenom}, vous trouverez ci-joint le mandat à signer. N'hésitez pas si vous avez des questions.",
};

export function QuickContactDialog({ open, onOpenChange, mode, client, defaultMessage }: QuickContactDialogProps) {
  const fixe = normalizePhone(client?.phone);
  const mobile = normalizePhone(client?.mobile);
  const availableNumbers: Array<{ label: string; value: string; raw: string }> = [];
  if (mobile) availableNumbers.push({ label: "Mobile", value: mobile, raw: client?.mobile || "" });
  if (fixe) availableNumbers.push({ label: "Fixe", value: fixe, raw: client?.phone || "" });

  // Pré-sélectionne le mobile en priorité (pour WhatsApp obligatoire, pour 3CX préférable)
  const [selectedNumber, setSelectedNumber] = useState<string>("");
  const [message, setMessage] = useState<string>(defaultMessage || "");

  useEffect(() => {
    if (availableNumbers.length > 0 && !selectedNumber) {
      setSelectedNumber(availableNumbers[0].value);
    }
    if (defaultMessage !== undefined) {
      setMessage(defaultMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, client?.phone, client?.mobile, defaultMessage]);

  const clientName = (client?.first_name || client?.last_name)
    ? `${client?.first_name || ""} ${client?.last_name || ""}`.trim()
    : (client?.company_name || "ce contact");

  const applyTemplate = (template: string) => {
    const filled = template
      .replace(/\{prenom\}/g, client?.first_name || "")
      .replace(/\{nom\}/g, client?.last_name || "")
      .replace(/\{agent\}/g, "")  // sera complété par le broker
      .replace(/\{cabinet\}/g, "");
    setMessage(filled);
  };

  const handleLaunch = () => {
    if (!selectedNumber) return;
    if (mode === "whatsapp") {
      const url = `https://wa.me/${selectedNumber}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
      window.open(url, "_blank", "noopener,noreferrer");
    } else if (mode === "3cx") {
      // tel: protocol — 3CX (et tout softphone) intercepte automatiquement
      window.location.href = `tel:+${selectedNumber}`;
    }
    onOpenChange(false);
  };

  const isWhatsApp = mode === "whatsapp";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isWhatsApp ? (
              <>
                <MessageCircle className="h-5 w-5 text-emerald-600" />
                <span>WhatsApp — {clientName}</span>
              </>
            ) : (
              <>
                <Phone className="h-5 w-5 text-blue-600" />
                <span>Appel 3CX — {clientName}</span>
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isWhatsApp
              ? "Le client reçoit un message via WhatsApp. Choisis le numéro et le texte."
              : "L'appel s'ouvrira via 3CX (ou ton application téléphonie par défaut)."}
          </DialogDescription>
        </DialogHeader>

        {availableNumbers.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            <Phone className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
            Aucun numéro de téléphone enregistré pour ce contact.
            <p className="mt-2 text-xs">Ajoute un numéro depuis la fiche client.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Choix du numéro */}
            <div>
              <Label className="text-xs uppercase tracking-wide">Numéro à contacter</Label>
              <RadioGroup value={selectedNumber} onValueChange={setSelectedNumber} className="mt-2 space-y-1">
                {availableNumbers.map((num) => (
                  <label
                    key={num.value}
                    className="flex items-center gap-3 p-2 border rounded-md cursor-pointer hover:bg-muted/50"
                  >
                    <RadioGroupItem value={num.value} id={num.value} />
                    <div className="flex-1">
                      <p className="text-sm font-medium">+{num.value}</p>
                      <p className="text-xs text-muted-foreground">{num.label} — {num.raw}</p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>

            {/* Message WhatsApp + templates */}
            {isWhatsApp && (
              <>
                <div>
                  <Label htmlFor="qc-message" className="text-xs uppercase tracking-wide">Message (optionnel)</Label>
                  <Textarea
                    id="qc-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={`Bonjour ${client?.first_name || ""}, ...`}
                    rows={4}
                    className="mt-1"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyTemplate(DEFAULT_TEMPLATES.intro)}
                    className="h-7 text-xs"
                  >
                    Intro
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyTemplate(DEFAULT_TEMPLATES.followup)}
                    className="h-7 text-xs"
                  >
                    Relance
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyTemplate(DEFAULT_TEMPLATES.rdv)}
                    className="h-7 text-xs"
                  >
                    RDV
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyTemplate(DEFAULT_TEMPLATES.signature)}
                    className="h-7 text-xs"
                  >
                    Signature
                  </Button>
                </div>
              </>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
              <Button
                onClick={handleLaunch}
                className={isWhatsApp ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-700"}
                disabled={!selectedNumber}
              >
                {isWhatsApp ? (
                  <>
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Ouvrir WhatsApp
                  </>
                ) : (
                  <>
                    <Phone className="h-4 w-4 mr-2" />
                    Appeler
                  </>
                )}
                <ExternalLink className="h-3.5 w-3.5 ml-2 opacity-60" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
