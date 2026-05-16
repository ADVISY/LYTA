/**
 * KingProductsByBranchCard
 * ========================
 * Distribution des produits actifs du catalogue par branche (LAMAL/LCA/...).
 * Pour piloter la santé du catalogue partenaires.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, GitBranch, AlertTriangle } from "lucide-react";

const BRANCH_LABELS: Record<string, string> = {
  AUTO: "Auto / Moto",
  LAMAL: "LAMal",
  LCA: "Complémentaire",
  PGM: "Perte de gain",
  ACCIDENT: "Accident",
  VIE: "Vie / Prévoyance",
  LPP: "2e pilier (LPP)",
  HYPO_CREDIT: "Hypothèque / Crédit",
  MENAGE_RC: "Ménage / RC",
  JURIDIQUE: "Juridique",
  VOYAGE: "Voyage",
  ENTREPRISE: "Entreprise",
  AUCUNE: "⚠️ Sans branche",
};

interface BranchRow {
  branch_code: string;
  total: number;
  system_count: number;
  tenant_count: number;
}

export function KingProductsByBranchCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["king-products-by-branch"],
    queryFn: async (): Promise<BranchRow[]> => {
      const { data, error } = await supabase.rpc("count_products_by_branch");
      if (error) throw error;
      return (data || []) as BranchRow[];
    },
    refetchInterval: 60_000,
  });

  const total = data?.reduce((sum, r) => sum + r.total, 0) || 0;
  const max = data?.reduce((m, r) => Math.max(m, r.total), 0) || 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-primary" />
          Produits par branche
          <span className="ml-auto text-sm font-normal text-muted-foreground">{total} actifs</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : data && data.length > 0 ? (
          <div className="space-y-2">
            {data.map(r => {
              const pct = (r.total / max) * 100;
              const isWarning = r.branch_code === "AUCUNE";
              return (
                <div key={r.branch_code} className="text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-medium ${isWarning ? "text-amber-700" : ""}`}>
                      {isWarning && <AlertTriangle className="inline h-3 w-3 mr-1" />}
                      {BRANCH_LABELS[r.branch_code] || r.branch_code}
                    </span>
                    <span className="text-muted-foreground">
                      <strong className="text-foreground">{r.total}</strong>
                      <span className="ml-1">({r.system_count} sys · {r.tenant_count} tenant)</span>
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${isWarning ? "bg-amber-500" : "bg-primary"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">Aucun produit actif.</p>
        )}
      </CardContent>
    </Card>
  );
}
