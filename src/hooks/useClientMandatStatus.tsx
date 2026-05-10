/**
 * useClientMandatStatus
 * ----------------------
 * Returns whether a client has a signed Mandat de gestion on file.
 *
 * The Mandat de gestion authorises the broker to manage a client's
 * insurance contracts. In Switzerland, FINMA-aligned best practice is to
 * have one signed before creating contracts on behalf of the client —
 * but the product owner has confirmed that a signed mandat is NOT a
 * hard requirement (some clients sign later, some files are imported
 * without one). So the UI uses this hook to *warn* the broker without
 * blocking.
 *
 * "Has a signed mandat" means at least one of:
 *   - a row in `documents` with doc_kind='mandat_gestion' for this client
 *     (legacy in-form signing path)
 *   - a row in `signature_requests` with status='signed' and
 *     document_kind='mandat_gestion' for this client (remote signing path)
 */
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export interface ClientMandatStatus {
  hasSignedMandat: boolean;
  loading: boolean;
}

export function useClientMandatStatus(
  clientId: string | null | undefined,
): ClientMandatStatus {
  const [hasSignedMandat, setHasSignedMandat] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!clientId) {
      setHasSignedMandat(false);
      setLoading(false);
      return;
    }

    setLoading(true);

    (async () => {
      try {
        // Path 1: a document of kind mandat_gestion owned by the client
        // (covers the in-form signing flow that just stores the PDF).
        const docPromise = supabase
          .from("documents")
          .select("id", { head: true, count: "exact" })
          .eq("owner_id", clientId)
          .eq("owner_type", "client")
          .eq("doc_kind", "mandat_gestion")
          .limit(1);

        // Path 2: a signed signature_request of kind mandat_gestion
        // (covers the remote signing flow).
        const sigPromise = supabase
          .from("signature_requests")
          .select("id", { head: true, count: "exact" })
          .eq("client_id", clientId)
          .eq("document_kind", "mandat_gestion")
          .eq("status", "signed")
          .limit(1);

        const [docRes, sigRes] = await Promise.all([docPromise, sigPromise]);
        if (cancelled) return;

        const docCount = docRes.count ?? 0;
        const sigCount = sigRes.count ?? 0;

        setHasSignedMandat(docCount > 0 || sigCount > 0);
      } catch (err) {
        // Don't surface the error in the UI — the warning banner is a
        // soft signal, the broker can still proceed. We log to console
        // for diagnosability.
        // eslint-disable-next-line no-console
        console.warn("useClientMandatStatus check failed", err);
        if (!cancelled) setHasSignedMandat(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return { hasSignedMandat, loading };
}
