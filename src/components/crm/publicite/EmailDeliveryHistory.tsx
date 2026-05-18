/**
 * EmailDeliveryHistory — unified "who sent what to whom, when" view.
 *
 * Habib (10/05): "il faut également mettre le suivi des envois d'email
 * dans la case publicité quand un email a été envoyé peu importe lequel".
 *
 * Reads `tenant_email_log` (RLS scopes by tenant), groups + filters by
 * email kind (mandat dispatch / signature invite / account / campaign …),
 * shows recipient + status + sent-at + a link to the related entity.
 */
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AlertCircle,
  Building2,
  Check,
  ChevronDown,
  Clock,
  Filter,
  FileSignature,
  Mail,
  Megaphone,
  PiggyBank,
  RefreshCw,
  Search,
  UserPlus,
  X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useUserTenant } from "@/hooks/useUserTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EmailLogRow {
  id: string;
  tenant_id: string;
  kind: string;
  recipient_email: string;
  recipient_name: string | null;
  sender_name: string | null;
  subject: string | null;
  status: "sent" | "failed" | "queued" | "bounced";
  error_message: string | null;
  resend_message_id: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  context: Record<string, unknown> | null;
  created_at: string;
  sent_at: string | null;
}

type StatusFilter = "all" | "sent" | "failed" | "queued" | "bounced";
type KindFilter =
  | "all"
  | "mandat_signed"
  | "mandat_dispatch"
  | "signature_invite"
  | "account_created"
  | "campaign"
  | "quick_email"
  | "crm_email"
  | "lpp_search"
  | "transactional";

const KIND_META: Record<string, { label: string; color: string; icon: typeof Mail }> = {
  mandat_signed:    { label: "Mandat signé",         color: "bg-emerald-100 text-emerald-800",  icon: Check },
  mandat_dispatch:  { label: "Envoi compagnies",      color: "bg-indigo-100 text-indigo-800",     icon: Building2 },
  signature_invite: { label: "Lien signature",         color: "bg-violet-100 text-violet-800",     icon: FileSignature },
  account_created:  { label: "Création compte",        color: "bg-sky-100 text-sky-800",           icon: UserPlus },
  campaign:         { label: "Campagne",               color: "bg-amber-100 text-amber-800",       icon: Megaphone },
  quick_email:      { label: "Email rapide",           color: "bg-slate-100 text-slate-700",       icon: Mail },
  crm_email:        { label: "Email CRM",              color: "bg-slate-100 text-slate-700",       icon: Mail },
  lpp_search:       { label: "Recherche LPP",          color: "bg-amber-100 text-amber-800",       icon: PiggyBank },
  transactional:    { label: "Transactionnel",         color: "bg-slate-100 text-slate-700",       icon: Mail },
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  sent:    { label: "Envoyé",   color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  failed:  { label: "Échec",     color: "bg-red-100 text-red-800 border-red-200" },
  queued:  { label: "En file",   color: "bg-slate-100 text-slate-700 border-slate-200" },
  bounced: { label: "Rebondi",  color: "bg-orange-100 text-orange-800 border-orange-200" },
};

const PAGE_SIZE = 50;

export function EmailDeliveryHistory() {
  const { tenantId } = useUserTenant();
  const [rows, setRows] = useState<EmailLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const refresh = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      let query = supabase
        .from("tenant_email_log")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE * 4);
      const { data, error } = await query;
      if (error) throw error;
      setRows((data ?? []) as EmailLogRow[]);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[EmailDeliveryHistory] fetch failed", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const filteredRows = useMemo(() => {
    let r = rows;
    if (statusFilter !== "all") r = r.filter((x) => x.status === statusFilter);
    if (kindFilter !== "all") r = r.filter((x) => x.kind === kindFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter(
        (x) =>
          x.recipient_email.toLowerCase().includes(q) ||
          (x.recipient_name ?? "").toLowerCase().includes(q) ||
          (x.subject ?? "").toLowerCase().includes(q),
      );
    }
    return r.slice(0, PAGE_SIZE);
  }, [rows, statusFilter, kindFilter, search]);

  const stats = useMemo(() => {
    const total = rows.length;
    const sent = rows.filter((r) => r.status === "sent").length;
    const failed = rows.filter((r) => r.status === "failed").length;
    return { total, sent, failed };
  }, [rows]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const fmt = (d: string | null) =>
    d ? format(new Date(d), "dd MMM yyyy 'à' HH:mm", { locale: fr }) : "—";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Suivi des envois email
          </CardTitle>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">
              {stats.total} sur les 200 derniers
            </span>
            {stats.failed > 0 && (
              <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200 gap-1">
                <AlertCircle className="h-3 w-3" />
                {stats.failed} échec{stats.failed > 1 ? "s" : ""}
              </Badge>
            )}
            <Button variant="ghost" size="icon" onClick={refresh} disabled={loading}>
              {loading ? (
                <Clock className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher (email, nom, sujet)…"
              className="pl-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as KindFilter)}>
            <SelectTrigger className="w-full md:w-56">
              <Filter className="h-3.5 w-3.5 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              <SelectItem value="mandat_signed">Mandat signé</SelectItem>
              <SelectItem value="mandat_dispatch">Envoi aux compagnies</SelectItem>
              <SelectItem value="signature_invite">Liens de signature</SelectItem>
              <SelectItem value="account_created">Création de compte</SelectItem>
              <SelectItem value="campaign">Campagnes</SelectItem>
              <SelectItem value="quick_email">Emails rapides</SelectItem>
              <SelectItem value="crm_email">Emails CRM</SelectItem>
              <SelectItem value="lpp_search">Recherches LPP</SelectItem>
              <SelectItem value="transactional">Transactionnel</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              <SelectItem value="sent">Envoyé</SelectItem>
              <SelectItem value="failed">Échec</SelectItem>
              <SelectItem value="queued">En file</SelectItem>
              <SelectItem value="bounced">Rebondi</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        {loading && rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Chargement…
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Aucun email envoyé pour le moment.
          </div>
        ) : (
          <div className="space-y-2">
            {filteredRows.map((row) => {
              const kind = KIND_META[row.kind] ?? KIND_META.transactional;
              const status = STATUS_META[row.status] ?? STATUS_META.sent;
              const Icon = kind.icon;
              const isExpanded = expanded.has(row.id);

              return (
                <div
                  key={row.id}
                  className="rounded-md border bg-background hover:bg-muted/40 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => toggleExpand(row.id)}
                    className="w-full flex flex-wrap items-center gap-3 p-3 text-left"
                  >
                    <Badge className={`gap-1 ${kind.color}`} variant="outline">
                      <Icon className="h-3 w-3" />
                      {kind.label}
                    </Badge>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="font-medium truncate">
                        {row.recipient_name
                          ? `${row.recipient_name} — ${row.recipient_email}`
                          : row.recipient_email}
                      </div>
                      {row.subject && (
                        <div className="text-xs text-muted-foreground truncate">
                          {row.subject}
                        </div>
                      )}
                    </div>
                    <Badge variant="outline" className={`gap-1 ${status.color}`}>
                      {status.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground hidden md:inline">
                      {fmt(row.sent_at ?? row.created_at)}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isExpanded && (
                    <div className="border-t bg-muted/30 px-4 py-3 text-sm space-y-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                        <div>
                          <span className="text-muted-foreground">Destinataire :</span>{" "}
                          <span className="font-mono">{row.recipient_email}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Expéditeur affiché :</span>{" "}
                          {row.sender_name ?? "—"}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Créé :</span>{" "}
                          {fmt(row.created_at)}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Envoyé :</span>{" "}
                          {fmt(row.sent_at)}
                        </div>
                        {row.resend_message_id && (
                          <div className="md:col-span-2">
                            <span className="text-muted-foreground">ID Resend :</span>{" "}
                            <span className="font-mono text-[11px]">{row.resend_message_id}</span>
                          </div>
                        )}
                      </div>
                      {row.error_message && (
                        <div className="rounded bg-red-50 border border-red-200 p-2 text-xs text-red-800">
                          <strong>Erreur :</strong> {row.error_message}
                        </div>
                      )}
                      {row.context && Object.keys(row.context).length > 0 && (
                        <details className="text-xs text-muted-foreground">
                          <summary className="cursor-pointer hover:text-foreground">
                            Contexte
                          </summary>
                          <pre className="mt-1 p-2 bg-background rounded border overflow-x-auto">
                            {JSON.stringify(row.context, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
