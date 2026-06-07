// Lets the broker upload a custom PDF (procuration, lettre de résiliation, etc.) and
// send it to a client for remote signature. The client signs via the same /signer/:token
// flow; the final PDF is the original document with an appended signature page.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Send, Upload, ChevronLeft } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserTenant } from "@/hooks/useUserTenant";
import { invokeSupabaseFunction } from "@/lib/edgeFunctions";
import { PdfZonePicker, type SignatureZone } from "@/components/signatures/PdfZonePicker";

interface ImportDocumentForSignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientLabel: string;
  onSent?: () => void;
}

const MAX_PDF_SIZE = 8 * 1024 * 1024; // 8 MB

export default function ImportDocumentForSignatureDialog({
  open,
  onOpenChange,
  clientId,
  clientLabel,
  onSent,
}: ImportDocumentForSignatureDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { tenantId } = useUserTenant();
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  // ─── Sélecteur de zone de signature ────────────────────────────────
  // step "form" = inputs label/description/file.
  // step "zone" = preview PDF + drag pour dessiner la zone signature.
  const [step, setStep] = useState<"form" | "zone">("form");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [zone, setZone] = useState<SignatureZone | null>(null);

  // Génère une URL preview locale du PDF dès qu'un fichier est sélectionné,
  // pour que le PdfZonePicker puisse l'afficher dans un iframe sans upload.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const reset = () => {
    setFile(null);
    setLabel("");
    setDescription("");
    setZone(null);
    setStep("form");
  };

  const handleSubmit = async () => {
    if (!file) {
      toast({ title: "Fichier requis", description: "Veuillez sélectionner un PDF.", variant: "destructive" });
      return;
    }
    if (file.type !== "application/pdf") {
      toast({ title: "Format invalide", description: "Seuls les PDF sont acceptés.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_PDF_SIZE) {
      toast({ title: "Fichier trop volumineux", description: "Maximum 8 Mo.", variant: "destructive" });
      return;
    }
    if (!label.trim()) {
      toast({ title: "Intitulé requis", variant: "destructive" });
      return;
    }
    if (!user?.id || !tenantId) {
      toast({ title: "Session invalide", variant: "destructive" });
      return;
    }

    setBusy(true);
    try {
      // Upload original PDF under broker's folder so existing storage policies apply
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
      const fileKey = `${user.id}/signature-imports/${clientId}/${Date.now()}_${safeName}`;
      const { error: uploadErr } = await supabase.storage
        .from("documents")
        .upload(fileKey, file, { contentType: "application/pdf", upsert: false });
      if (uploadErr) throw uploadErr;

      const { data: sr, error: insertErr } = await supabase
        .from("signature_requests")
        .insert({
          tenant_id: tenantId,
          client_id: clientId,
          created_by: user.id,
          document_kind: "imported",
          payload: {
            label: label.trim(),
            description: description.trim().slice(0, 1000),
            originalFileName: file.name,
            originalFileSize: file.size,
          },
          preview_file_key: fileKey,
          signature_zone: zone, // null si pas de zone définie (fallback picker 3x3)
        } as any)
        .select("id")
        .single();
      if (insertErr || !sr) throw insertErr || new Error("Création de la demande échouée");

      await invokeSupabaseFunction("send-signature-invite", {
        body: { signatureRequestId: sr.id, appOrigin: window.location.origin },
      });

      toast({ title: "Invitation envoyée", description: `${clientLabel} a reçu un lien pour signer.` });
      reset();
      onOpenChange(false);
      onSent?.();
    } catch (e) {
      // Log full error to the browser console so we can debug from F12 Console
      console.error("[ImportDocumentForSignatureDialog] handleSubmit failed", e);
      const message =
        e instanceof Error
          ? e.message
          : typeof e === "object" && e !== null && "message" in e
          ? String((e as { message: unknown }).message)
          : JSON.stringify(e);
      toast({
        title: "Erreur lors de l'envoi",
        description: message || "Erreur inconnue — voir la console (F12) pour le détail.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) { if (!o) reset(); onOpenChange(o); } }}>
      <DialogContent className={step === "zone" ? "sm:max-w-3xl" : "sm:max-w-lg"}>
        <DialogHeader>
          <DialogTitle>
            {step === "form" ? "Faire signer un document" : "Choisis l'emplacement de la signature"}
          </DialogTitle>
          <DialogDescription>
            {step === "form" ? (
              <>
                Téléverse un PDF que <strong>{clientLabel}</strong> devra signer (procuration,
                lettre de résiliation, etc.). Étape suivante : tu placeras la zone de signature.
              </>
            ) : (
              <>
                Drague la souris sur le document pour dessiner le rectangle où{" "}
                <strong>{clientLabel}</strong> doit signer.
                Le client verra ce rectangle surligné et signera dedans.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {step === "form" && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="sig-doc-label">Intitulé du document *</Label>
              <Input
                id="sig-doc-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex: Procuration assurance maladie"
                maxLength={200}
                disabled={busy}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sig-doc-file">Fichier PDF *</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="sig-doc-file"
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  disabled={busy}
                />
              </div>
              {file && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Upload className="h-3 w-3" />
                  {file.name} ({(file.size / 1024 / 1024).toFixed(2)} Mo)
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="sig-doc-desc">Note pour le client (facultatif)</Label>
              <Textarea
                id="sig-doc-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Quelques mots affichés au client à l'ouverture du lien…"
                rows={3}
                maxLength={1000}
                disabled={busy}
              />
            </div>
          </div>
        )}

        {step === "zone" && previewUrl && (
          <div className="py-2">
            <PdfZonePicker
              pdfUrl={previewUrl}
              zone={zone}
              onChange={setZone}
            />
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === "form" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                Annuler
              </Button>
              <Button
                onClick={() => setStep("zone")}
                disabled={busy || !file || !label.trim()}
                className="gap-2"
              >
                Suivant : placer la signature →
              </Button>
            </>
          )}
          {step === "zone" && (
            <>
              <Button
                variant="ghost"
                onClick={() => setStep("form")}
                disabled={busy}
                className="gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Retour
              </Button>
              <Button onClick={handleSubmit} disabled={busy || !zone} className="gap-2">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {busy ? "Envoi en cours…" : zone ? "Envoyer pour signature" : "Dessine d'abord la zone"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
