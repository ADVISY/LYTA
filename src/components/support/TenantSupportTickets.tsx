/**
 * TenantSupportTickets — UI tenant pour gérer ses tickets de support
 * Liste + création + conversation
 */
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, MessageSquare, Clock, CheckCircle2, ArrowLeft, Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

type TicketStatus = "open" | "in_progress" | "waiting_tenant" | "resolved" | "closed";

interface Ticket {
  id: string;
  subject: string;
  category: string | null;
  priority: string;
  status: TicketStatus;
  last_message_at: string;
  last_message_role: string | null;
  created_at: string;
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
  waiting_tenant: { label: "Attente de toi", cls: "bg-violet-100 text-violet-800 border-violet-200" },
  resolved: { label: "Résolu", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  closed: { label: "Fermé", cls: "bg-gray-100 text-gray-800 border-gray-200" },
};

export function TenantSupportTickets() {
  const { tenant } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ subject: "", category: "other", priority: "normal", body: "" });
  const [replyBody, setReplyBody] = useState("");

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["support-tickets-tenant", tenant?.id],
    queryFn: async (): Promise<Ticket[]> => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("id, subject, category, priority, status, last_message_at, last_message_role, created_at")
        .eq("tenant_id", tenant!.id)
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Ticket[];
    },
    enabled: !!tenant?.id,
  });

  const openTicket = useMemo(() => tickets.find(t => t.id === openTicketId), [tickets, openTicketId]);

  const { data: messages = [], refetch: refetchMessages } = useQuery({
    queryKey: ["support-messages", openTicketId],
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

  const handleCreate = async () => {
    if (!form.subject.trim() || !form.body.trim() || !tenant?.id) return;
    setCreating(true);
    try {
      const { data: ticket, error } = await supabase
        .from("support_tickets")
        .insert({
          tenant_id: tenant.id,
          subject: form.subject.trim(),
          category: form.category,
          priority: form.priority,
          status: "open",
          created_by: user?.id,
          last_message_role: "tenant",
        })
        .select("id")
        .single();
      if (error) throw error;

      await supabase.from("support_ticket_messages").insert({
        ticket_id: ticket.id,
        sender_user_id: user?.id,
        sender_role: "tenant",
        sender_name: user?.user_metadata?.first_name
          ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ""}`.trim()
          : user?.email || "Cabinet",
        body: form.body.trim(),
      });

      toast({ title: "Ticket créé", description: "On te répond dans les meilleurs délais." });
      setForm({ subject: "", category: "other", priority: "normal", body: "" });
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ["support-tickets-tenant"] });
      setOpenTicketId(ticket.id);
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleReply = async () => {
    if (!replyBody.trim() || !openTicketId) return;
    setSending(true);
    try {
      await supabase.from("support_ticket_messages").insert({
        ticket_id: openTicketId,
        sender_user_id: user?.id,
        sender_role: "tenant",
        sender_name: user?.user_metadata?.first_name
          ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ""}`.trim()
          : user?.email || "Cabinet",
        body: replyBody.trim(),
      });
      setReplyBody("");
      refetchMessages();
      queryClient.invalidateQueries({ queryKey: ["support-tickets-tenant"] });
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  // Vue conversation
  if (openTicket) {
    const sb = STATUS_BADGE[openTicket.status];
    return (
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <Button variant="ghost" size="sm" onClick={() => setOpenTicketId(null)} className="mb-2 -ml-2">
                <ArrowLeft className="h-4 w-4 mr-1" /> Mes tickets
              </Button>
              <CardTitle className="text-lg">{openTicket.subject}</CardTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={sb.cls} variant="outline">{sb.label}</Badge>
                {openTicket.priority !== "normal" && <Badge variant="outline">{openTicket.priority}</Badge>}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 max-h-[500px] overflow-y-auto p-2">
            {messages.map((m) => {
              const isKing = m.sender_role === "king";
              const isSystem = m.sender_role === "system";
              return (
                <div key={m.id} className={`flex ${isKing ? "justify-start" : isSystem ? "justify-center" : "justify-end"}`}>
                  <div className={`max-w-[80%] rounded-lg p-3 ${
                    isSystem ? "bg-muted text-xs italic" :
                    isKing ? "bg-primary/10 border border-primary/20" :
                    "bg-blue-500 text-white"
                  }`}>
                    {!isSystem && (
                      <p className="text-xs font-semibold mb-1 opacity-80">
                        {isKing ? "Support LYTA" : m.sender_name || "Toi"}
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
                placeholder="Ta réponse..."
                rows={3}
              />
              <Button onClick={handleReply} disabled={sending || !replyBody.trim()} className="gap-2">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Envoyer
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Vue liste
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          Mes tickets de support
        </CardTitle>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nouveau ticket
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : tickets.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Aucun ticket pour l'instant.</p>
            <p className="text-xs mt-1">Click "Nouveau ticket" pour contacter le support LYTA.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tickets.map(t => {
              const sb = STATUS_BADGE[t.status];
              const tenantHasUnread = t.last_message_role === "king";
              return (
                <button
                  key={t.id}
                  onClick={() => setOpenTicketId(t.id)}
                  className={`w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition ${
                    tenantHasUnread ? "border-primary/40 bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{t.subject}</p>
                        {tenantHasUnread && <Badge variant="default" className="text-xs">Nouveau</Badge>}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge className={sb.cls} variant="outline">{sb.label}</Badge>
                        {t.category && <Badge variant="outline" className="text-xs">{t.category}</Badge>}
                        <Clock className="h-3 w-3 ml-1" />
                        <span>{formatDistanceToNow(new Date(t.last_message_at), { locale: fr, addSuffix: true })}</span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Dialog nouveau ticket */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ouvrir un ticket support</DialogTitle>
            <DialogDescription>
              Le support LYTA te répond dans les meilleurs délais (heures ouvrées).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Sujet</Label>
              <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Décris en 1 phrase ton problème ou ta question" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Catégorie</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bug">Bug</SelectItem>
                    <SelectItem value="feature">Demande feature</SelectItem>
                    <SelectItem value="billing">Facturation</SelectItem>
                    <SelectItem value="account">Compte / accès</SelectItem>
                    <SelectItem value="onboarding">Onboarding</SelectItem>
                    <SelectItem value="other">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priorité</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Basse</SelectItem>
                    <SelectItem value="normal">Normale</SelectItem>
                    <SelectItem value="high">Haute</SelectItem>
                    <SelectItem value="urgent">🔥 Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Détail du problème ou de la demande..." rows={5} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>Annuler</Button>
            <Button onClick={handleCreate} disabled={creating || !form.subject.trim() || !form.body.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
