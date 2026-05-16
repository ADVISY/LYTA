/**
 * AffiliateInvoiceTab
 * ===================
 * Onglet "Facture mensuelle" sur la fiche d'un affilié King.
 * - Sélection du mois (default = mois précédent)
 * - Liste les commissions générées par les tenants apportés sur cette période
 * - Total à payer (sum due + paid)
 * - Bouton "Marquer toutes les due → payées"
 * - Bouton "Télécharger PDF" (html2pdf côté client)
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, FileDown, CheckCircle2 } from "lucide-react";
import html2pdf from "html2pdf.js";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface InvoiceRow {
  affiliate_id: string;
  affiliate_name: string | null;
  affiliate_email: string | null;
  period_start: string;
  period_end: string;
  commission_id: string | null;
  tenant_id: string | null;
  tenant_name: string | null;
  payment_id: string | null;
  payment_date: string | null;
  payment_amount: number | null;
  commission_rate: number | null;
  commission_amount: number | null;
  status: string | null;
}

const formatChf = (n: number) =>
  new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF", minimumFractionDigits: 2 }).format(n);

export function AffiliateInvoiceTab({ affiliateId }: { affiliateId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Default : mois passé
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() === 0 ? 12 : now.getMonth()).padStart(2, "0")}`;
  const defaultYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const [period, setPeriod] = useState(`${defaultYear}-${String(now.getMonth() === 0 ? 12 : now.getMonth()).padStart(2, "0")}`);

  const periodRange = useMemo(() => {
    const [y, m] = period.split("-").map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);
    return { start: start.toISOString(), end: end.toISOString(), label: format(start, "MMMM yyyy", { locale: fr }) };
  }, [period]);

  // Mois disponibles : 12 derniers + 3 prochains
  const monthOptions = useMemo(() => {
    const list: { value: string; label: string }[] = [];
    for (let i = 11; i >= -3; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      list.push({ value, label: format(d, "MMMM yyyy", { locale: fr }) });
    }
    return list;
  }, [now]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["affiliate-invoice", affiliateId, period],
    queryFn: async (): Promise<InvoiceRow[]> => {
      const { data, error } = await supabase.rpc("get_affiliate_invoice_data", {
        p_affiliate_id: affiliateId,
        p_period_start: periodRange.start,
        p_period_end: periodRange.end,
      });
      if (error) throw error;
      return (data || []) as InvoiceRow[];
    },
  });

  const lines = (data || []).filter(r => r.commission_id);
  const affiliateInfo = data?.[0];
  const totalDue = lines.filter(l => l.status === "due").reduce((s, l) => s + Number(l.commission_amount || 0), 0);
  const totalPaid = lines.filter(l => l.status === "paid").reduce((s, l) => s + Number(l.commission_amount || 0), 0);
  const total = totalDue + totalPaid;
  const dueCount = lines.filter(l => l.status === "due").length;

  const handleMarkAllPaid = async () => {
    if (!confirm(`Marquer ${dueCount} commission(s) due comme payées ?`)) return;
    try {
      const { data: count, error } = await supabase.rpc("mark_affiliate_commissions_paid", {
        p_affiliate_id: affiliateId,
        p_period_start: periodRange.start,
        p_period_end: periodRange.end,
      });
      if (error) throw error;
      toast({ title: "Commissions marquées payées", description: `${count} ligne(s) mise(s) à jour` });
      refetch();
      queryClient.invalidateQueries({ queryKey: ["affiliate-detail", affiliateId] });
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message || String(e), variant: "destructive" });
    }
  };

  const handleDownloadPdf = () => {
    const el = document.getElementById(`affiliate-invoice-${affiliateId}`);
    if (!el) return;
    const fname = `facture-affilie-${affiliateInfo?.affiliate_name?.replace(/\s/g, "-").toLowerCase() || "affilie"}-${period}.pdf`;
    html2pdf().set({
      margin: 10,
      filename: fname,
      image: { type: "jpeg", quality: 0.95 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    }).from(el).save();
  };

  return (
    <div className="space-y-4">
      {/* Sélecteur de mois + actions */}
      <Card>
        <CardContent className="pt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Période</span>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {monthOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleDownloadPdf} disabled={!lines.length} className="gap-2">
              <FileDown className="h-4 w-4" /> PDF
            </Button>
            <Button onClick={handleMarkAllPaid} disabled={dueCount === 0} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              Marquer {dueCount} payée{dueCount > 1 ? "s" : ""}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Facture (zone qui sera exportée en PDF) */}
      <Card>
        <CardHeader>
          <CardTitle>Facture commissions — {periodRange.label}</CardTitle>
          <CardDescription>
            {affiliateInfo ? `${affiliateInfo.affiliate_name} · ${affiliateInfo.affiliate_email}` : "Affilié"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div id={`affiliate-invoice-${affiliateId}`} className="space-y-6 bg-white p-6 rounded-md">
              {/* Header PDF */}
              <div className="flex items-start justify-between border-b pb-4">
                <div>
                  <h2 className="text-2xl font-bold">LYTA — Facture commissions affilié</h2>
                  <p className="text-sm text-gray-600 mt-1">Période : {periodRange.label}</p>
                  <p className="text-xs text-gray-500 mt-2">Émise le {format(new Date(), "dd MMMM yyyy", { locale: fr })}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-semibold">À : {affiliateInfo?.affiliate_name || "—"}</p>
                  <p className="text-gray-600">{affiliateInfo?.affiliate_email || "—"}</p>
                </div>
              </div>

              {/* Récap */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded">
                  <p className="text-xs text-gray-600">Commissions du mois</p>
                  <p className="text-xl font-bold">{lines.length}</p>
                </div>
                <div className="p-4 bg-amber-50 rounded">
                  <p className="text-xs text-gray-600">Dû</p>
                  <p className="text-xl font-bold text-amber-700">{formatChf(totalDue)}</p>
                </div>
                <div className="p-4 bg-emerald-50 rounded">
                  <p className="text-xs text-gray-600">Déjà payé</p>
                  <p className="text-xl font-bold text-emerald-700">{formatChf(totalPaid)}</p>
                </div>
              </div>

              {/* Table */}
              {lines.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Aucune commission générée sur cette période.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead className="text-right">Paiement</TableHead>
                      <TableHead className="text-right">Taux</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((l) => (
                      <TableRow key={l.commission_id!}>
                        <TableCell className="text-sm">{l.payment_date ? format(new Date(l.payment_date), "dd/MM/yyyy", { locale: fr }) : "—"}</TableCell>
                        <TableCell>{l.tenant_name || "—"}</TableCell>
                        <TableCell className="text-right">{formatChf(Number(l.payment_amount || 0))}</TableCell>
                        <TableCell className="text-right">{Number(l.commission_rate || 0)}%</TableCell>
                        <TableCell className="text-right font-medium">{formatChf(Number(l.commission_amount || 0))}</TableCell>
                        <TableCell>
                          {l.status === "paid"
                            ? <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Payée</Badge>
                            : <Badge className="bg-amber-100 text-amber-800 border-amber-200">Due</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2">
                      <TableCell colSpan={4} className="font-bold text-right">TOTAL</TableCell>
                      <TableCell className="text-right font-bold">{formatChf(total)}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              )}

              <p className="text-xs text-gray-500 pt-4 border-t">
                Cette facture est émise par LYTA (Optimislink Sàrl) au titre du programme d'affiliation.
                Les commissions sont calculées sur les paiements reçus des tenants apportés, à hauteur du taux convenu.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
