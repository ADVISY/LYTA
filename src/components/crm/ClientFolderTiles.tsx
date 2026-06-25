/**
 * ClientFolderTiles — Barre de dossiers cliquables dans l'onglet Documents.
 *
 * Affichage :
 *   [📂 Tous (12)]  [📁 Contrats (5)]  [📁 ID (2)]  [📁 Sinistres (3)]  [+ Nouveau]
 *
 * Comportement :
 *   - Tile "Tous" → activeFolderId = null → la liste docs montre TOUT
 *   - Tile "Racine" → activeFolderId = "__root__" → docs sans folder_id
 *   - Tile dossier → activeFolderId = folder.id → filtre la liste
 *   - "+ Nouveau" → ouvre un mini dialog de saisie du nom
 *   - Menu '⋮' sur chaque tile dossier → Renommer / Supprimer
 *
 * On ne fait PAS le filtrage des docs ici — c'est le parent (ClientDetail)
 * qui filtre `clientDocuments` en fonction de `activeFolderId`. Ça garde
 * ce composant focalisé sur la présentation des dossiers.
 */
import { useState, useMemo } from "react";
import {
  useClientFolders,
  type ClientDocumentFolder,
} from "@/hooks/useClientFolders";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Folder,
  FolderOpen,
  FolderPlus,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  Files,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Valeur sentinelle pour la tile "Racine" (= docs sans folder_id). */
export const ROOT_FOLDER_ID = "__root__";

export interface ClientFolderTilesProps {
  clientId: string;
  /** Sélection active. null = "Tous", ROOT_FOLDER_ID = racine, UUID = dossier. */
  activeFolderId: string | null;
  onActiveChange: (folderId: string | null) => void;
  /** Map folder_id → nb docs (calculé par le parent à partir de clientDocuments). */
  counts: {
    all: number;
    root: number;
    byFolder: Record<string, number>;
  };
}

export function ClientFolderTiles({
  clientId,
  activeFolderId,
  onActiveChange,
  counts,
}: ClientFolderTilesProps) {
  const { folders, loading, createFolder, renameFolder, removeFolder, creating } =
    useClientFolders(clientId);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const [renameTarget, setRenameTarget] = useState<ClientDocumentFolder | null>(
    null
  );
  const [renameName, setRenameName] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<ClientDocumentFolder | null>(
    null
  );

  const sortedFolders = useMemo(
    () => [...folders].sort((a, b) => a.name.localeCompare(b.name)),
    [folders]
  );

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    try {
      await createFolder({ name: trimmed });
      setNewName("");
      setCreateOpen(false);
    } catch {
      // toast déjà géré par le hook
    }
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    const trimmed = renameName.trim();
    if (!trimmed || trimmed === renameTarget.name) {
      setRenameTarget(null);
      return;
    }
    try {
      await renameFolder(renameTarget.id, trimmed);
      setRenameTarget(null);
    } catch {
      // toast déjà géré
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await removeFolder(deleteTarget.id);
      // Si on était sur le dossier supprimé, on retombe sur "Tous"
      if (activeFolderId === deleteTarget.id) onActiveChange(null);
      setDeleteTarget(null);
    } catch {
      // toast déjà géré
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Tile "Tous" */}
        <TileButton
          icon={<Files className="h-3.5 w-3.5" />}
          label="Tous"
          count={counts.all}
          active={activeFolderId === null}
          onClick={() => onActiveChange(null)}
        />

        {/* Tile "Racine" (docs sans dossier) — visible seulement si pertinent */}
        {(counts.root > 0 || activeFolderId === ROOT_FOLDER_ID) && (
          <TileButton
            icon={<Inbox className="h-3.5 w-3.5" />}
            label="Racine"
            count={counts.root}
            active={activeFolderId === ROOT_FOLDER_ID}
            onClick={() => onActiveChange(ROOT_FOLDER_ID)}
          />
        )}

        {/* Tiles dossiers */}
        {sortedFolders.map((folder) => {
          const isActive = activeFolderId === folder.id;
          return (
            <div key={folder.id} className="relative group">
              <TileButton
                icon={
                  isActive ? (
                    <FolderOpen className="h-3.5 w-3.5" />
                  ) : (
                    <Folder className="h-3.5 w-3.5" />
                  )
                }
                label={folder.name}
                count={counts.byFolder[folder.id] ?? 0}
                active={isActive}
                onClick={() => onActiveChange(folder.id)}
                rightSlot={
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        className="ml-1 -mr-1 p-0.5 rounded hover:bg-foreground/10"
                        aria-label="Actions dossier"
                      >
                        <MoreVertical className="h-3 w-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenuItem
                        onClick={() => {
                          setRenameTarget(folder);
                          setRenameName(folder.name);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-2" />
                        Renommer
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDeleteTarget(folder)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                }
              />
            </div>
          );
        })}

        {/* Bouton "+ Nouveau dossier" */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setCreateOpen(true)}
          className="h-8 gap-1.5 border-dashed"
        >
          <FolderPlus className="h-3.5 w-3.5" />
          Nouveau dossier
        </Button>

        {loading && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Dialog créer */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="h-4 w-4" />
              Nouveau dossier
            </DialogTitle>
            <DialogDescription>
              Le dossier sera créé pour ce client uniquement. Tu pourras y
              déplacer des documents existants ou y uploader directement.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="new-folder-name">Nom du dossier</Label>
            <Input
              id="new-folder-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Contrats, Pièces ID, Sinistres…"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !creating) handleCreate();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || creating}>
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Création…
                </>
              ) : (
                "Créer"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog renommer */}
      <Dialog
        open={!!renameTarget}
        onOpenChange={(o) => { if (!o) setRenameTarget(null); }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              Renommer le dossier
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="rename-folder-name">Nouveau nom</Label>
            <Input
              id="rename-folder-name"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              Annuler
            </Button>
            <Button onClick={handleRename} disabled={!renameName.trim()}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog supprimer */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-4 w-4" />
              Supprimer le dossier
            </DialogTitle>
            <DialogDescription>
              {deleteTarget &&
                `Le dossier "${deleteTarget.name}" sera supprimé. Les ${
                  counts.byFolder[deleteTarget.id] ?? 0
                } document(s) qu'il contient reviendront à la racine — ils ne seront pas supprimés.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Tile interne — petit composant pour homogénéiser le rendu
// ────────────────────────────────────────────────────────────────────────────
interface TileButtonProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  rightSlot?: React.ReactNode;
}
function TileButton({
  icon,
  label,
  count,
  active,
  onClick,
  rightSlot,
}: TileButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 inline-flex items-center gap-1.5 px-3 rounded-md border text-sm transition-colors",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background hover:bg-muted/50 border-border"
      )}
    >
      {icon}
      <span className="font-medium">{label}</span>
      <span
        className={cn(
          "text-xs tabular-nums",
          active ? "opacity-90" : "text-muted-foreground"
        )}
      >
        {count}
      </span>
      {rightSlot}
    </button>
  );
}
