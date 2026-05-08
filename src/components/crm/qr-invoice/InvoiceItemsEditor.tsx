import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Receipt } from "lucide-react";
import { useTenantBillableServices } from "@/hooks/useTenantLookups";
import { cn } from "@/lib/utils";

export interface InvoiceItemDraft {
  /** UUID stable for React keys (not persisted as-is) */
  uid: string;
  /** Optional reference to a tenant_billable_services row */
  service_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
}

interface InvoiceItemsEditorProps {
  items: InvoiceItemDraft[];
  onChange: (items: InvoiceItemDraft[]) => void;
}

const NEW_LINE = (): InvoiceItemDraft => ({
  uid: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
  service_id: null,
  description: "",
  quantity: 1,
  unit_price: 0,
});

export function InvoiceItemsEditor({ items, onChange }: InvoiceItemsEditorProps) {
  const { rows: services } = useTenantBillableServices();

  // Ensure at least one row is always present so the user has somewhere to type
  useEffect(() => {
    if (items.length === 0) {
      onChange([NEW_LINE()]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateItem = (uid: string, patch: Partial<InvoiceItemDraft>) => {
    onChange(items.map((it) => (it.uid === uid ? { ...it, ...patch } : it)));
  };

  const handleServicePick = (uid: string, serviceCode: string) => {
    if (serviceCode === "_custom") {
      updateItem(uid, { service_id: null });
      return;
    }
    const svc = services.find((s) => s.code === serviceCode);
    if (!svc) return;
    updateItem(uid, {
      service_id: svc.tenant_id ? svc.id : null, // only persist FK for tenant rows; system rows = null FK
      description: svc.label,
      unit_price: svc.default_amount ?? 0,
    });
  };

  const removeItem = (uid: string) => {
    if (items.length === 1) {
      // Reset to an empty line instead of leaving zero
      onChange([NEW_LINE()]);
    } else {
      onChange(items.filter((it) => it.uid !== uid));
    }
  };

  const addItem = () => {
    onChange([...items, NEW_LINE()]);
  };

  const subtotalHT = items.reduce((sum, it) => sum + (it.quantity || 0) * (it.unit_price || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold flex items-center gap-2">
          <Receipt className="h-4 w-4 text-primary" />
          Lignes de facturation
        </Label>
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          <Plus className="h-4 w-4 mr-2" />
          Ajouter une ligne
        </Button>
      </div>

      <div className="space-y-2">
        {/* Headers */}
        <div className="hidden md:grid grid-cols-12 gap-2 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <div className="col-span-6">Description</div>
          <div className="col-span-2 text-right">Quantité</div>
          <div className="col-span-2 text-right">Prix unitaire (CHF)</div>
          <div className="col-span-1 text-right">Total</div>
          <div className="col-span-1"></div>
        </div>

        {/* Lines */}
        {items.map((item, idx) => {
          const lineTotal = (item.quantity || 0) * (item.unit_price || 0);
          return (
            <div
              key={item.uid}
              className={cn(
                "grid grid-cols-1 md:grid-cols-12 gap-2 p-3 rounded-lg border bg-card",
                idx % 2 === 1 && "bg-muted/30"
              )}
            >
              <div className="col-span-12 md:col-span-6 space-y-1">
                <Label className="md:hidden text-xs">Description</Label>
                <Select
                  value={item.description && services.some((s) => s.label === item.description) ? services.find((s) => s.label === item.description)!.code : "_custom"}
                  onValueChange={(v) => handleServicePick(item.uid, v)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Sélectionner un service…" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((s) => (
                      <SelectItem key={s.id} value={s.code}>
                        {s.label}
                        {s.default_amount != null && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({s.default_amount} CHF)
                          </span>
                        )}
                      </SelectItem>
                    ))}
                    <SelectItem value="_custom">— Description libre —</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={item.description}
                  onChange={(e) => updateItem(item.uid, { description: e.target.value })}
                  placeholder="Description de la prestation"
                />
              </div>
              <div className="col-span-6 md:col-span-2 space-y-1">
                <Label className="md:hidden text-xs">Quantité</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={item.quantity}
                  onChange={(e) => updateItem(item.uid, { quantity: parseFloat(e.target.value) || 0 })}
                  className="text-right"
                />
              </div>
              <div className="col-span-6 md:col-span-2 space-y-1">
                <Label className="md:hidden text-xs">Prix unitaire</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={item.unit_price}
                  onChange={(e) => updateItem(item.uid, { unit_price: parseFloat(e.target.value) || 0 })}
                  className="text-right"
                />
              </div>
              <div className="col-span-10 md:col-span-1 flex items-end">
                <span className="font-medium text-sm tabular-nums w-full text-right">
                  {lineTotal.toLocaleString("fr-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="col-span-2 md:col-span-1 flex items-end justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => removeItem(item.uid)}
                  title="Supprimer la ligne"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}

        {/* Subtotal */}
        <div className="flex justify-end pr-12 pt-2 border-t">
          <div className="text-sm">
            <span className="text-muted-foreground mr-3">Sous-total HT :</span>
            <span className="font-bold text-base tabular-nums">
              {subtotalHT.toLocaleString("fr-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Returns the HT amount calculated from items */
export function sumItemsHT(items: InvoiceItemDraft[]): number {
  return items.reduce((sum, it) => sum + (it.quantity || 0) * (it.unit_price || 0), 0);
}
