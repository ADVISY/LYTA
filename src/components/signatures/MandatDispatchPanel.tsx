/**
 * MandatDispatchPanel
 * --------------------
 * Renders inline below a SIGNED mandat de gestion entry. Lets the broker:
 *   - See the per-company dispatch status (✅ sent / ⚠️ no email / ❌ failed)
 *   - Trigger the dispatch Edge Function (manual button — by product design)
 *   - Re-trigger to retry failed rows (idempotent)
 *   - Mark a manual_required row as "manual_done" once handled offline
 *
 * Designed to slot into PendingSignaturesPanel where the existing
 * "Document archivé" badge sits for signed signature_requests.
 */
import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AlertTriangle,
  Building2,
  Check,
  Loader2,
  Mail,
  RefreshCw,
  Send,
  X,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useMandatDispatch } from "@/hooks/useMandatDispatch";

interface MandatDispatchPanelProps {
  signatureRequestId: string;
}

const STATUS_VISUAL: Record<
  string,
  { label: string; className: string; icon: React.ReactNode }
> = {
  sent: {
    label: "Envoyé",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200",
    icon: <Check className="h-3 w-3" />,
  },
  failed: {
    label: "Échec",
    className: "bg-red-100 text-red-800 border-red-200",
    icon: <X className="h-3 w-3" />,
  },
  manual_required: {
    label: "Email manquant",
    className: "bg-amber-100 text-amber-800 border-amber-200",
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  manual_done: {
    label: "Envoyé manuellement",
    className: "bg-sky-100 text-sky-800 border-sky-200",
    icon: <Check className="h-3 w-3" />,
  },
  pending: {
    label: "En cours",
    className: "bg-slate-100 text-slate-700 border-slate-200",
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
  },
};

export function MandatDispatchPanel({ signatureRequestId }: MandatDispatchPanelProps) {
  const {
    logs,
    summary,
    loading,
    dispatching,
    dispatchToCompanies,
    markManualDone,
  } = useMandatDispatch(signatureRequestId);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Has at least one log row → we've already attempted dispatch once.
  const hasLogs = logs.length > 0;
  // Anything still actionable that a re-dispatch would help with.
  const needsRetry = summary.failed > 0;

  const fmt = (d: string) =>
    format(new Date(d), "dd MMM yyyy 'à' HH:mm", { locale: fr });

  const handleDispatchClick = () => setConfirmOpen(true);

  const handleConfirmDispatch = async () => {
    setConfirmOpen(false);
    await dispatchToCompanies();
    // Auto-expand the details after first dispatch so the broker can
    // see the per-company outcome immediately.
    setExpanded(true);
  };

  // Compact summary line shown next to the button.
  const summaryLine = (() => {
    if (!hasLogs) return null;
    const parts: string[] = [];
    if (summary.sent) parts.push(`✅ ${summary.sent} envoyé${summary.sent > 1 ? "s" : ""}`);
    if (summary.manual_required)
      parts.push(`⚠️ ${summary.manual_required} email${summary.manual_required > 1 ? "s" : ""} manquant${summary.manual_required > 1 ? "s" : ""}`);
    if (summary.failed)
      parts.push(`❌ ${summary.failed} échec${summary.failed > 1 ? "s" : ""}`);
    if (summary.manual_done)
      parts.push(`📮 ${summary.manual_done} traité${summary.manual_done > 1 ? "s" : ""} hors LYTA`);
    return parts.join(" · ");
  })();

  return (
    <div className="w-full rounded-md border border-slate-200 bg-slate-50/50 p-3 mt-2 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Building2 className="h-4 w-4" />
          Envoi aux compagnies
          {loading && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
        </div>
        <div className="flex items-center gap-2">
          {!hasLogs && (
            <Button
              size="sm"
              onClick={handleDispatchClick}
              disabled={dispatching}
              className="gap-1"
            >
              {dispatching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Envoyer aux compagnies
            </Button>
          )}
          {hasLogs && needsRetry && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleDispatchClick}
              disabled={dispatching}
              className="gap-1"
            >
              {dispatching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Relancer les échecs
            </Button>
          )}
        </div>
      </div>

      {summaryLine && (
        <div className="text-xs text-slate-600">{summaryLine}</div>
      )}

      {hasLogs && (
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-slate-500 hover:text-slate-900"
            >
              {expanded ? "Masquer le détail" : "Voir le détail par compagnie"}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 space-y-1.5">
              {logs.map((log) => {
                const visual = STATUS_VISUAL[log.status] ?? STATUS_VISUAL.pending;
                return (
                  <div
                    key={log.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-xs"
                  >
                    <div className="flex flex-1 min-w-0 items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`gap-1 ${visual.className}`}
                      >
                        {visual.icon}
                        {visual.label}
                      </Badge>
                      <span className="font-medium text-slate-800 truncate">
                        {log.insurance_company_name}
                      </span>
                      {log.recipient_email && (
                        <span className="hidden md:inline-flex items-center gap-1 text-slate-500 truncate">
                          <Mail className="h-3 w-3" />
                          {log.recipient_email}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 shrink-0">
                      {log.sent_at && <span>le {fmt(log.sent_at)}</span>}
                      {log.status === "manual_required" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => markManualDone(log.id)}
                        >
                          Marquer envoyé
                        </Button>
                      )}
                    </div>
                    {log.error_message && (
                      <div className="basis-full text-[11px] text-red-700 mt-1">
                        {log.error_message}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Envoyer le mandat aux compagnies ?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                LYTA va envoyer le mandat signé (en pièce jointe) à toutes les
                compagnies listées dans le document, en utilisant l'email{" "}
                <strong>Service Courtier</strong> configuré pour chacune.
              </span>
              <span className="block">
                Compagnies sans email courtier configuré → marquées « à envoyer
                manuellement ».
              </span>
              <span className="block">
                Compagnies déjà notifiées avec succès → ignorées (idempotent).
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDispatch}>
              Envoyer maintenant
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
