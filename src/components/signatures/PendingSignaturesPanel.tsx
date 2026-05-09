// Lists signature requests for a given client and lets the broker copy the sign link,
// resend the invitation, or cancel a request.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Copy, Send, Ban, FileSignature, RefreshCw, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { invokeSupabaseFunction } from "@/lib/edgeFunctions";
import { MandatDispatchPanel } from "@/components/signatures/MandatDispatchPanel";

interface SignatureRequestRow {
  id: string;
  document_kind: string;
  status: "pending" | "viewed" | "signed" | "refused" | "expired" | "cancelled";
  access_token: string;
  expires_at: string;
  invited_at: string;
  signed_at: string | null;
  refused_at: string | null;
  refusal_reason: string | null;
  client_full_name: string | null;
  signed_document_id: string | null;
}

const DOCUMENT_KIND_LABELS: Record<string, string> = {
  mandat_gestion: "Mandat de gestion",
  procuration: "Procuration",
  resiliation_lca_45: "Résiliation LCA art. 45",
  imported: "Document importé",
  autre: "Autre document",
};

const STATUS_BADGE: Record<SignatureRequestRow["status"], { label: string; className: string }> = {
  pending: { label: "En attente", className: "bg-amber-100 text-amber-800" },
  viewed: { label: "Vu", className: "bg-blue-100 text-blue-800" },
  signed: { label: "Signé", className: "bg-emerald-100 text-emerald-800" },
  refused: { label: "Refusé", className: "bg-red-100 text-red-800" },
  expired: { label: "Expiré", className: "bg-slate-200 text-slate-700" },
  cancelled: { label: "Annulé", className: "bg-slate-100 text-slate-600" },
};

interface PendingSignaturesPanelProps {
  /** When provided, only show signatures for this client. Otherwise list all
   *  signatures of the current tenant (RLS handles tenant isolation). */
  clientId?: string;
  refreshTick?: number;
}

export default function PendingSignaturesPanel({ clientId, refreshTick }: PendingSignaturesPanelProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [requests, setRequests] = useState<SignatureRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetch = async () => {
    setLoading(true);
    let query = supabase
      .from("signature_requests")
      .select("id, document_kind, status, access_token, expires_at, invited_at, signed_at, refused_at, refusal_reason, client_full_name, signed_document_id")
      .order("invited_at", { ascending: false });

    if (clientId) {
      query = query.eq("client_id", clientId);
    }

    const { data, error } = await query;

    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      setRequests([]);
    } else {
      setRequests((data || []) as unknown as SignatureRequestRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, refreshTick]);

  const linkFor = (token: string) => `${window.location.origin}/signer/${token}`;

  const handleCopy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(linkFor(token));
      toast({ title: t("signatures.linkCopied") || "Lien copié" });
    } catch {
      toast({ title: "Impossible de copier", variant: "destructive" });
    }
  };

  const handleResend = async (id: string) => {
    setBusyId(id);
    try {
      await invokeSupabaseFunction("send-signature-invite", {
        body: { signatureRequestId: id, appOrigin: window.location.origin },
      });
      toast({ title: "Invitation renvoyée" });
    } catch (e) {
      toast({ title: "Erreur", description: e instanceof Error ? e.message : "—", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm(t("signatures.cancelConfirm") || "Annuler cette demande ?")) return;
    setBusyId(id);
    const { error } = await supabase
      .from("signature_requests")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Demande annulée" });
      await fetch();
    }
    setBusyId(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            {t("signatures.pendingSignaturesTitle") || "Signatures en attente"}
          </span>
          <Button variant="ghost" size="sm" onClick={fetch} disabled={loading} className="gap-1">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading && requests.length === 0 ? (
          <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
        ) : requests.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("signatures.noPendingSignatures") || "Aucune demande de signature en cours."}
          </p>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => {
              const isOpen = r.status === "pending" || r.status === "viewed";
              const badge = STATUS_BADGE[r.status];
              const documentLabel = DOCUMENT_KIND_LABELS[r.document_kind] || "Document";
              const fmt = (d: string) => format(new Date(d), "dd MMM yyyy 'à' HH:mm", { locale: fr });
              const isSignedMandat =
                r.status === "signed" && r.document_kind === "mandat_gestion";
              return (
                <div key={r.id} className="border rounded-lg p-4 flex flex-col gap-3">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{documentLabel}</span>
                        <Badge className={badge.className}>{badge.label}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground space-x-2">
                        <span>Envoyé le {fmt(r.invited_at)}</span>
                        {r.status === "signed" && r.signed_at && <span>• Signé le {fmt(r.signed_at)}</span>}
                        {r.status === "refused" && r.refused_at && <span>• Refusé le {fmt(r.refused_at)}</span>}
                        {isOpen && <span>• Expire le {format(new Date(r.expires_at), "dd MMM yyyy", { locale: fr })}</span>}
                      </div>
                      {r.client_full_name && <div className="text-xs text-muted-foreground">Signé par : {r.client_full_name}</div>}
                      {r.refusal_reason && <div className="text-xs text-red-700">Motif : {r.refusal_reason}</div>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {isOpen && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => handleCopy(r.access_token)} className="gap-1">
                            <Copy className="h-3.5 w-3.5" />
                            {t("signatures.copyLink") || "Copier le lien"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleResend(r.id)} disabled={busyId === r.id} className="gap-1">
                            {busyId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                            {t("signatures.resendInvite") || "Renvoyer"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleCancel(r.id)} disabled={busyId === r.id} className="gap-1 text-red-700">
                            <Ban className="h-3.5 w-3.5" />
                            {t("signatures.cancelRequest") || "Annuler"}
                          </Button>
                        </>
                      )}
                      {r.status === "signed" && !isSignedMandat && (
                        <Badge variant="outline" className="gap-1">
                          <Check className="h-3 w-3" />
                          Document archivé
                        </Badge>
                      )}
                    </div>
                  </div>
                  {/*
                    Signed Mandat de gestion → broker can dispatch the
                    signed PDF to each insurance company listed in the
                    mandat. Manual trigger (button) by product design.
                  */}
                  {isSignedMandat && <MandatDispatchPanel signatureRequestId={r.id} />}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
