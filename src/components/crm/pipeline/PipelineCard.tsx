/**
 * PipelineCard — Carte d'une opportunité dans le Kanban.
 *
 * Affiche : nom client/prospect, produit espéré, compagnie, agent assigné,
 * date pertinente (RDV ou dernière action), priorité visuelle.
 *
 * Interactions :
 *   - Click → ouvre la modale détail
 *   - Drag → glisse vers une autre colonne pour changer de stage
 *   - Menu ⋮ → actions contextuelles selon le stage actuel
 *     (Modifier RDV, Saisir commission, Marquer perdue…)
 */
import { useState } from "react";
import {
  Calendar,
  User,
  Building2,
  MoreVertical,
  X,
  Edit3,
  DollarSign,
  FileSignature,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  PIPELINE_STAGE_LABELS,
  type Suivi,
  type PipelineStage,
} from "@/hooks/useSuivis";

interface PipelineCardProps {
  opportunity: Suivi;
  onOpen?: (opp: Suivi) => void;
  onMoveStage?: (opp: Suivi, newStage: PipelineStage) => void;
  onMarkLost?: (opp: Suivi) => void;
  onEditRdv?: (opp: Suivi) => void;
  availableStages?: PipelineStage[];
}

const PRIORITY_INDICATOR: Record<string, string> = {
  urgent: "border-l-4 border-l-red-500",
  high: "border-l-4 border-l-orange-500",
  normal: "border-l-4 border-l-slate-300",
  low: "border-l-4 border-l-slate-200",
};

function formatClientName(suivi: Suivi): string {
  const c = suivi.client;
  if (!c) return "Client inconnu";
  if (c.company_name) return c.company_name;
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || "Sans nom";
}

function formatRelativeDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Demain";
  if (diffDays === -1) return "Hier";
  if (diffDays > 0 && diffDays <= 7) return `Dans ${diffDays}j`;
  if (diffDays < 0 && diffDays >= -7) return `Il y a ${Math.abs(diffDays)}j`;
  return d.toLocaleDateString("fr-CH", { day: "2-digit", month: "short" });
}

export function PipelineCard({
  opportunity: opp,
  onOpen,
  onMoveStage,
  onMarkLost,
  onEditRdv,
  availableStages = [],
}: PipelineCardProps) {
  const [isDragging, setIsDragging] = useState(false);

  const clientName = formatClientName(opp);
  const agentName = opp.agent
    ? `${opp.agent.first_name ?? ""} ${opp.agent.last_name ?? ""}`.trim() || opp.agent.email
    : "Non assigné";

  const date = opp.reminder_date || opp.updated_at;
  const dateLabel = formatRelativeDate(date);

  // HTML5 drag & drop : on stocke l'ID de l'opp dans dataTransfer
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/x-pipeline-card", opp.id);
    e.dataTransfer.effectAllowed = "move";
    setIsDragging(true);
  };
  const handleDragEnd = () => {
    setIsDragging(false);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={cn(
        "group relative bg-card rounded-lg shadow-sm hover:shadow-md transition-all",
        "p-3 cursor-grab active:cursor-grabbing select-none",
        isDragging && "opacity-40 scale-95",
        PRIORITY_INDICATOR[opp.priority ?? "normal"]
      )}
      onClick={() => onOpen?.(opp)}
    >
      {/* En-tête : nom + menu */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-medium text-sm leading-tight line-clamp-2 flex-1 min-w-0">
          {clientName}
        </h4>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 -m-1 rounded hover:bg-muted"
              aria-label="Actions"
            >
              <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuLabel className="text-xs">
              Modifier · {PIPELINE_STAGE_LABELS[opp.pipeline_stage as PipelineStage] ?? "Opportunité"}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {/* Actions contextuelles selon le stage actuel */}
            {opp.pipeline_stage === "prospect" && onEditRdv && (
              <DropdownMenuItem onClick={() => onEditRdv(opp)}>
                <Calendar className="h-3.5 w-3.5 mr-2" />
                Fixer un rendez-vous
              </DropdownMenuItem>
            )}

            {opp.pipeline_stage === "rdv_fixe" && onEditRdv && (
              <DropdownMenuItem onClick={() => onEditRdv(opp)}>
                <Edit3 className="h-3.5 w-3.5 mr-2" />
                Modifier le RDV
              </DropdownMenuItem>
            )}

            {opp.pipeline_stage === "rdv_passe" && (
              <DropdownMenuItem onClick={() => onOpen?.(opp)}>
                <Edit3 className="h-3.5 w-3.5 mr-2" />
                Ajouter notes du RDV
              </DropdownMenuItem>
            )}

            {opp.pipeline_stage === "signe" && (
              <DropdownMenuItem onClick={() => onOpen?.(opp)}>
                <FileSignature className="h-3.5 w-3.5 mr-2" />
                Voir checklist backoffice
              </DropdownMenuItem>
            )}

            {opp.pipeline_stage === "attente_contrat" && (
              <DropdownMenuItem onClick={() => onOpen?.(opp)}>
                <Edit3 className="h-3.5 w-3.5 mr-2" />
                Modifier compagnie
              </DropdownMenuItem>
            )}

            {opp.pipeline_stage === "contrat_recu" && (
              <DropdownMenuItem onClick={() => onOpen?.(opp)}>
                <FileSignature className="h-3.5 w-3.5 mr-2" />
                Lier au contrat
              </DropdownMenuItem>
            )}

            {opp.pipeline_stage === "contrat_police" && (
              <DropdownMenuItem onClick={() => onOpen?.(opp)}>
                <DollarSign className="h-3.5 w-3.5 mr-2" />
                Saisir commission
              </DropdownMenuItem>
            )}

            {/* Action universelle : modifier les infos */}
            <DropdownMenuItem onClick={() => onOpen?.(opp)}>
              <Edit3 className="h-3.5 w-3.5 mr-2" />
              Voir détails complets
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="text-red-600 focus:text-red-600"
              onClick={() => onMarkLost?.(opp)}
            >
              <X className="h-3.5 w-3.5 mr-2" />
              Marquer perdue
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Produit + compagnie */}
      {(opp.expected_product || opp.expected_company) && (
        <div className="flex flex-wrap gap-1 mb-2">
          {opp.expected_product && (
            <Badge variant="outline" className="text-xs font-normal py-0 px-1.5 h-5">
              {opp.expected_product}
            </Badge>
          )}
          {opp.expected_company && (
            <Badge variant="outline" className="text-xs font-normal py-0 px-1.5 h-5">
              <Building2 className="h-3 w-3 mr-1" />
              {opp.expected_company}
            </Badge>
          )}
        </div>
      )}

      {/* Pied : agent + date */}
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1 min-w-0 truncate">
          <User className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{agentName}</span>
        </div>
        {dateLabel && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <Calendar className="h-3 w-3" />
            <span>{dateLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
}
