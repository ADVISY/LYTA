/**
 * PendingSignupsPanel
 * ===================
 * Affiche les paiements Stripe self-signup qui n'ont pas été finalisés
 * côté form /access. Permet de renvoyer un email "Termine ton inscription".
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Send, Loader2, AlertTriangle, ExternalLink, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface PendingSignup {
  id: string;
  stripe_session_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  customer_email: string | null;
  plan_id: string | null;
  amount_chf: number | null;
  status: string;
  reminder_count: number;
  last_reminder_at: string | null;
  created_at: string;
}

export function PendingSignupsPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [resending, setResending] = useState<string | null>(null);

  const { data: pendings = [], isLoading, refetch } = useQuery({
    queryKey: ["king-pending-signups"],
    queryFn: async (): Promise<PendingSignup[]> => {
      const { data, error } = await supabase
        .from("pending_signups")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30_000,
  });

  const resendEmail = async (p: PendingSignup) => {
    setResending(p.id);
    try {
      const { data, error } = await supabase.functions.invoke("resend-signup-finalization", {
        body: { pending_signup_id: p.id },
      });
      if (error) throw error;
      toast({
        title: "Email envoyé",
        description: `Email "Termine ton inscription" envoyé à ${data.sent_to} (relance #${data.reminder_count})`,
      });
      queryClient.invalidateQueries({ queryKey: ["king-pending-signups"] });
    } catch (e: any) {
      toast({ title: "Erreur envoi", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setResending(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (pendings.length === 0) {
    return null; // pas de pending = pas d'affichage
  }

  return (
    <Card className="border-amber-300 bg-amber-50/40 dark:bg-amber-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="h-5 w-5" />
          {pendings.length} paiement{pendings.length > 1 ? "s" : ""} sans inscription finalisée
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Brokers qui ont payé sur Stripe mais n'ont pas rempli le formulaire <code>/access</code>.
          Renvoie-leur l'email pour finaliser.
        </p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Date paiement</TableHead>
              <TableHead>Relances</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendings.map((p) => {
              const ageHours = Math.floor((Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60));
              const urgent = ageHours >= 24;
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    {p.customer_email || <span className="text-muted-foreground italic">∅</span>}
                  </TableCell>
                  <TableCell>
                    {p.plan_id ? <Badge variant="secondary">{p.plan_id}</Badge> : "—"}
                  </TableCell>
                  <TableCell>{p.amount_chf ? `${p.amount_chf} CHF` : "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{format(new Date(p.created_at), "dd MMM HH:mm", { locale: fr })}</span>
                      {urgent && (
                        <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">
                          {ageHours}h
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {p.reminder_count > 0 ? (
                      <Badge variant="outline">{p.reminder_count}× envoyée</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Aucune</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {p.stripe_customer_id && (
                        <Button variant="ghost" size="icon" asChild title="Voir dans Stripe">
                          <a
                            href={`https://dashboard.stripe.com/customers/${p.stripe_customer_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => resendEmail(p)}
                        disabled={resending === p.id || !p.customer_email}
                        className="gap-1.5 bg-amber-600 hover:bg-amber-700"
                      >
                        {resending === p.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        Renvoyer email
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
