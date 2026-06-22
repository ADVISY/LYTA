/**
 * PipelineCard — Carte d'une opportunité dans le Kanban.
 *
 * Affiche : nom client/prospect, produit espéré, compagnie, agent assigné,
 * date pertinente (RDV ou dernière action), priorité visuelle.
 *
 * Click → ouvre la fiche client en gardant l'opp en contexte.
 */
import { Calendar, User, Building2, MoreVertical, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
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
  availableStages = [],
}: PipelineCardProps) {
  const clientName = formatClientName(opp);
  const agentName = opp.agent
    ? `${opp.agent.first_name ?? ""} ${opp.agent.last_name ?? ""}`.trim() || opp.agent.email
    : "Non assigné";

  const date = opp.reminder_date || opp.updated_at;
  const dateLabel = formatRelativeDate(date);

  return (
    <div
      className={cn(
        "group relative bg-card rounded-lg shadow-sm hover:shadow-md transition-shadow",
        "p-3 cursor-pointer select-none",
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
            {availableStages.length > 0 && (
              <>
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                  Déplacer vers
                </div>
                {availableStages.map((stage) => (
                  <DropdownMenuItem
                    key={stage}
                    onClick={() => onMoveStage?.(opp, stage)}
                  >
                    {PIPELINE_STAGE_LABELS[stage] ?? stage}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            )}
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
