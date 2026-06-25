/**
 * ClientScanIADialog — Scan IA "in-fiche client".
 *
 * Pourquoi : Habib veut que tout ce qui touche aux documents d'un client
 * se passe DANS la fiche client (`ClientDetail`), pas sur une page CRM
 * séparée. L'IA Scan ne fait pas exception.
 *
 * Workflow :
 *   1. Le courtier ouvre l'onglet "Documents" de la fiche client.
 *   2. Il clique "Scanner avec IA" → ce dialog s'ouvre.
 *   3. Step "upload" : il charge un ou plusieurs PDF/JPG via <ScanBatchUpload>.
 *      Le batch est créé + classifié automatiquement par l'edge function
 *      `classify-batch-documents`.
 *   4. Step "review" : on charge le batch fraîchement créé, on l'affiche dans
 *      <ScanBatchReview clientId={clientId} /> qui propose un bouton
 *      "Importer les documents". L'import appelle déjà
 *      `validateBatchAndImportDocuments(batchId, clientId)` qui :
 *        - Insère un row dans `documents` par doc classifié, avec
 *          owner_type='client', owner_id=clientId, category=classification,
 *          metadata (scan_id, confidence, extracted_data).
 *        - Marque le batch comme `validated`.
 *   5. Step "done" : on ferme le dialog et on callback `onImportDone` pour
 *      que `ClientDetail` re-charge sa liste de documents.
 *
 * On ne dupliquait pas la logique IA : on chaîne juste les composants
 * existants `ScanBatchUpload` + `ScanBatchReview` qui font déjà tout.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, ArrowLeft } from "lucide-react";
import ScanBatchUpload from "./ScanBatchUpload";
import ScanBatchReview from "./ScanBatchReview";
import type { ScanBatch } from "@/hooks/useScanBatches";

export interface ClientScanIADialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Client cible — les docs scannés iront dans sa fiche. */
  clientId: string;
  /** Optional : nom du client pour personnaliser le header. */
  clientLabel?: string;
  /** Callback déclenché après import réussi des documents dans la fiche.
   *  Le parent (ClientDetail) doit recharger sa liste de documents. */
  onImportDone?: () => void;
}

type Step = "upload" | "loading_batch" | "review" | "error";

export function ClientScanIADialog({
  open,
  onOpenChange,
  clientId,
  clientLabel,
  onImportDone,
}: ClientScanIADialogProps) {
  const [step, setStep] = useState<Step>("upload");
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batch, setBatch] = useState<ScanBatch | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset quand on ferme/rouvre
  useEffect(() => {
    if (!open) {
      // petit delay pour ne pas voir le reset pendant la fermeture
      const t = setTimeout(() => {
        setStep("upload");
        setBatchId(null);
        setBatch(null);
        setErrorMessage(null);
      }, 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Quand ScanBatchUpload nous donne le batchId, on recharge le batch + docs
  // (classification est déjà terminée à ce stade, gérée par ScanBatchUpload).
  const handleBatchCreated = async (createdBatchId: string) => {
    setBatchId(createdBatchId);
    setStep("loading_batch");
    setErrorMessage(null);

    try {
      // Cast `any` pour éviter "Type instantiation excessively deep" sur la
      // requête nested. Pattern déjà utilisé ailleurs dans le repo.
      const sb: any = supabase;
      const { data, error } = await sb
        .from("scan_batches")
        .select(`
          *,
          documents:scan_batch_documents(*)
        `)
        .eq("id", createdBatchId)
        .single();

      if (error) throw error;
      setBatch(data as ScanBatch);
      setStep("review");
    } catch (err) {
      console.error("[ClientScanIADialog] Failed to reload batch:", err);
      setErrorMessage(
        err instanceof Error ? err.message : "Erreur de chargement du dossier"
      );
      setStep("error");
    }
  };

  const handleImportSuccess = () => {
    onImportDone?.();
    // Ferme le dialog. Le useEffect ci-dessus reset le state après 200ms.
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            Scanner avec IA
            {clientLabel && (
              <span className="text-sm font-normal text-muted-foreground">
                · {clientLabel}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            {step === "upload" &&
              "Importez un ou plusieurs documents (PDF, image). L'IA va les classifier, puis vous pourrez les attacher à la fiche client."}
            {step === "loading_batch" && "Chargement du dossier classifié…"}
            {step === "review" &&
              "Vérifiez la classification puis cliquez sur « Importer les documents » pour les ajouter à la fiche client."}
            {step === "error" && "Une erreur est survenue."}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {step === "upload" && (
            <ScanBatchUpload onBatchCreated={handleBatchCreated} />
          )}

          {step === "loading_batch" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                L'IA termine la classification…
              </p>
            </div>
          )}

          {step === "review" && batch && (
            <ScanBatchReview
              batch={batch}
              clientId={clientId}
              onImportSuccess={handleImportSuccess}
            />
          )}

          {step === "error" && (
            <div className="space-y-4">
              <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {errorMessage || "Erreur inconnue."}
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setStep("upload");
                  setBatchId(null);
                  setBatch(null);
                  setErrorMessage(null);
                }}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Recommencer
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
