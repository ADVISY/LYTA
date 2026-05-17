/**
 * KingCosts
 * =========
 * Page de pilotage des coûts plateforme LYTA (OpenAI, Resend, Twilio, ...)
 * vs MRR pour visualiser la marge en temps réel.
 *
 * Data : alimentée par platform_usage_logs + RPCs get_platform_costs_*.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useStripeStats } from "@/hooks/useStripeStats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, DollarSign, Sparkles, Mail, MessageSquare, Server, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid, Legend } from "recharts";
import { Link } from "react-router-dom";

const PROVIDER_META: Record<string, { label: string; color: string; icon: any }> = {
  openai:     { label: "OpenAI (Smartflow)", color: "#10b981", icon: Sparkles },
  resend:     { label: "Resend (emails)",    color: "#3b82f6", icon: Mail },
  twilio:     { label: "Twilio (SMS)",       color: "#ef4444", icon: MessageSquare },
  supabase:   { label: "Supabase",            color: "#8b5cf6", icon: Server },
  vercel:     { label: "Vercel",              color: "#0ea5e9", icon: Server },
  cloudflare: { label: "Cloudflare",          color: "#f97316", icon: Server },
  stripe:     { label: "Stripe (fees)",       color: "#6366f1", icon: DollarSign },
};

interface CostSummaryRow {
  provider: string;
  total_cost_chf: number;
  event_count: number;
}
interface TopTenantRow {
  tenant_id: string;
  tenant_name: string;
  total_cost_chf: number;
  openai_cost_chf: number;
  resend_cost_chf: number;
  twilio_cost_chf: number;
  event_count: number;
}
interface MonthlyCostRow {
  month_iso: string;
  openai_cost_chf: number;
  resend_cost_chf: number;
  twilio_cost_chf: number;
  other_cost_chf: number;
  total_cost_chf: number;
}

const formatChf = (n: number) =>
  new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF", minimumFractionDigits: 2 }).format(n);

export default function KingCosts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<"month" | "30d" | "year">("month");
  const [syncing, setSyncing] = useState(false);

  const syncExternalBilling = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-external-billing", {
        body: { providers: ["resend", "twilio"] },
      });
      if (error) throw error;
      const lines = (data?.results || []).map((r: any) =>
        `${r.provider}: ${r.error ? `❌ ${r.error}` : `${r.inserted} insérés (${r.total_cost_chf.toFixed(2)} CHF)`}`
      ).join(" · ");
      toast({ title: "Sync coûts externes", description: lines || "Aucun résultat" });
      queryClient.invalidateQueries({ queryKey: ["king-costs-summary"] });
      queryClient.invalidateQueries({ queryKey: ["king-costs-top-tenants"] });
      queryClient.invalidateQueries({ queryKey: ["king-costs-monthly"] });
    } catch (e: any) {
      toast({ title: "Erreur sync", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const periodRange = (() => {
    const now = new Date();
    if (period === "month") {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: from.toISOString(), to: now.toISOString(), label: "Ce mois-ci" };
    }
    if (period === "30d") {
      const from = new Date(now.getTime() - 30 * 24 * 3600_000);
      return { from: from.toISOString(), to: now.toISOString(), label: "30 derniers jours" };
    }
    const from = new Date(now.getFullYear(), 0, 1);
    return { from: from.toISOString(), to: now.toISOString(), label: "Année en cours" };
  })();

  const { data: summary = [], isLoading: loadingSummary } = useQuery({
    queryKey: ["king-costs-summary", periodRange.from, periodRange.to],
    queryFn: async (): Promise<CostSummaryRow[]> => {
      const { data, error } = await supabase.rpc("get_platform_costs_summary", {
        p_from: periodRange.from, p_to: periodRange.to,
      });
      if (error) throw error;
      return (data || []) as CostSummaryRow[];
    },
    refetchInterval: 60_000,
  });

  const { data: topTenants = [] } = useQuery({
    queryKey: ["king-costs-top-tenants", periodRange.from, periodRange.to],
    queryFn: async (): Promise<TopTenantRow[]> => {
      const { data, error } = await supabase.rpc("get_top_tenants_by_cost", {
        p_from: periodRange.from, p_to: periodRange.to, p_limit: 10,
      });
      if (error) throw error;
      return (data || []) as TopTenantRow[];
    },
    refetchInterval: 60_000,
  });

  const { data: monthly = [] } = useQuery({
    queryKey: ["king-costs-monthly"],
    queryFn: async (): Promise<MonthlyCostRow[]> => {
      const { data, error } = await supabase.rpc("get_platform_costs_monthly");
      if (error) throw error;
      return (data || []) as MonthlyCostRow[];
    },
    refetchInterval: 60_000,
  });

  const { data: stripeStats } = useStripeStats();

  const totalCostMonth = summary.reduce((s, r) => s + Number(r.total_cost_chf || 0), 0);
  const mrr = stripeStats?.mrr || 0;
  const marginChf = mrr - totalCostMonth;
  const marginPct = mrr > 0 ? (marginChf / mrr) * 100 : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <DollarSign className="h-7 w-7 text-emerald-600" />
            Coûts plateforme
          </h1>
          <p className="text-muted-foreground">Suivi en temps réel des dépenses (OpenAI, Resend, Twilio…) et de la marge LYTA.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={syncExternalBilling}
            disabled={syncing}
            title="Récupère depuis Resend (emails) et Twilio (SMS) les usages réels et les insère dans platform_usage_logs"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sync…" : "Sync Resend + Twilio"}
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              if (!confirm("Facturer maintenant l'overage du mois écoulé sur Stripe ? Crée 1 invoice item par tenant en dépassement.")) return;
              try {
                const { data, error } = await supabase.functions.invoke("apply-monthly-overage", { body: {} });
                if (error) throw error;
                toast({
                  title: "Overage facturé",
                  description: `${data.invoiced}/${data.total_events} events facturés · ${data.skipped} skip · ${data.errors} erreurs`,
                });
              } catch (e: any) {
                toast({ title: "Erreur facturation overage", description: e?.message || String(e), variant: "destructive" });
              }
            }}
            className="text-amber-700 border-amber-300 hover:bg-amber-50"
            title="Crée les invoice items Stripe pour les overages pending du mois écoulé"
          >
            <DollarSign className="h-4 w-4 mr-2" />
            Facturer overage mois écoulé
          </Button>
          {[
            { v: "month", l: "Ce mois" },
            { v: "30d", l: "30 j" },
            { v: "year", l: "Année" },
          ].map(o => (
            <button
              key={o.v}
              onClick={() => setPeriod(o.v as any)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                period === o.v ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
              }`}
            >
              {o.l}
            </button>
          ))}
        </div>
      </div>

      {/* Marge */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-0 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-white/80">MRR (sur Stripe)</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatChf(mrr)}</div>
            <p className="text-xs text-white/80 mt-1">Revenus mensuels récurrents</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-gradient-to-br from-red-500 to-red-600 text-white">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-white/80">Coûts ({periodRange.label})</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatChf(totalCostMonth)}</div>
            <p className="text-xs text-white/80 mt-1">{summary.reduce((s, r) => s + Number(r.event_count || 0), 0)} événements facturés</p>
          </CardContent>
        </Card>
        <Card className={`border-0 ${marginChf >= 0 ? "bg-gradient-to-br from-violet-500 to-violet-600" : "bg-gradient-to-br from-amber-500 to-red-600"} text-white`}>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-white/80 flex items-center gap-2">
            Marge brute
            {marginChf >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          </CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatChf(marginChf)}</div>
            <p className="text-xs text-white/80 mt-1">
              {marginPct !== null ? `${marginPct.toFixed(1)}% du MRR` : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Par provider */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            Coûts par provider — {periodRange.label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingSummary ? (
            <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : summary.length === 0 ? (
            <div className="py-8 text-center">
              <AlertTriangle className="h-6 w-6 mx-auto text-amber-500 mb-2" />
              <p className="text-sm text-muted-foreground">Aucun coût enregistré sur cette période. Le tracking se déclenche à chaque scan IA / email / SMS envoyé.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {summary.map(s => {
                const meta = PROVIDER_META[s.provider] || { label: s.provider, color: "#888", icon: Server };
                const Icon = meta.icon;
                return (
                  <div key={s.provider} className="p-4 rounded-lg border bg-card">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 rounded" style={{ backgroundColor: `${meta.color}22` }}>
                        <Icon className="h-4 w-4" style={{ color: meta.color }} />
                      </div>
                      <span className="text-sm font-medium">{meta.label}</span>
                    </div>
                    <div className="text-2xl font-bold">{formatChf(Number(s.total_cost_chf))}</div>
                    <p className="text-xs text-muted-foreground mt-1">{Number(s.event_count).toLocaleString("fr-CH")} événements</p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Graphique évolution 12 mois */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            Évolution coûts (12 mois)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="month_iso" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(Number(v))}`} />
                <Tooltip
                  formatter={(v: number, name: string) => [formatChf(Number(v)), name.replace(/_cost_chf$/, "").toUpperCase()]}
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                />
                <Legend />
                <Bar dataKey="openai_cost_chf" stackId="a" name="OpenAI" fill="#10b981" />
                <Bar dataKey="resend_cost_chf" stackId="a" name="Resend" fill="#3b82f6" />
                <Bar dataKey="twilio_cost_chf" stackId="a" name="Twilio" fill="#ef4444" />
                <Bar dataKey="other_cost_chf"  stackId="a" name="Autres" fill="#94a3b8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Top tenants consommateurs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-amber-500" />
            Top tenants consommateurs — {periodRange.label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topTenants.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Aucun tenant n'a généré de coût sur cette période.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead className="text-right">OpenAI</TableHead>
                  <TableHead className="text-right">Resend</TableHead>
                  <TableHead className="text-right">Twilio</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Événements</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topTenants.map(t => (
                  <TableRow key={t.tenant_id}>
                    <TableCell>
                      <Link to={`/king/tenants/${t.tenant_id}`} className="font-medium hover:underline">
                        {t.tenant_name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right text-emerald-700">{formatChf(Number(t.openai_cost_chf))}</TableCell>
                    <TableCell className="text-right text-blue-700">{formatChf(Number(t.resend_cost_chf))}</TableCell>
                    <TableCell className="text-right text-red-700">{formatChf(Number(t.twilio_cost_chf))}</TableCell>
                    <TableCell className="text-right font-bold">{formatChf(Number(t.total_cost_chf))}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline">{Number(t.event_count).toLocaleString("fr-CH")}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Coûts calculés à l'usage : OpenAI ($2-$10/M tokens gpt-5), Resend ($0.0004/email), Twilio (CHF 0.10/SMS).
        Conversion USD→CHF : 0.88. Resend et Twilio à brancher (cron usage API à venir).
      </p>
    </div>
  );
}
