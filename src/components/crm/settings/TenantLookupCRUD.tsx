import { useState } from "react";
import { LookupRow } from "@/hooks/useTenantLookups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface CRUDController {
  rows: LookupRow[];
  loading: boolean;
  create: (input: Omit<LookupRow, "id" | "tenant_id" | "is_system">) => Promise<LookupRow | null>;
  update: (id: string, patch: Partial<Pick<LookupRow, "label" | "sort_order" | "description" | "default_amount" | "default_unit">>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

interface TenantLookupCRUDProps {
  title: string;
  description: string;
  /** Show extra fields (description, default_amount, default_unit) */
  withServiceFields?: boolean;
  /** Hint label shown next to the "code" input */
  codeLabel?: string;
  /** Hint label shown next to the "label" input */
  labelLabel?: string;
  /** Add button label */
  addButtonLabel?: string;
  /** Empty state message */
  emptyCustomMessage?: string;
  controller: CRUDController;
}

function generateCodeFromLabel(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
}

export function TenantLookupCRUD({
  title,
  description,
  withServiceFields = false,
  codeLabel = "Code interne",
  labelLabel = "Libellé affiché",
  addButtonLabel = "Ajouter",
  emptyCustomMessage = "Aucun élément personnalisé pour l'instant.",
  controller,
}: TenantLookupCRUDProps) {
  const { rows, loading, create, update, remove } = controller;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LookupRow | null>(null);
  const [formLabel, setFormLabel] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formSortOrder, setFormSortOrder] = useState("100");
  const [busy, setBusy] = useState(false);

  const systemRows = rows.filter((r) => r.is_system);
  const customRows = rows.filter((r) => !r.is_system);

  const openCreate = () => {
    setEditing(null);
    setFormLabel("");
    setFormCode("");
    setFormDescription("");
    setFormAmount("");
    setFormSortOrder("100");
    setDialogOpen(true);
  };

  const openEdit = (row: LookupRow) => {
    setEditing(row);
    setFormLabel(row.label);
    setFormCode(row.code);
    setFormDescription(row.description ?? "");
    setFormAmount(row.default_amount != null ? String(row.default_amount) : "");
    setFormSortOrder(String(row.sort_order));
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formLabel.trim()) return;
    setBusy(true);
    try {
      if (editing) {
        await update(editing.id, {
          label: formLabel.trim(),
          sort_order: parseInt(formSortOrder, 10) || 100,
          description: withServiceFields ? formDescription.trim() || null : undefined,
          default_amount:
            withServiceFields && formAmount ? parseFloat(formAmount) || null : undefined,
        });
      } else {
        const code = formCode.trim() || generateCodeFromLabel(formLabel);
        await create({
          code,
          label: formLabel.trim(),
          sort_order: parseInt(formSortOrder, 10) || 100,
          description: withServiceFields ? formDescription.trim() || null : null,
          default_amount: withServiceFields && formAmount ? parseFloat(formAmount) : null,
          default_unit: null,
        } as Omit<LookupRow, "id" | "tenant_id" | "is_system">);
      }
      setDialogOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (row: LookupRow) => {
    if (!confirm(`Supprimer « ${row.label} » ? Cette action est irréversible.`)) return;
    await remove(row.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          {addButtonLabel}
        </Button>
      </div>

      {loading ? (
        <div className="py-8 text-center">
          <Loader2 className="h-5 w-5 mx-auto animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* System rows (read-only) */}
          {systemRows.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Lock className="h-3 w-3" /> Standard (non modifiable)
                </div>
                {systemRows.map((r) => (
                  <div
                    key={r.id}
                    className={cn(
                      "flex items-center justify-between p-2.5 rounded-md bg-muted/30 text-sm"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{r.label}</span>
                      {withServiceFields && r.default_amount != null && (
                        <span className="text-xs text-muted-foreground">
                          ({r.default_amount} CHF)
                        </span>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      Standard
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Custom rows (editable) */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Personnalisé
              </div>
              {customRows.length === 0 ? (
                <p className="text-sm text-muted-foreground italic py-2">{emptyCustomMessage}</p>
              ) : (
                customRows.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-2.5 rounded-md bg-card border hover:border-primary/30 text-sm"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{r.label}</span>
                      <span className="text-xs text-muted-foreground">
                        Code: <code className="font-mono">{r.code}</code>
                        {withServiceFields && r.default_amount != null && (
                          <span> · {r.default_amount} CHF</span>
                        )}
                        {withServiceFields && r.description && (
                          <span> · {r.description}</span>
                        )}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(r)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(r)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier" : "Ajouter"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Modifie les informations ci-dessous."
                : "Crée un nouvel élément personnalisé pour ton cabinet."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{labelLabel} *</Label>
              <Input
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder="Ex : Audit fiscal"
                disabled={busy}
              />
            </div>

            {!editing && (
              <div className="space-y-2">
                <Label>{codeLabel}</Label>
                <Input
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  placeholder="Ex : audit_fiscal (auto si vide)"
                  disabled={busy}
                />
                <p className="text-xs text-muted-foreground">
                  Identifiant technique. Laissé vide → généré automatiquement depuis le libellé.
                </p>
              </div>
            )}

            {withServiceFields && (
              <>
                <div className="space-y-2">
                  <Label>Prix par défaut (CHF, optionnel)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="Ex : 150.00"
                    disabled={busy}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description (optionnel)</Label>
                  <Input
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Note interne"
                    disabled={busy}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Ordre d'affichage</Label>
              <Input
                type="number"
                value={formSortOrder}
                onChange={(e) => setFormSortOrder(e.target.value)}
                disabled={busy}
              />
              <p className="text-xs text-muted-foreground">
                Plus la valeur est petite, plus l'élément apparaît tôt dans la liste.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={busy}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={busy || !formLabel.trim()}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {editing ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
