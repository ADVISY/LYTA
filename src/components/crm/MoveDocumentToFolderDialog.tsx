/**
 * MoveDocumentToFolderDialog — Déplace un document vers un dossier (ou racine).
 *
 * Liste tous les dossiers du client + option "Racine (sans dossier)" en tête.
 * Click sur une ligne → UPDATE documents.folder_id immédiat → toast → close.
 *
 * Pas de drag&drop dans cette v1 (overkill pour 5 dossiers). Si Habib veut
 * du drag plus tard, on l'ajoutera dans ClientFolderTiles + sur les rows
 * du tableau docs.
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useClientFolders } from "@/hooks/useClientFolders";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Folder, Inbox, Loader2, Check, FolderInput } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MoveDocumentToFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  documentId: string | null;
  /** Folder actuel (pour highlight de l'option active). NULL = racine. */
  currentFolderId: string | null;
  onMoved?: () => void;
}

export function MoveDocumentToFolderDialog({
  open,
  onOpenChange,
  clientId,
  documentId,
  currentFolderId,
  onMoved,
}: MoveDocumentToFolderDialogProps) {
  const { folders, loading } = useClientFolders(clientId);
  const { toast } = useToast();
  const [moving, setMoving] = useState<string | "__root__" | null>(null);

  const handleMove = async (target: string | null) => {
    if (!documentId) return;
    setMoving(target ?? "__root__");
    try {
      const { error } = await supabase
        .from("documents")
        .update({ folder_id: target })
        .eq("id", documentId);
      if (error) throw error;
      toast({ title: target ? "Document déplacé" : "Document remis à la racine" });
      onMoved?.();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setMoving(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderInput className="h-4 w-4" />
            Déplacer le document
          </DialogTitle>
          <DialogDescription>
            Choisis le dossier dans lequel ranger ce document.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 py-2 max-h-72 overflow-y-auto">
          {/* Racine */}
          <FolderRow
            icon={<Inbox className="h-4 w-4" />}
            label="Racine (sans dossier)"
            active={currentFolderId === null}
            disabled={currentFolderId === null}
            loading={moving === "__root__"}
            onClick={() => handleMove(null)}
          />

          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-3 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement des dossiers…
            </div>
          )}

          {!loading && folders.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">
              Aucun dossier pour ce client. Crée-en un depuis la barre de tiles.
            </p>
          )}

          {folders.map((f) => (
            <FolderRow
              key={f.id}
              icon={<Folder className="h-4 w-4" />}
              label={f.name}
              active={currentFolderId === f.id}
              disabled={currentFolderId === f.id}
              loading={moving === f.id}
              onClick={() => handleMove(f.id)}
            />
          ))}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface FolderRowProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
}
function FolderRow({ icon, label, active, disabled, loading, onClick }: FolderRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-md border text-left text-sm transition-colors",
        active
          ? "bg-primary/10 border-primary/30 text-foreground"
          : "border-border hover:bg-muted/50 disabled:opacity-50"
      )}
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {active && <Check className="h-4 w-4 text-primary" />}
      {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
    </button>
  );
}
