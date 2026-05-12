/**
 * IAScanContractsWizard
 * ----------------------
 * Orchestrates the post-scan flow that turns IA-extracted products into
 * actual contracts in the database — using the EXACT same ContractForm
 * the broker uses for manual creation, just pre-filled. Per Habib:
 * "personne ne doit différencier que c'est l'IA qui a rentré le contrat".
 *
 * Flow:
 *   1. Sequential ContractForm per product group (one company + one insured)
 *      - Each group opens the exact same ContractForm shown for manual entry,
 *        with prefill={...} pre-populating company / start date / products /
 *        LAMal franchise+accident / etc.
 *      - The broker can edit anything before clicking Valider.
 *      - Submission goes through the same createPolicy path as manual.
 *   2. Optional post-submit hooks
 *      - Create a "résiliation" suivi if the scan included a résiliation doc.
 *      - Mark the scan as processed.
 *   3. Done screen with summary.
 *
 * Multi-group support: the wizard tracks which groups are done and which
 * is currently being filled. When the user closes the active ContractForm
 * (success), we advance to the next group automatically.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  FileSignature,
  Sparkles,
} from "lucide-react";
import type { PendingScan, ProductDetected } from "@/hooks/usePendingScans";
import ContractForm from "@/components/crm/ContractForm";
import {
  groupScannedProducts,
  scanToContractFormPrefill,
  type ProductGroup,
} from "./scanToContractPrefill";

export interface IAScanContractsWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scan: PendingScan;
  /** Resolved client id. Must be non-null — the wizard creates contracts FOR a client, so the client must already exist. */
  clientId: string | null;
  /** Which set of products to materialise. Typically scan.new_products_detected. */
  products: ProductDetected[];
  /** Whether the scan included a résiliation doc → fire a suivi after each contract is created. */
  hasResiliation?: boolean;
  /** Called when all groups have been validated (or the user explicitly closes the wizard). */
  onAllDone: (createdPolicyIds: string[]) => void;
}

export function IAScanContractsWizard({
  open,
  onOpenChange,
  scan,
  clientId,
  products,
  hasResiliation = false,
  onAllDone,
}: IAScanContractsWizardProps) {
  // 1. Compute product groups (one ContractForm per coherent unit)
  const groups = useMemo<ProductGroup[]>(
    () => groupScannedProducts(products),
    [products],
  );

  // 2. Per-group lifecycle: pending → opened → done
  const [currentIndex, setCurrentIndex] = useState(0);
  const [doneIndexes, setDoneIndexes] = useState<Set<number>>(new Set());
  const [createdPolicyIds, setCreatedPolicyIds] = useState<string[]>([]);
  const [contractFormOpen, setContractFormOpen] = useState(false);

  // Reset on open / new scan
  useEffect(() => {
    if (open) {
      setCurrentIndex(0);
      setDoneIndexes(new Set());
      setCreatedPolicyIds([]);
      setContractFormOpen(false);
    }
  }, [open, scan.id]);

  const allDone = groups.length > 0 && doneIndexes.size === groups.length;

  const handleStartGroup = (index: number) => {
    setCurrentIndex(index);
    setContractFormOpen(true);
  };

  const handleGroupSuccess = () => {
    setDoneIndexes((prev) => {
      const next = new Set(prev);
      next.add(currentIndex);
      return next;
    });
    setContractFormOpen(false);

    // Auto-advance to the next undone group
    const nextIndex = groups.findIndex((_, i) => !doneIndexes.has(i) && i !== currentIndex);
    if (nextIndex >= 0) {
      setTimeout(() => {
        setCurrentIndex(nextIndex);
        setContractFormOpen(true);
      }, 200);
    }
  };

  const handleFinish = () => {
    onAllDone(createdPolicyIds);
    onOpenChange(false);
  };

  // ============================================================
  // RENDER
  // ============================================================

  // No mandat check at all — flow direct creation as requested by Habib.

  // No client id → can't create contracts (should have been handled upstream, but guard)
  if (!clientId) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fiche client manquante</DialogTitle>
            <DialogDescription>
              La fiche client doit être créée avant les contrats. Termine l'étape "Validation client" d'abord.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // No products → nothing to do
  if (groups.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aucun nouveau contrat détecté</DialogTitle>
            <DialogDescription>
              Le scan n'a identifié aucun nouveau produit à matérialiser en contrat.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // The active ContractForm (one at a time)
  const currentGroup = groups[currentIndex];
  const currentPrefill = currentGroup
    ? scanToContractFormPrefill(scan, currentGroup.products, { hasResiliation })
    : undefined;

  return (
    <>
      <Dialog open={open && !contractFormOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Contrats détectés par l'IA
            </DialogTitle>
            <DialogDescription>
              {groups.length === 1
                ? "Un contrat à créer. Vérifie et valide dans le formulaire qui s'ouvre."
                : `${groups.length} contrats à créer (un par compagnie + assuré). Ils s'ouvrent un par un dans le formulaire standard.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            {groups.map((group, i) => {
              const isDone = doneIndexes.has(i);
              return (
                <div
                  key={group.key}
                  className={`flex items-center justify-between rounded-lg border p-3 ${
                    isDone
                      ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
                      : "border-border bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {isDone ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{group.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {group.products.length} produit{group.products.length > 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  {!isDone && (
                    <Button
                      size="sm"
                      variant={i === currentIndex ? "default" : "outline"}
                      onClick={() => handleStartGroup(i)}
                    >
                      {i === currentIndex ? "Reprendre" : "Ouvrir"}
                    </Button>
                  )}
                  {isDone && (
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                      Validé
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>

          {hasResiliation && !allDone && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-3 text-sm">
              <p className="flex items-center gap-2 text-blue-800 dark:text-blue-300">
                <FileSignature className="h-4 w-4" />
                Une résiliation a été détectée — un suivi sera créé automatiquement à la fin.
              </p>
            </div>
          )}

          <DialogFooter className="flex justify-between sm:justify-between">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {allDone ? "Fermer" : "Annuler"}
            </Button>
            {!allDone ? (
              <Button onClick={() => handleStartGroup(currentIndex)}>
                {doneIndexes.size === 0 ? "Démarrer" : "Continuer"} ({doneIndexes.size}/{groups.length})
              </Button>
            ) : (
              <Button onClick={handleFinish}>
                Terminer ({groups.length} contrat{groups.length > 1 ? "s" : ""} créé{groups.length > 1 ? "s" : ""})
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* The active ContractForm — same component as manual creation */}
      {currentGroup && currentPrefill && (
        <ContractForm
          clientId={clientId}
          open={contractFormOpen}
          onOpenChange={setContractFormOpen}
          onSuccess={handleGroupSuccess}
          prefill={currentPrefill}
        />
      )}
    </>
  );
}

export default IAScanContractsWizard;
