/**
 * PipelineKanban — Vue Kanban des opportunités commerciales.
 *
 * Colonnes = stages du cycle de vie (Prospect → Commission reçue).
 * Cards = opportunités (suivis avec kind='pipeline_card').
 *
 * MVP : pas de drag&drop, juste affichage groupé + menu "Déplacer vers".
 * Drag&drop avec dnd-kit prévu en V2.
 */
import { useState } from "react";
import { Loader2, MoreHorizontal } from "lucide-react";
import { PipelineCard } from "./PipelineCard";
import { ColumnActionsMenu } from "./ColumnActionsMenu";
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
  onEditRdv?: (opp: Suivi) => void;
  className?: string;
}

export function PipelineKanban({
  filters,
  onOpenOpportunity,
  onMoveStage,
  onMarkLost,
  onEditRdv,
  className,
}: PipelineKanbanProps) {
  const { stages, totalCount, loading } = usePipeline(filters);

  // Map global id → opp pour résoudre le drag&drop facilement
  const allOpps = Object.values(stages).flat() as Suivi[];
  const handleDrop = (oppId: string, targetStage: PipelineStage) => {
    const opp = allOpps.find((o) => o.id === oppId);
    if (!opp) return;
    if (opp.pipeline_stage === targetStage) return; // no-op si même colonne
    onMoveStage?.(opp, targetStage);
  };

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
            onEditRdv={onEditRdv}
            onDrop={(oppId) => handleDrop(oppId, stage)}
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
  onEditRdv?: (opp: Suivi) => void;
  onDrop?: (oppId: string) => void;
}

function KanbanColumn({
  stage,
  opportunities,
  onOpen,
  onMoveStage,
  onMarkLost,
  onEditRdv,
  onDrop,
}: KanbanColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const label = PIPELINE_STAGE_LABELS[stage];
  const colorClass = PIPELINE_STAGE_COLORS[stage];

  // Drop zone : la colonne accepte le drop d'une PipelineCard
  const handleDragOver = (e: React.DragEvent) => {
    // Vérifie qu'on drague bien une pipeline card (pas autre chose)
    if (e.dataTransfer.types.includes("application/x-pipeline-card")) {
      e.preventDefault(); // ← nécessaire pour autoriser le drop
      e.dataTransfer.dropEffect = "move";
      if (!isDragOver) setIsDragOver(true);
    }
  };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const oppId = e.dataTransfer.getData("application/x-pipeline-card");
    if (oppId) onDrop?.(oppId);
  };

  return (
    <div className="flex flex-col w-64 flex-shrink-0">
      {/* En-tête colonne */}
      <div
        className={cn(
          "rounded-t-lg px-3 py-2 border-t border-l border-r",
          colorClass
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-sm flex-1 truncate">{label}</h3>
          <span className="text-xs bg-white/60 px-2 py-0.5 rounded-full font-medium">
            {opportunities.length}
          </span>
          {/* Menu "..." de la colonne — actions/templates pour ce stade */}
          <ColumnActionsMenu
            stage={stage}
            opportunities={opportunities}
          />
        </div>
      </div>

      {/* Body colonne (zone de drop) */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "flex-1 rounded-b-lg border-l border-r border-b min-h-[500px] p-2 space-y-2 transition-colors",
          isDragOver
            ? "bg-primary/10 border-primary border-dashed"
            : "bg-muted/30"
        )}
      >
        {opportunities.length === 0 ? (
          <div className="text-xs text-muted-foreground/60 text-center py-8">
            {isDragOver ? "Relâche pour déplacer ici" : "Aucune carte"}
          </div>
        ) : (
          opportunities.map((opp) => (
            <PipelineCard
              key={opp.id}
              opportunity={opp}
              onOpen={onOpen}
              onMoveStage={onMoveStage}
              onMarkLost={onMarkLost}
              onEditRdv={onEditRdv}
            />
          ))
        )}
      </div>
    </div>
  );
}
