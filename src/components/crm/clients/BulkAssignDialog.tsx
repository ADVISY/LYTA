/**
 * BulkAssignDialog
 * ================
 * Dialog d'attribution en masse de N fiches clients à un agent (ou
 * libération = passage à NULL).
 *
 * Utilisé depuis la liste Adresses (ClientsList) après sélection multi.
 * Le caller passe les IDs des fiches concernées et reçoit en callback
 * le nombre effectivement modifié.
 */
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search, UserMinus, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BulkAssignAgent {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  profession: string | null;
}

interface BulkAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  agents: BulkAssignAgent[];
  agentsLoading?: boolean;
  /** Confirmation : appelle bulkAssignClients(ids, agentId | null). */
  onConfirm: (agentId: string | null) => Promise<void> | void;
}

function agentLabel(a: BulkAssignAgent): string {
  const name = `${a.first_name || ""} ${a.last_name || ""}`.trim();
  return name || a.email || "Agent sans nom";
}

export function BulkAssignDialog({
  open,
  onOpenChange,
  selectedCount,
  agents,
  agentsLoading = false,
  onConfirm,
}: BulkAssignDialogProps) {
  const [search, setSearch] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState<string | "__unassign__" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const filteredAgents = useMemo(() => {
    if (!search.trim()) return agents;
    const s = search.toLowerCase();
    return agents.filter((a) =>
      agentLabel(a).toLowerCase().includes(s) ||
      (a.email || "").toLowerCase().includes(s) ||
      (a.profession || "").toLowerCase().includes(s)
    );
  }, [agents, search]);

  const handleSubmit = async () => {
    if (selectedAgentId == null) return;
    setSubmitting(true);
    try {
      await onConfirm(selectedAgentId === "__unassign__" ? null : selectedAgentId);
      onOpenChange(false);
      // Reset après fermeture
      setTimeout(() => {
        setSearch("");
        setSelectedAgentId(null);
      }, 200);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && onOpenChange(v)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            Assigner {selectedCount} fiche{selectedCount > 1 ? "s" : ""}
          </DialogTitle>
          <DialogDescription>
            Choisis un agent à qui attribuer les fiches sélectionnées, ou libère-les (sans agent).
          </DialogDescription>
        </DialogHeader>

        {/* Recherche */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un agent..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            disabled={submitting}
          />
        </div>

        {/* Option "libérer" en haut */}
        <button
          type="button"
          onClick={() => setSelectedAgentId("__unassign__")}
          disabled={submitting}
          className={cn(
            "flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left w-full",
            selectedAgentId === "__unassign__"
              ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30"
              : "border-border hover:border-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-950/20"
          )}
        >
          <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
            <UserMinus className="h-4 w-4 text-amber-700 dark:text-amber-300" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-sm">Libérer les fiches (sans agent)</p>
            <p className="text-xs text-muted-foreground">Utile pour redistribuer plus tard</p>
          </div>
        </button>

        {/* Liste des agents */}
        <ScrollArea className="h-[280px] -mx-2 px-2">
          {agentsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAgents.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">
              Aucun agent trouvé.
            </p>
          ) : (
            <div className="space-y-1.5">
              {filteredAgents.map((agent) => {
                const isActive = selectedAgentId === agent.id;
                const label = agentLabel(agent);
                const initials = label.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => setSelectedAgentId(agent.id)}
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
                        {agent.profession || agent.email || "—"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selectedAgentId == null || submitting}
            className={selectedAgentId === "__unassign__" ? "bg-amber-600 hover:bg-amber-700" : ""}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> En cours...
              </>
            ) : selectedAgentId === "__unassign__" ? (
              <>
                <UserMinus className="h-4 w-4 mr-2" /> Libérer {selectedCount} fiche{selectedCount > 1 ? "s" : ""}
              </>
            ) : (
              <>
                <UserCheck className="h-4 w-4 mr-2" /> Assigner {selectedCount} fiche{selectedCount > 1 ? "s" : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
