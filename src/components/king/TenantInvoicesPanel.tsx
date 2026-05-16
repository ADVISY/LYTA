/**
 * TenantInvoicesPanel
 * ===================
 * Onglet Factures d'une fiche tenant côté King.
 * Pull live l'historique des invoices Stripe via l'edge function
 * list-tenant-invoices. Affiche statut, montants, dates, liens PDF + Stripe.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExternalLink, FileDown, Loader2, Receipt, AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Invoice {
  id: string;
  number: string | null;
  created: number;
  created_iso: string;
  amount_paid_chf: number;
  amount_due_chf: number;
  amount_remaining_chf: number;
  total_chf: number;
  currency: string;
  status: string | null;
  paid: boolean;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  period_start_iso: string | null;
  period_end_iso: string | null;
  due_date_iso: string | null;
  description: string | null;
}

interface InvoicesResponse {
  tenant: {
    id: string;
    name: string;
    slug: string;
    billing_mode: string | null;
    stripe_customer_id?: string;
    stripe_subscription_id?: string;
  };
  invoices: Invoice[];
  total_paid_chf: number;
  upcoming: {
    amount_due_chf: number;
    period_start_iso: string | null;
    period_end_iso: string | null;
  } | null;
  stripe_customer_url: string | null;
  warning?: string;
}

function statusBadge(status: string | null) {
  if (status === "paid") return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 gap-1"><CheckCircle2 className="h-3 w-3" />Payée</Badge>;
  if (status === "open") return <Badge className="bg-amber-100 text-amber-800 border-amber-200 gap-1"><Clock className="h-3 w-3" />En attente</Badge>;
  if (status === "draft") return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Brouillon</Badge>;
  if (status === "uncollectible") return <Badge className="bg-red-100 text-red-800 border-red-200 gap-1"><XCircle className="h-3 w-3" />Non recouvrable</Badge>;
  if (status === "void") return <Badge variant="outline" className="gap-1"><XCircle className="h-3 w-3" />Annulée</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function formatChf(amount: number): string {
  return new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF" }).format(amount);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return format(new Date(iso), "dd MMM yyyy", { locale: fr });
}

export function TenantInvoicesPanel({ tenantId }: { tenantId: string }) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["tenant-invoices", tenantId],
    queryFn: async (): Promise<InvoicesResponse> => {
      const { data, error } = await supabase.functions.invoke("list-tenant-invoices", {
        body: { tenant_id: tenantId, limit: 100 },
      });
      if (error) throw error;
      return data as InvoicesResponse;
    },
    enabled: !!tenantId,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">Chargement des factures Stripe…</span>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3 text-destructive">
            <AlertTriangle className="h-5 w-5 mt-0.5" />
            <div>
              <p className="font-semibold">Erreur de chargement</p>
              <p className="text-sm text-muted-foreground mt-1">{(error as any)?.message || "Impossible de récupérer les factures Stripe."}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Réessayer</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* Header summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-500/10">
                <Receipt className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatChf(data.total_paid_chf)}</p>
                <p className="text-sm text-muted-foreground">Total facturé payé (à vie)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-500/10">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.upcoming ? formatChf(data.upcoming.amount_due_chf) : "—"}</p>
                <p className="text-sm text-muted-foreground">
                  Prochaine facture
                  {data.upcoming?.period_end_iso && <> · {formatDate(data.upcoming.period_end_iso)}</>}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Customer Stripe</p>
              {data.tenant.stripe_customer_id ? (
                <code className="text-xs bg-muted px-2 py-1 rounded">{data.tenant.stripe_customer_id}</code>
              ) : (
                <span className="text-sm text-muted-foreground">Non lié</span>
              )}
            </div>
            {data.stripe_customer_url && (
              <Button variant="outline" size="sm" asChild>
                <a href={data.stripe_customer_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Voir dans Stripe
                </a>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {data.warning && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900 dark:text-amber-200">Aucune sync Stripe</p>
              <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">{data.warning}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoices table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Historique factures ({data.invoices.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Aucune facture Stripe pour ce tenant.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">{inv.number || inv.id.slice(0, 12)}</TableCell>
                    <TableCell>{formatDate(inv.created_iso)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {inv.period_start_iso && inv.period_end_iso
                        ? `${formatDate(inv.period_start_iso)} → ${formatDate(inv.period_end_iso)}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatChf(inv.total_chf)}
                      {inv.status === "open" && inv.amount_remaining_chf > 0 && (
                        <span className="text-xs text-amber-600 ml-1">
                          ({formatChf(inv.amount_remaining_chf)} dû)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{statusBadge(inv.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {inv.invoice_pdf && (
                          <Button variant="ghost" size="icon" asChild title="Télécharger PDF">
                            <a href={inv.invoice_pdf} target="_blank" rel="noopener noreferrer">
                              <FileDown className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        {inv.hosted_invoice_url && (
                          <Button variant="ghost" size="icon" asChild title="Voir facture en ligne">
                            <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
