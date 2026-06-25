/**
 * DuplicateDocumentDialog — Duplique un document vers un autre client.
 *
 * Cas d'usage : un membre d'une même famille a besoin du même PDF (ex.
 * passeport copié vers le conjoint), ou un courtier veut attacher un doc
 * partagé (devis envoyé à plusieurs prospects) à plusieurs fiches sans
 * re-uploader.
 *
 * Workflow :
 *   1. Le courtier choisit un client cible via combobox (search ilike).
 *   2. On copie le fichier dans Supabase Storage : `supabase.storage.copy()`
 *      crée une copie physique sous une nouvelle clé `client-{newClientId}/`
 *      pour ne pas mélanger les ACL (chaque client = sa propre arbo).
 *   3. On insère un nouveau row dans `documents` (même tenant_id, owner_id =
 *      newClientId, même doc_kind, copie des champs utiles).
 *
 * Décision : on ne crée PAS un alias / une référence partagée. C'est une
 * vraie copie physique. Pourquoi : si le doc source est supprimé plus tard,
 * la copie cible doit survivre. Et on évite la complexité des références
 * croisées (qui possède le fichier ? quel ACL ?).
 *
 * Limitation : si le fichier est très lourd, la copie peut prendre quelques
 * secondes. On affiche un spinner et on désactive le bouton pendant l'op.
 */
import { useState, useMemo, useEffect } from "react";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Loader2, Copy, Check, User } from "lucide-react";

interface ClientLite {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
}

export interface DuplicateDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: {
    id: string;
    file_key: string;
    file_name: string;
    mime_type?: string | null;
    doc_kind?: string | null;
    tenant_id?: string | null;
  } | null;
  /** Tenant courant — restreint la liste de clients sélectionnables. */
  tenantId: string | null;
  /** Client source — exclu de la liste pour éviter une self-duplicate. */
  sourceClientId: string;
  onDuplicated?: () => void;
}

function clientLabel(c: ClientLite): string {
  if (c.company_name) return c.company_name;
  const name = `${c.first_name || ""} ${c.last_name || ""}`.trim();
  return name || c.email || "Sans nom";
}

export function DuplicateDocumentDialog({
  open,
  onOpenChange,
  document: doc,
  tenantId,
  sourceClientId,
  onDuplicated,
}: DuplicateDocumentDialogProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);

  // Charge les clients du tenant à l'ouverture (limit 50 pour ne pas exploser)
  useEffect(() => {
    if (!open || !tenantId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        let query = supabase
          .from("clients")
          .select("id, first_name, last_name, company_name, email")
          .eq("tenant_id", tenantId)
          .neq("id", sourceClientId)
          .order("updated_at", { ascending: false })
          .limit(50);

        // Filtre serveur si search > 1 char
        if (search.trim().length > 1) {
          const pattern = `%${search.trim()}%`;
          query = query.or(
            `first_name.ilike.${pattern},last_name.ilike.${pattern},company_name.ilike.${pattern},email.ilike.${pattern}`
          );
        }

        const { data, error } = await query;
        if (cancelled) return;
        if (error) throw error;
        setClients((data || []) as ClientLite[]);
      } catch (err) {
        if (cancelled) return;
        console.error("[DuplicateDocumentDialog] load clients failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, tenantId, sourceClientId, search]);

  useEffect(() => {
    if (!open) {
      // Reset après fermeture
      setSearch("");
      setSelectedClientId(null);
    }
  }, [open]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  const handleDuplicate = async () => {
    if (!doc || !selectedClientId || !tenantId) return;
    setDuplicating(true);
    try {
      // 1. Génère une nouvelle clé storage sous l'arbo du client cible
      const ext = doc.file_key.split(".").pop() || "bin";
      const newKey = `client-docs/${selectedClientId}/${Date.now()}-copy.${ext}`;

      // 2. Copie le fichier dans le bucket `documents`
      const { error: copyErr } = await supabase.storage
        .from("documents")
        .copy(doc.file_key, newKey);
      if (copyErr) throw copyErr;

      // 3. Récupère l'utilisateur courant pour `created_by`
      const { data: { user } } = await supabase.auth.getUser();

      // 4. Insert le nouveau row documents
      const { error: insErr } = await supabase.from("documents").insert({
        tenant_id: tenantId,
        owner_type: "client",
        owner_id: selectedClientId,
        file_key: newKey,
        file_name: doc.file_name,
        mime_type: doc.mime_type,
        doc_kind: doc.doc_kind || "autre",
        created_by: user?.id,
        metadata: {
          duplicated_from_document_id: doc.id,
          duplicated_from_client_id: sourceClientId,
          duplicated_at: new Date().toISOString(),
        },
      });
      if (insErr) {
        // Rollback : on supprime la copie physique pour ne pas laisser un orphan
        await supabase.storage.from("documents").remove([newKey]);
        throw insErr;
      }

      toast({
        title: "Document dupliqué",
        description: selectedClient
          ? `Copié vers ${clientLabel(selectedClient)}`
          : "Copie créée",
      });
      onDuplicated?.();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Erreur de duplication",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setDuplicating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-4 w-4" />
            Dupliquer vers un autre client
          </DialogTitle>
          <DialogDescription>
            {doc?.file_name
              ? `Une copie de "${doc.file_name}" sera attachée au client choisi.`
              : "Choisis le client cible pour la copie."}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <Command shouldFilter={false} className="border rounded-md">
            <CommandInput
              placeholder="Rechercher un client (nom, email, entreprise)…"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="max-h-60">
              {loading && (
                <div className="flex items-center justify-center py-6 text-sm text-muted-foreground gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Chargement…
                </div>
              )}
              {!loading && clients.length === 0 && (
                <CommandEmpty>Aucun client trouvé.</CommandEmpty>
              )}
              {!loading && clients.length > 0 && (
                <CommandGroup>
                  {clients.map((c) => {
                    const isSelected = c.id === selectedClientId;
                    return (
                      <CommandItem
                        key={c.id}
                        value={c.id}
                        onSelect={() => setSelectedClientId(c.id)}
                        className="cursor-pointer"
                      >
                        <User className="h-4 w-4 mr-2 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="truncate">{clientLabel(c)}</p>
                          {c.email && (
                            <p className="text-xs text-muted-foreground truncate">
                              {c.email}
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <Check className="h-4 w-4 text-primary ml-2" />
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={duplicating}
          >
            Annuler
          </Button>
          <Button
            onClick={handleDuplicate}
            disabled={!selectedClientId || duplicating || !doc}
          >
            {duplicating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Duplication…
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Dupliquer
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
