/**
 * RenameDocumentDialog — Renomme un document (champ `file_name` côté DB).
 *
 * Le fichier physique dans Supabase Storage garde son `file_key` (path)
 * inchangé : on ne touche qu'à l'affichage logique. C'est volontaire :
 *   - Évite de casser les références (signed URLs, signatures liées, etc.)
 *   - Le nom logique est celui qu'on affiche partout dans le CRM
 *   - Si on voulait vraiment renommer le fichier dans storage, il faudrait
 *     copier + supprimer + repointer toutes les références (lourd et risqué)
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Pencil } from "lucide-react";

export interface RenameDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string | null;
  currentName: string;
  onRenamed?: () => void;
}

export function RenameDocumentDialog({
  open,
  onOpenChange,
  documentId,
  currentName,
  onRenamed,
}: RenameDocumentDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setName(currentName);
  }, [open, currentName]);

  const handleSave = async () => {
    if (!documentId) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast({
        title: "Nom invalide",
        description: "Le nom du document ne peut pas être vide.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("documents")
        .update({ file_name: trimmed })
        .eq("id", documentId);
      if (error) throw error;
      toast({ title: "Document renommé" });
      onRenamed?.();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" />
            Renommer le document
          </DialogTitle>
          <DialogDescription>
            Modifie le nom affiché du document. Le fichier reste inchangé dans
            le stockage.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="rename-doc-input">Nouveau nom</Label>
          <Input
            id="rename-doc-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="contrat-helsana-2026.pdf"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && !saving) handleSave();
            }}
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enregistrement…
              </>
            ) : (
              "Enregistrer"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
