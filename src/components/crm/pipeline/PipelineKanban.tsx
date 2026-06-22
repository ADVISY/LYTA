/**
 * PipelineKanban — Vue Kanban des opportunités commerciales.
 *
 * Colonnes = stages du cycle de vie (Prospect → Commission reçue).
 * Cards = opportunités (suivis avec kind='pipeline_card').
 *
 * MVP : pas de drag&drop, juste affichage groupé + menu "Déplacer vers".
 * Drag&drop avec dnd-kit prévu en V2.
 */
import { Loader2 } from "lucide-react";
import { PipelineCard } from "./PipelineCard";
import {
  usePipeline,
  PIPELINE_STAGES,
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGE_COLORS,
  type PipelineFilters,
  type PipelineStage,
  type Suivi,
} from "@/hooks/useSuivis";
import { cn } from "@/lib/utils";

interface PipelineKanbanProps {
  filters?: PipelineFilters;
  onOpenOpportunity?: (opp: Suivi) => void;
  onMoveStage?: (opp: Suivi, newStage: PipelineStage) => void;
  onMarkLost?: (opp: Suivi) => void;
  className?: string;
}

export function PipelineKanban({
  filters,
  onOpenOpportunity,
  onMoveStage,
  onMarkLost,
  className,
}: PipelineKanbanProps) {
  const { stages, totalCount, loading } = usePipeline(filters);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
        Chargement du pipeline...
      </div>
    );
  }

  if (totalCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <p className="text-lg font-medium mb-2">Aucune opportunité active</p>
        <p className="text-sm max-w-md">
          Créez une opportunité depuis une fiche client ou planifiez un RDV pour
          voir vos premières cartes apparaître.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("w-full overflow-x-auto pb-4", className)}>
      <div className="inline-flex gap-3 min-w-full">
        {PIPELINE_STAGES.map((stage) => (
          <KanbanColumn
            key={stage}
            stage={stage}
            opportunities={stages[stage] ?? []}
            onOpen={onOpenOpportunity}
            onMoveStage={onMoveStage}
            onMarkLost={onMarkLost}
          />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// KanbanColumn — Une colonne du pipeline pour un stage
// ═══════════════════════════════════════════════════════════════════════════

interface KanbanColumnProps {
  stage: PipelineStage;
  opportunities: Suivi[];
  onOpen?: (opp: Suivi) => void;
  onMoveStage?: (opp: Suivi, newStage: PipelineStage) => void;
  onMarkLost?: (opp: Suivi) => void;
}

function KanbanColumn({
  stage,
  opportunities,
  onOpen,
  onMoveStage,
  onMarkLost,
}: KanbanColumnProps) {
  const label = PIPELINE_STAGE_LABELS[stage];
  const colorClass = PIPELINE_STAGE_COLORS[stage];

  // Liste des stages possibles vers lesquels on peut déplacer
  const availableStages = PIPELINE_STAGES.filter((s) => s !== stage);

  return (
    <div className="flex flex-col w-64 flex-shrink-0">
      {/* En-tête colonne */}
      <div
        className={cn(
          "rounded-t-lg px-3 py-2 border-t border-l border-r",
          colorClass
        )}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">{label}</h3>
          <span className="text-xs bg-white/60 px-2 py-0.5 rounded-full font-medium">
            {opportunities.length}
          </span>
        </div>
      </div>

      {/* Body colonne */}
      <div
        className={cn(
          "flex-1 rounded-b-lg border-l border-r border-b min-h-[500px] p-2 space-y-2",
          "bg-muted/30"
        )}
      >
        {opportunities.length === 0 ? (
          <div className="text-xs text-muted-foreground/60 text-center py-8">
            Aucune carte
          </div>
        ) : (
          opportunities.map((opp) => (
            <PipelineCard
              key={opp.id}
              opportunity={opp}
              onOpen={onOpen}
              onMoveStage={onMoveStage}
              onMarkLost={onMarkLost}
              availableStages={availableStages}
            />
          ))
        )}
      </div>
    </div>
  );
}
