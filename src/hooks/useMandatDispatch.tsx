/**
 * useMandatDispatch
 * -----------------
 * Drives the "Envoyer aux compagnies" workflow on a signed Mandat de gestion.
 *
 * Responsibilities:
 *   1. Read the dispatch log rows for a given signature_request_id
 *   2. Trigger the `dispatch-mandat-to-companies` Edge Function (the broker
 *      clicks the button — this is NOT a DB trigger, by product design)
 *   3. Let the broker mark a "manual_required" row as "manual_done" once
 *      they've forwarded the PDF to the company outside of LYTA
 *   4. Let the broker retry a "failed" or "manual_required" row by simply
 *      re-running the dispatch Edge Function (it's idempotent on `sent`
 *      rows so already-sent companies are not re-emailed)
 */
import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { invokeSupabaseFunction } from "@/lib/edgeFunctions";
import { useToast } from "@/hooks/use-toast";

export type DispatchStatus =
  | "pending"
  | "sent"
  | "failed"
  | "manual_required"
  | "manual_done";

export interface MandatDispatchLogRow {
  id: string;
  tenant_id: string;
  signature_request_id: string;
  client_id: string | null;
  insurance_company_id: string | null;
  insurance_company_name: string;
  company_contact_id: string | null;
  recipient_email: string | null;
  status: DispatchStatus;
  error_message: string | null;
  resend_message_id: string | null;
  attempts: number;
  triggered_by: string | null;
  created_at: string;
  sent_at: string | null;
  updated_at: string;
}

export interface DispatchResultDetail {
  company_name: string;
  company_id: string | null;
  status: "sent" | "failed" | "manual_required";
  recipient_email: string | null;
  error: string | null;
  log_id: string;
}

export interface DispatchResultPayload {
  ok: true;
  dispatched: number;
  manual_required: number;
  failed?: number;
  details: DispatchResultDetail[];
  message?: string;
}

export function useMandatDispatch(signatureRequestId: string | null | undefined) {
  const { toast } = useToast();
  const [logs, setLogs] = useState<MandatDispatchLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [dispatching, setDispatching] = useState(false);

  const refresh = useCallback(async () => {
    if (!signatureRequestId) {
      setLogs([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("mandat_dispatch_log")
        .select("*")
        .eq("signature_request_id", signatureRequestId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setLogs((data ?? []) as MandatDispatchLogRow[]);
    } catch (err) {
      console.error("Error fetching mandat dispatch log", err);
      toast({
        title: "Erreur",
        description: "Impossible de charger l'historique des envois",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [signatureRequestId, toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /**
   * Fire the dispatch Edge Function. The function itself is idempotent
   * (already-sent rows are not re-emailed), so calling this multiple
   * times is safe — useful as a "retry the failed/manual ones" button.
   */
  const dispatchToCompanies =
    useCallback(async (): Promise<DispatchResultPayload | null> => {
      if (!signatureRequestId) return null;
      setDispatching(true);
      try {
        const result = await invokeSupabaseFunction<DispatchResultPayload>(
          "dispatch-mandat-to-companies",
          { body: { signature_request_id: signatureRequestId } },
        );

        await refresh();

        if (!result || !("ok" in result)) {
          return null;
        }

        const sentCount = result.dispatched ?? 0;
        const manualCount = result.manual_required ?? 0;
        const failedCount = result.failed ?? 0;

        if (sentCount === 0 && manualCount === 0 && failedCount === 0) {
          toast({
            title: "Aucun envoi nécessaire",
            description:
              result.message ?? "Aucune compagnie listée dans ce mandat.",
          });
        } else {
          const parts: string[] = [];
          if (sentCount) parts.push(`${sentCount} envoyé${sentCount > 1 ? "s" : ""}`);
          if (manualCount)
            parts.push(`${manualCount} à envoyer manuellement`);
          if (failedCount)
            parts.push(`${failedCount} échec${failedCount > 1 ? "s" : ""}`);
          toast({
            title: "Dispatch terminé",
            description: parts.join(" · "),
            variant: failedCount > 0 ? "destructive" : "default",
          });
        }

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        toast({
          title: "Erreur dispatch",
          description: message,
          variant: "destructive",
        });
        return null;
      } finally {
        setDispatching(false);
      }
    }, [signatureRequestId, refresh, toast]);

  /**
   * Broker tells LYTA "I sent the PDF to this company manually" — flips
   * the row from manual_required to manual_done so it stops showing in
   * the "to do" list. RLS still protects tenant scope.
   */
  const markManualDone = useCallback(
    async (logId: string) => {
      try {
        const { error } = await supabase
          .from("mandat_dispatch_log")
          .update({ status: "manual_done", sent_at: new Date().toISOString() })
          .eq("id", logId);
        if (error) throw error;
        await refresh();
        toast({ title: "Marqué comme envoyé manuellement" });
        return true;
      } catch (err) {
        toast({
          title: "Erreur",
          description: err instanceof Error ? err.message : String(err),
          variant: "destructive",
        });
        return false;
      }
    },
    [refresh, toast],
  );

  // Aggregated counters for the UI summary.
  const summary = {
    sent: logs.filter((l) => l.status === "sent").length,
    failed: logs.filter((l) => l.status === "failed").length,
    manual_required: logs.filter((l) => l.status === "manual_required").length,
    manual_done: logs.filter((l) => l.status === "manual_done").length,
    pending: logs.filter((l) => l.status === "pending").length,
    total: logs.length,
  };

  return {
    logs,
    summary,
    loading,
    dispatching,
    refresh,
    dispatchToCompanies,
    markManualDone,
  };
}
