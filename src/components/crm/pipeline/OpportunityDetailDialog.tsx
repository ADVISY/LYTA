/**
 * OpportunityDetailDialog — Vue détaillée d'une opportunité.
 *
 * S'ouvre au click sur une PipelineCard. Affiche toutes les infos :
 *   - Client (lien vers fiche)
 *   - Produit + compagnie
 *   - Stage actuel (badge couleur)
 *   - Détails RDV si applicable (date, heure, durée)
 *   - Agent assigné
 *   - Notes
 *   - Dates création + dernière maj
 *
 * Actions disponibles :
 *   - Re-générer le lien Google Agenda (pour RDV)
 *   - Naviguer vers la fiche client
 *   - Changer le stage (dropdown)
 *   - Marquer perdue
 */
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Clock,
  User,
  Building2,
  Package,
  FileText,
  ExternalLink,
  X,
  ArrowRight,
} from "lucide-react";
import {
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGE_COLORS,
  type Suivi,
  type PipelineStage,
} from "@/hooks/useSuivis";
import { cn } from "@/lib/utils";

interface OpportunityDetailDialogProps {
  opportunity: Suivi | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMoveStage?: (opp: Suivi, newStage: PipelineStage) => void;
  onMarkLost?: (opp: Suivi) => void;
}

function formatClientName(suivi: Suivi): string {
  const c = suivi.client;
  if (!c) return "Client inconnu";
  if (c.company_name) return c.company_name;
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || "Sans nom";
}

function formatAgentName(suivi: Suivi): string {
  if (!suivi.agent) return "Non assigné";
  const a = suivi.agent;
  const fullName = [a.first_name, a.last_name].filter(Boolean).join(" ");
  return fullName || a.email;
}

function formatDateLong(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-CH", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("fr-CH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Demain";
  if (diffDays === -1) return "Hier";
  if (diffDays > 0) return `Dans ${diffDays} jours`;
  return `Il y a ${Math.abs(diffDays)} jours`;
}

function buildGoogleCalendarUrl(opp: Suivi): string | null {
  if (!opp.reminder_date) return null;
  const title = opp.title || "Rendez-vous LYTA";
  const description = opp.description || "Opportunité LYTA";
  const start = new Date(opp.reminder_date);
  // Durée par défaut 30 min (on ne stocke pas la durée actuellement, à étendre)
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const fmt = (d: Date): string =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    details: description,
    dates: `${fmt(start)}/${fmt(end)}`,
  });
  return `https://calendar.google.com/calendar/u/0/r/eventedit?${params.toString()}`;
}

export function OpportunityDetailDialog({
  opportunity,
  open,
  onOpenChange,
  onMoveStage,
  onMarkLost,
}: OpportunityDetailDialogProps) {
  const navigate = useNavigate();

  if (!opportunity) return null;

  const clientName = formatClientName(opportunity);
  const agentName = formatAgentName(opportunity);
  const stage = (opportunity.pipeline_stage as PipelineStage) || "prospect";
  const stageLabel = PIPELINE_STAGE_LABELS[stage];
  const stageColor = PIPELINE_STAGE_COLORS[stage];

  const hasRdv = stage === "rdv_fixe" && opportunity.reminder_date;
  const gcalUrl = hasRdv ? buildGoogleCalendarUrl(opportunity) : null;

  const handleGoToClient = () => {
    onOpenChange(false);
    navigate(`/crm/clients/${opportunity.client_id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg leading-tight break-words">
                {opportunity.title}
              </DialogTitle>
              <DialogDescription className="mt-1">
                Opportunité commerciale
              </DialogDescription>
            </div>
            <Badge
              className={cn("flex-shrink-0 border", stageColor)}
              variant="outline"
            >
              {stageLabel}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Bloc Client */}
          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Client
              </h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGoToClient}
                className="h-7 text-xs"
              >
                Voir fiche
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{clientName}</span>
            </div>
          </div>

          {/* Bloc Produit/Compagnie */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border bg-card p-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Produit
              </h4>
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {opportunity.expected_product || "—"}
                </span>
              </div>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Compagnie
              </h4>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {opportunity.expected_company || "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Bloc RDV (si applicable) */}
          {hasRdv && (
            <div className="rounded-lg border border-violet-200 bg-violet-50 dark:bg-violet-950/20 dark:border-violet-800 p-3">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Rendez-vous
                </h4>
                <Badge variant="outline" className="text-xs bg-violet-100 text-violet-700 border-violet-300">
                  {formatRelative(opportunity.reminder_date)}
                </Badge>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-violet-600" />
                  <span className="font-medium capitalize">
                    {formatDateLong(opportunity.reminder_date)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-violet-600" />
                  <span className="font-medium">
                    {formatTime(opportunity.reminder_date)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    (heure suisse)
                  </span>
                </div>
              </div>

              {gcalUrl && (
                <Button
                  asChild
                  size="sm"
                  className="w-full mt-3"
                  variant="default"
                >
                  <a
                    href={gcalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Ajouter à Google Agenda
                    <ExternalLink className="h-3 w-3 ml-2" />
                  </a>
                </Button>
              )}
            </div>
          )}

          {/* Bloc Agent */}
          <div className="rounded-lg border bg-card p-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Agent assigné
            </h4>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{agentName}</span>
            </div>
          </div>

          {/* Notes */}
          {opportunity.description && (
            <div className="rounded-lg border bg-card p-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Notes
              </h4>
              <p className="text-sm whitespace-pre-wrap break-words">
                {opportunity.description}
              </p>
            </div>
          )}

          {/* Métadonnées */}
          <div className="text-xs text-muted-foreground space-y-0.5 pt-2 border-t">
            <div>
              Créée le{" "}
              <span className="font-medium">
                {formatDateLong(opportunity.created_at)}
              </span>
            </div>
            {opportunity.updated_at !== opportunity.created_at && (
              <div>
                Dernière modif :{" "}
                <span className="font-medium">
                  {formatDateLong(opportunity.updated_at)} à{" "}
                  {formatTime(opportunity.updated_at)}
                </span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              onOpenChange(false);
              onMarkLost?.(opportunity);
            }}
          >
            <X className="h-4 w-4 mr-1" />
            Marquer perdue
          </Button>
          <Button onClick={handleGoToClient}>
            Voir fiche client
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
