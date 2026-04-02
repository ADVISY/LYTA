import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Users, FileText, DollarSign, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PerformanceData } from "@/hooks/usePerformance";

interface PerformanceCardProps {
  data: PerformanceData;
  showDetails?: boolean;
}

export function PerformanceCard({ data, showDetails = true }: PerformanceCardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-CH', { 
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0 
    }).format(value) + ' CHF';
  };

  return (
    <Card className="border-0 shadow-lg bg-white/80 backdrop-blur hover:shadow-xl transition-all duration-300">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">{data.name}</CardTitle>
          <span className={cn(
            "px-2 py-1 rounded-full text-xs font-medium",
            data.role === 'manager' 
              ? "bg-violet-100 text-violet-700" 
              : "bg-blue-100 text-blue-700"
          )}>
            {data.role === 'manager' ? 'Manager' : 'Agent'}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-blue-50 to-blue-100/50">
            <div className="p-2 rounded-lg bg-blue-500 text-white">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.clientsCount}</p>
              <p className="text-xs text-muted-foreground">Clients</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-emerald-50 to-emerald-100/50">
            <div className="p-2 rounded-lg bg-emerald-500 text-white">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.contractsCount}</p>
              <p className="text-xs text-muted-foreground">Contrats</p>
            </div>
          </div>
        </div>

        {showDetails && (
          <>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-amber-50 to-amber-100/50">
              <div className="p-2 rounded-lg bg-amber-500 text-white">
                <DollarSign className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-xl font-bold">{formatCurrency(data.totalCommissions)}</p>
                <p className="text-xs text-muted-foreground">
                  Commissions ({formatCurrency(data.paidCommissions)} payées)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-violet-50 to-violet-100/50">
              <div className="p-2 rounded-lg bg-violet-500 text-white">
                <Target className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-xl font-bold">{data.conversionRate}%</p>
                  {data.conversionRate >= 50 ? (
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Taux de conversion</p>
              </div>
            </div>

            <div className="pt-2 border-t border-border/50">
              <p className="text-sm text-muted-foreground">
                Primes mensuelles: <span className="font-semibold text-foreground">{formatCurrency(data.totalPremiumsMonthly)}</span>
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
