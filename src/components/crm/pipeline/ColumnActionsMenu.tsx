/**
 * ColumnActionsMenu — Menu "..." sur le header d'une colonne Kanban.
 *
 * Affiche les templates d'actions/communications spécifiques au stage
 * de cette colonne. Au clic sur un template :
 *   1. Demande sur quelle carte appliquer (toutes / une spécifique)
 *   2. Crée une tâche (kind='task') liée à l'opportunité parent
 *   3. Préremplit titre/description avec les variables client
 *
 * MVP : actions = création de tâches. À enrichir plus tard avec
 * envoi email réel / SMS / scripts d'appel.
 */
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useUserTenant } from "@/hooks/useUserTenant";
import { supabase } from "@/integrations/supabase/client";
import { MoreHorizontal, Sparkles } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PIPELINE_ACTION_TEMPLATES,
  renderTemplate,
  type PipelineActionTemplate,
} from "./pipeline-action-templates";
import {
  PIPELINE_STAGE_LABELS,
  type PipelineStage,
  type Suivi,
} from "@/hooks/useSuivis";

interface ColumnActionsMenuProps {
  stage: PipelineStage;
  opportunities: Suivi[];
}

type ApplyTarget = "all" | "single";

export function ColumnActionsMenu({
  stage,
  opportunities,
}: ColumnActionsMenuProps) {
  const { toast } = useToast();
  const { tenantId } = useUserTenant();

  const [selectedTemplate, setSelectedTemplate] =
    useState<PipelineActionTemplate | null>(null);
  const [applyTarget, setApplyTarget] = useState<ApplyTarget>("single");
  const [selectedOppId, setSelectedOppId] = useState<string>("");
  const [applying, setApplying] = useState(false);

  const templates = PIPELINE_ACTION_TEMPLATES[stage] ?? [];

  const handleOpenTemplate = (tpl: PipelineActionTemplate) => {
    setSelectedTemplate(tpl);
    setApplyTarget(opportunities.length === 1 ? "single" : "single");
    setSelectedOppId(opportunities[0]?.id ?? "");
  };

  const handleClose = () => {
    setSelectedTemplate(null);
    setSelectedOppId("");
    setApplying(false);
  };

  const handleApply = async () => {
    if (!selectedTemplate || !tenantId) return;

    const targets: Suivi[] =
      applyTarget === "all"
        ? opportunities
        : opportunities.filter((o) => o.id === selectedOppId);

    if (targets.length === 0) {
      toast({
        title: "Aucune cible",
        description: "Sélectionne une carte ou choisis 'toutes les cartes'",
        variant: "destructive",
      });
      return;
    }

    setApplying(true);
    try {
      const rows = targets.map((opp) => {
        const vars = {
          first_name: opp.client?.first_name ?? "",
          last_name: opp.client?.last_name ?? "",
          company_name: opp.client?.company_name ?? "",
          expected_product: opp.expected_product ?? "",
          expected_company: opp.expected_company ?? "",
        };
        return {
          tenant_id: tenantId,
          client_id: opp.client_id,
          kind: "task" as const,
          status: "ouvert",
          priority: selectedTemplate.priority ?? "normal",
          title: renderTemplate(selectedTemplate.taskTitle, vars),
          description: renderTemplate(selectedTemplate.taskDescription, vars),
          parent_suivi_id: opp.id,        // ← lié à l'opportunité parent
          source: "trigger",
          // Garde l'agent de l'opp parent comme assigné par défaut
          assigned_agent_id: opp.assigned_agent_id,
        };
      });

      const { error } = await supabase.from("suivis").insert(rows);
      if (error) throw error;

      toast({
        title: "Action créée ✅",
        description: `"${selectedTemplate.label}" → ${targets.length} tâche${targets.length > 1 ? "s" : ""} créée${targets.length > 1 ? "s" : ""}`,
      });
      handleClose();
    } catch (err: any) {
      toast({
        title: "Erreur",
        description: err.message || "Impossible de créer les tâches",
        variant: "destructive",
      });
    } finally {
      setApplying(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="p-1 rounded hover:bg-white/40 transition-colors"
            aria-label={`Actions ${PIPELINE_STAGE_LABELS[stage]}`}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-64"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenuLabel className="text-xs flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Actions · {PIPELINE_STAGE_LABELS[stage]}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {templates.length === 0 ? (
            <DropdownMenuItem disabled className="text-xs text-muted-foreground italic">
              Aucun template pour ce stade
            </DropdownMenuItem>
          ) : (
            templates.map((tpl) => {
              const Icon = tpl.icon;
              return (
                <DropdownMenuItem
                  key={tpl.id}
                  onClick={() => handleOpenTemplate(tpl)}
                  className="cursor-pointer"
                >
                  <Icon className="h-3.5 w-3.5 mr-2 flex-shrink-0" />
                  <span className="text-sm">{tpl.label}</span>
                </DropdownMenuItem>
              );
            })
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Modale : appliquer le template */}
      <Dialog
        open={!!selectedTemplate}
        onOpenChange={(open) => !open && handleClose()}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTemplate && (
                <selectedTemplate.icon className="h-5 w-5" />
              )}
              {selectedTemplate?.label}
            </DialogTitle>
            <DialogDescription>
              Une tâche sera créée et liée à l'opportunité choisie.
            </DialogDescription>
          </DialogHeader>

          {selectedTemplate && (
            <div className="space-y-4 py-2">
              {/* Aperçu du template */}
              <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
                <p className="font-medium">{selectedTemplate.taskTitle}</p>
                <p className="text-muted-foreground text-xs whitespace-pre-wrap">
                  {selectedTemplate.taskDescription}
                </p>
              </div>

              {/* Choix cible */}
              {opportunities.length > 1 && (
                <div className="space-y-2">
                  <Label>Appliquer à</Label>
                  <RadioGroup
                    value={applyTarget}
                    onValueChange={(v) => setApplyTarget(v as ApplyTarget)}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="single" id="single" />
                      <Label htmlFor="single" className="font-normal cursor-pointer">
                        Une opportunité
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="all" id="all" />
                      <Label htmlFor="all" className="font-normal cursor-pointer">
                        Toutes les opportunités de cette colonne ({opportunities.length})
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {/* Select opp si "single" */}
              {applyTarget === "single" && (
                <div className="space-y-2">
                  <Label htmlFor="opp-select">Opportunité</Label>
                  <Select value={selectedOppId} onValueChange={setSelectedOppId}>
                    <SelectTrigger id="opp-select">
                      <SelectValue placeholder="Sélectionner une opportunité" />
                    </SelectTrigger>
                    <SelectContent>
                      {opportunities.map((opp) => {
                        const name =
                          opp.client?.company_name ||
                          `${opp.client?.first_name ?? ""} ${opp.client?.last_name ?? ""}`.trim() ||
                          "Sans nom";
                        const productPart = opp.expected_product
                          ? ` · ${opp.expected_product}`
                          : "";
                        return (
                          <SelectItem key={opp.id} value={opp.id}>
                            {name}
                            {productPart}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={applying}
            >
              Annuler
            </Button>
            <Button
              onClick={handleApply}
              disabled={
                applying ||
                (applyTarget === "single" && !selectedOppId) ||
                opportunities.length === 0
              }
            >
              {applying ? "Création..." : "Créer la tâche"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
