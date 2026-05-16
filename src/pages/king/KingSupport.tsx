/**
 * KingSupport — inbox des tickets de support tenant ↔ king
 */
import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, MessageSquare, ArrowLeft, Send, ExternalLink, CheckCircle2, AlertTriangle, Inbox } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";

type TicketStatus = "open" | "in_progress" | "waiting_tenant" | "resolved" | "closed";

interface KingTicket {
  id: string;
  tenant_id: string;
  subject: string;
  category: string | null;
  priority: string;
  status: TicketStatus;
  last_message_at: string;
  last_message_role: string | null;
  created_at: string;
  tenant: { id: string; name: string; slug: string } | null;
}

interface Message {
  id: string;
  sender_role: "tenant" | "king" | "system";
  sender_name: string | null;
  body: string;
  created_at: string;
}

const STATUS_BADGE: Record<TicketStatus, { label: string; cls: string }> = {
  open: { label: "Ouvert", cls: "bg-blue-100 text-blue-800 border-blue-200" },
  in_progress: { label: "En cours", cls: "bg-amber-100 text-amber-800 border-amber-200" },
  waiting_tenant: { label: "Attente tenant", cls: "bg-violet-100 text-violet-800 border-violet-200" },
  resolved: { label: "Résolu", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  closed: { label: "Fermé", cls: "bg-gray-100 text-gray-800 border-gray-200" },
};

const PRIORITY_CLS: Record<string, string> = {
  low: "bg-gray-100 text-gray-800",
  normal: "bg-blue-100 text-blue-800",
  high: "bg-amber-100 text-amber-800",
  urgent: "bg-red-100 text-red-800",
};

export default function KingSupport() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTicket = searchParams.get("ticket");
  const [openTicketId, setOpenTicketId] = useState<string | null>(initialTicket);
  const [statusFilter, setStatusFilter] = useState<"all" | TicketStatus>("all");
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (openTicketId) setSearchParams({ ticket: openTicketId });
    else setSearchParams({});
  }, [openTicketId]);

  const { data: tickets = [], isLoading, refetch: refetchList } = useQuery({
    queryKey: ["king-support-tickets", statusFilter],
    queryFn: async (): Promise<KingTicket[]> => {
      let q = supabase
        .from("support_tickets")
        .select(`id, tenant_id, subject, category, priority, status, last_message_at, last_message_role, created_at,
          tenant:tenants ( id, name, slug )`)
        .order("last_message_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as KingTicket[];
    },
    refetchInterval: 30_000,
  });

  const openTicket = useMemo(() => tickets.find(t => t.id === openTicketId), [tickets, openTicketId]);

  const { data: messages = [], refetch: refetchMessages } = useQuery({
    queryKey: ["king-support-messages", openTicketId],
    queryFn: async (): Promise<Message[]> => {
      if (!openTicketId) return [];
      const { data, error } = await supabase
        .from("support_ticket_messages")
        .select("id, sender_role, sender_name, body, created_at")
        .eq("ticket_id", openTicketId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as Message[];
    },
    enabled: !!openTicketId,
  });

  const counts = useMemo(() => ({
    open: tickets.filter(t => t.status === "open").length,
    in_progress: tickets.filter(t => t.status === "in_progress").length,
    awaiting_response: tickets.filter(t => t.last_message_role === "tenant" && t.status !== "closed" && t.status !== "resolved").length,
  }), [tickets]);

  const sendReply = async () => {
    if (!openTicketId || !replyBody.trim()) return;
    setSending(true);
    try {
      await supabase.from("support_ticket_messages").insert({
        ticket_id: openTicketId,
        sender_user_id: user?.id,
        sender_role: "king",
        sender_name: "Support LYTA",
        body: replyBody.trim(),
      });
      setReplyBody("");
      refetchMessages();
      refetchList();
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const updateStatus = async (newStatus: TicketStatus) => {
    if (!openTicketId) return;
    try {
      await supabase.from("support_tickets").update({
        status: newStatus,
        resolved_at: newStatus === "resolved" ? new Date().toISOString() : null,
        closed_at: newStatus === "closed" ? new Date().toISOString() : null,
        assigned_to: user?.id,
        updated_at: new Date().toISOString(),
      }).eq("id", openTicketId);

      await supabase.from("support_ticket_messages").insert({
        ticket_id: openTicketId,
        sender_user_id: user?.id,
        sender_role: "system",
        sender_name: "Système",
        body: `Statut changé : ${STATUS_BADGE[newStatus].label}`,
      });

      refetchMessages();
      refetchList();
      queryClient.invalidateQueries({ queryKey: ["king-support-tickets"] });
      toast({ title: "Statut mis à jour", description: STATUS_BADGE[newStatus].label });
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message || String(e), variant: "destructive" });
    }
  };

  // Vue conversation
  if (openTicket) {
    const sb = STATUS_BADGE[openTicket.status];
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Button variant="ghost" size="sm" onClick={() => setOpenTicketId(null)} className="mb-2 -ml-2">
                  <ArrowLeft className="h-4 w-4 mr-1" /> Inbox
                </Button>
                <CardTitle className="text-lg flex items-center gap-2">
                  {openTicket.subject}
                  <Badge className={sb.cls} variant="outline">{sb.label}</Badge>
                  <Badge className={PRIORITY_CLS[openTicket.priority]} variant="outline">{openTicket.priority}</Badge>
                  {openTicket.category && <Badge variant="outline">{openTicket.category}</Badge>}
                </CardTitle>
                {openTicket.tenant && (
                  <Link to={`/king/tenants/${openTicket.tenant.id}`} className="text-sm text-primary hover:underline flex items-center gap-1 mt-1">
                    {openTicket.tenant.name} <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Ouvert le {format(new Date(openTicket.created_at), "dd MMM yyyy à HH:mm", { locale: fr })}
                </p>
              </div>
              <div className="flex gap-1 flex-wrap">
                <Select value={openTicket.status} onValueChange={(v) => updateStatus(v as TicketStatus)}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_BADGE).map(([v, b]) => (
                      <SelectItem key={v} value={v}>{b.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 max-h-[500px] overflow-y-auto p-2">
              {messages.map((m) => {
                const isKing = m.sender_role === "king";
                const isSystem = m.sender_role === "system";
                return (
                  <div key={m.id} className={`flex ${isKing ? "justify-end" : isSystem ? "justify-center" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-lg p-3 ${
                      isSystem ? "bg-muted text-xs italic" :
                      isKing ? "bg-primary text-primary-foreground" :
                      "bg-blue-100 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900"
                    }`}>
                      {!isSystem && (
                        <p className="text-xs font-semibold mb-1 opacity-80">
                          {isKing ? "Support LYTA" : m.sender_name || "Cabinet"}
                        </p>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                      <p className="text-xs opacity-70 mt-1">{formatDistanceToNow(new Date(m.created_at), { locale: fr, addSuffix: true })}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {openTicket.status !== "closed" && (
              <div className="space-y-2 pt-3 border-t">
                <Textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Ta réponse au cabinet..."
                  rows={3}
                />
                <div className="flex justify-between items-center">
                  <div className="flex gap-2">
                    {openTicket.status !== "resolved" && (
                      <Button variant="outline" size="sm" onClick={() => updateStatus("resolved")} className="gap-1.5">
                        <CheckCircle2 className="h-4 w-4" /> Marquer résolu
                      </Button>
                    )}
                  </div>
                  <Button onClick={sendReply} disabled={sending || !replyBody.trim()} className="gap-2">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Envoyer
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Vue inbox
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Inbox className="h-7 w-7 text-primary" />
            Support tenants
          </h1>
          <p className="text-muted-foreground">Inbox des tickets de support envoyés par les cabinets.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-500/10"><MessageSquare className="h-5 w-5 text-blue-600" /></div>
          <div><p className="text-2xl font-bold">{counts.open}</p><p className="text-sm text-muted-foreground">Ouverts</p></div>
        </div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-500/10"><Loader2 className="h-5 w-5 text-amber-600" /></div>
          <div><p className="text-2xl font-bold">{counts.in_progress}</p><p className="text-sm text-muted-foreground">En cours</p></div>
        </div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-red-500/10"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
          <div><p className="text-2xl font-bold">{counts.awaiting_response}</p><p className="text-sm text-muted-foreground">Attente réponse</p></div>
        </div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Tous les tickets</CardTitle>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {Object.entries(STATUS_BADGE).map(([v, b]) => (
                <SelectItem key={v} value={v}>{b.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : tickets.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Inbox className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Aucun ticket pour ce filtre.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tickets.map(t => {
                const sb = STATUS_BADGE[t.status];
                const awaitsResponse = t.last_message_role === "tenant" && !["resolved", "closed"].includes(t.status);
                return (
                  <button
                    key={t.id}
                    onClick={() => setOpenTicketId(t.id)}
                    className={`w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition ${
                      awaitsResponse ? "border-red-300 bg-red-50/30 dark:bg-red-950/10" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="font-medium">{t.subject}</p>
                          {awaitsResponse && <Badge variant="destructive" className="text-xs">À répondre</Badge>}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                          <span className="font-medium text-foreground">{t.tenant?.name || "—"}</span>
                          <Badge className={sb.cls} variant="outline">{sb.label}</Badge>
                          <Badge className={PRIORITY_CLS[t.priority]} variant="outline">{t.priority}</Badge>
                          {t.category && <Badge variant="outline" className="text-xs">{t.category}</Badge>}
                          <span>· {formatDistanceToNow(new Date(t.last_message_at), { locale: fr, addSuffix: true })}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
