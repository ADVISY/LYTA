/**
 * TenantQuotaWidget — affiche l'usage live des quotas d'un tenant
 * Insérable dans CRMParametres (onglet Abonnement) ou ailleurs.
 */
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, MessageSquare, Mail, ArrowUpRight, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";

interface QuotaRow {
  resource_type: string;
  used: number;
  monthly_limit: number;
  pct: number;
  overage_units: number;
  auto_overage_enabled: boolean;
}

const RESOURCE_META: Record<string, { label: string; icon: any; color: string }> = {
  ai_docs: { label: "Smartflow scans", icon: Sparkles, color: "from-cyan-500 to-blue-600" },
  sms:     { label: "SMS campagnes",   icon: MessageSquare, color: "from-emerald-500 to-emerald-600" },
  email:   { label: "Emails marketing",icon: Mail, color: "from-violet-500 to-purple-600" },
};

export function TenantQuotaWidget() {
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const { data: quotas = [], isLoading } = useQuery({
    queryKey: ["tenant-quota-usage", tenant?.id],
    queryFn: async (): Promise<QuotaRow[]> => {
      const { data, error } = await supabase.rpc("get_tenant_quota_usage", { p_tenant_id: tenant?.id });
      if (error) throw error;
      return (data || []) as QuotaRow[];
    },
    enabled: !!tenant?.id,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <Card><CardContent className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></CardContent></Card>
    );
  }

  // Si TOUS les quotas sont effectivement illimités (>= 100k = limite arbitraire
  // pour Advisy & autres cabinets internes), on masque le widget — pas besoin
  // d'afficher des barres de progression à 0.001% qui ne disent rien d'utile.
  const allUnlimited = quotas.length > 0 && quotas.every(q => (q.monthly_limit || 0) >= 100_000);
  if (allUnlimited) {
    return null;
  }

  const overageAny = quotas.some(q => q.overage_units > 0);
  const autoOverage = quotas[0]?.auto_overage_enabled ?? false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Consommation du mois</span>
          {overageAny && (
            <Badge className={autoOverage ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}>
              {autoOverage ? "Overage facturé" : "Quota dépassé"}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {quotas.map(q => {
          const meta = RESOURCE_META[q.resource_type];
          if (!meta) return null;
          const Icon = meta.icon;
          const isUnlimited = q.monthly_limit === 0;
          const isOver = q.pct >= 100;
          const isWarn = q.pct >= 80 && q.pct < 100;
          const isNoAccess = q.monthly_limit === 0 && q.used === 0;
          const widthPct = Math.min(q.pct, 100);

          return (
            <div key={q.resource_type} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{meta.label}</span>
                  {isOver && <Badge variant={autoOverage ? "outline" : "destructive"} className="text-xs">
                    {autoOverage ? `+${q.overage_units} hors quota` : "Bloqué"}
                  </Badge>}
                  {isWarn && <Badge className="bg-amber-100 text-amber-800 text-xs">⚠️ {q.pct}%</Badge>}
                </div>
                <span className={`font-mono text-xs ${isOver ? "text-red-700 font-bold" : "text-muted-foreground"}`}>
                  {isNoAccess ? "Non inclus dans ton plan" : `${q.used} / ${q.monthly_limit}`}
                </span>
              </div>
              {!isNoAccess && (
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      isOver ? "bg-red-500" : isWarn ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}

        {overageAny && (
          <div className={`p-3 rounded-lg border ${autoOverage ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"}`}>
            {autoOverage ? (
              <p className="text-xs text-amber-900 flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span><strong>Overage automatique activé</strong> — le dépassement sera ajouté à ta prochaine facture Stripe (CHF 0.20 / SMS ou scan supplémentaire).</span>
              </p>
            ) : (
              <p className="text-xs text-red-900 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span><strong>Quota atteint</strong> — passe à un plan supérieur pour continuer.</span>
              </p>
            )}
            <Button
              size="sm"
              variant="default"
              className="mt-2 gap-1.5"
              onClick={() => navigate("/crm/abonnement")}
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              Voir mon abonnement
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
