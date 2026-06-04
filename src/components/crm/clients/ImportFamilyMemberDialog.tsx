/**
 * ImportFamilyMemberDialog
 * ========================
 * Permet, depuis la fiche d'un client, de "lier" comme membre de la
 * famille un autre client/prospect qui existe DÉJÀ dans le portefeuille,
 * sans créer de doublon. Cas d'usage typique :
 *   - Le mari est client → on retrouve l'épouse déjà dans le portefeuille
 *     comme prospect → on l'importe comme conjointe
 *   - Le parent ouvre une fiche → on lie son enfant déjà fiché
 *
 * Recherche server-side via useClients (debounced 250 ms) → utilise les
 * indexes GIN trigram posés sur clients (commit b1b1d34) → résultat
 * instantané, plus de "canceling statement due to statement timeout".
 *
 * L'INSERT dans family_members passe par l'edge function bypass-insert
 * (RLS-safe).
 */
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, UserPlus, Loader2, CheckCircle2 } from "lucide-react";
import { useClients } from "@/hooks/useClients";
import { invokeSupabaseFunction } from "@/lib/edgeFunctions";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ImportFamilyMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** ID du client courant (celui dont on consulte la fiche) */
  currentClientId: string;
  /** Callback déclenché après import OK pour rafraîchir la liste */
  onImported?: () => void;
}

const RELATION_TYPES = [
  { value: "conjoint", label: "Conjoint(e) / Marié(e)" },
  { value: "concubin", label: "Concubin(e) / Partenariat" },
  { value: "enfant", label: "Enfant" },
  { value: "parent", label: "Parent" },
  { value: "frere_soeur", label: "Frère / Sœur" },
  { value: "grand_parent", label: "Grand-parent" },
  { value: "petit_enfant", label: "Petit-enfant" },
  { value: "oncle_tante", label: "Oncle / Tante" },
  { value: "cousin_cousine", label: "Cousin(e)" },
  { value: "autre", label: "Autre" },
];

export function ImportFamilyMemberDialog({
  open,
  onOpenChange,
  currentClientId,
  onImported,
}: ImportFamilyMemberDialogProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [relationType, setRelationType] = useState<string>("conjoint");
  const [submitting, setSubmitting] = useState(false);

  // Debounce 250 ms : pour ne pas spam la query à chaque touche.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  // useClients fait la recherche server-side (ILIKE sur first_name,
  // last_name, email, company_name, phone — indexes GIN trigram en place).
  const { clients, loading } = useClients("client", debouncedSearch);

  // On exclut le client courant des résultats (pas de self-lien).
  const filteredResults = useMemo(
    () => clients.filter((c) => c.id !== currentClientId),
    [clients, currentClientId],
  );

  const selectedClient = useMemo(
    () => filteredResults.find((c) => c.id === selectedClientId) ?? null,
    [filteredResults, selectedClientId],
  );

  const resetAndClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setSearch("");
      setDebouncedSearch("");
      setSelectedClientId(null);
      setRelationType("conjoint");
    }, 200);
  };

  const handleSubmit = async () => {
    if (!selectedClient || !currentClientId) return;
    setSubmitting(true);
    try {
      const payload = {
        client_id: currentClientId,
        linked_client_id: selectedClient.id,
        first_name: selectedClient.first_name ?? null,
        last_name: selectedClient.last_name ?? null,
        birth_date: (selectedClient as any).birthdate ?? null,
        relation_type: relationType,
        nationality: (selectedClient as any).nationality ?? null,
      };

      const result = await invokeSupabaseFunction<{ success: boolean; id: string }>(
        "bypass-insert",
        { body: { table: "family_members", payload } },
      );

      if (!result?.success) {
        throw new Error("Le lien n'a pas pu être créé");
      }

      toast({
        title: "Membre importé",
        description: `${selectedClient.first_name ?? ""} ${selectedClient.last_name ?? ""}`.trim()
          + ` lié(e) comme ${RELATION_TYPES.find((r) => r.value === relationType)?.label.toLowerCase()}.`,
      });

      onImported?.();
      resetAndClose();
    } catch (err: any) {
      console.error("[ImportFamilyMember] failed", err);
      toast({
        title: "Erreur",
        description: err?.message || "Impossible d'importer ce membre.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getDisplayName = (c: any) => {
    if (c.company_name) return c.company_name;
    return `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.email || "Sans nom";
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) v ? onOpenChange(true) : resetAndClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Importer une adresse existante
          </DialogTitle>
          <DialogDescription>
            Choisis un prospect ou un client déjà dans ton portefeuille pour le lier comme membre de la famille.
          </DialogDescription>
        </DialogHeader>

        {/* Barre de recherche */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Recherche par nom, prénom, email, société, téléphone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            disabled={submitting}
            autoFocus
          />
        </div>

        {/* Résultats */}
        <ScrollArea className="h-[260px] -mx-2 px-2 border rounded-lg">
          {!debouncedSearch ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-6 text-center">
              Tape au moins 2 caractères pour rechercher dans ton portefeuille.
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-6 text-center">
              Aucun résultat. Si la personne n'existe pas encore, utilise plutôt « Créer un membre de la famille ».
            </div>
          ) : (
            <div className="space-y-1.5 py-2">
              {filteredResults.map((c) => {
                const isActive = selectedClientId === c.id;
                const label = getDisplayName(c);
                const initials = label.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedClientId(c.id)}
                    disabled={submitting}
                    className={cn(
                      "flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left w-full",
                      isActive
                        ? "border-primary bg-primary/5"
                        : "border-transparent hover:border-border hover:bg-muted/40"
                    )}
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{label}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.email || c.phone || c.mobile || c.city || c.status}
                      </p>
                    </div>
                    {isActive && <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Type de relation */}
        {selectedClient && (
          <div className="space-y-2">
            <Label>Type de relation</Label>
            <Select value={relationType} onValueChange={setRelationType} disabled={submitting}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELATION_TYPES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose} disabled={submitting}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={!selectedClient || submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Import…
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" /> Importer ce membre
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
