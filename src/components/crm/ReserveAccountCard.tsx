import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, TrendingUp, Calendar, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface ReserveEntry {
  month: string;
  year: number;
  commissionAmount: number;
  reserveAmount: number;
  cumulativeReserve: number;
}

interface ReserveAccountCardProps {
  clientId: string;
  reserveRate: number;
}

export default function ReserveAccountCard({ clientId, reserveRate }: ReserveAccountCardProps) {
  const [entries, setEntries] = useState<ReserveEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    fetchReserveData();
  }, [clientId]);

  const fetchReserveData = async () => {
    try {
      setLoading(true);
      
      // Fetch commission parts for this collaborator
      const { data: parts, error } = await supabase
        .from('commission_part_agent')
        .select(`
          *,
          commission:commissions!commission_id (
            id,
            created_at,
            amount,
            date
          )
        `)
        .eq('agent_id', clientId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group by month and calculate reserve
      const monthlyData: Record<string, { total: number; reserve: number }> = {};
      
      (parts || []).forEach((part: any) => {
        if (part.commission) {
          const date = new Date(part.commission.date || part.commission.created_at);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          
          if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = { total: 0, reserve: 0 };
          }
          
          const amount = Number(part.amount) || 0;
          const reserveAmount = (amount * reserveRate) / 100;
          
          monthlyData[monthKey].total += amount;
          monthlyData[monthKey].reserve += reserveAmount;
        }
      });

      // Convert to entries with cumulative
      let cumulative = 0;
      const sortedKeys = Object.keys(monthlyData).sort();
      const calculatedEntries: ReserveEntry[] = sortedKeys.map(key => {
        const [year, month] = key.split('-');
        const data = monthlyData[key];
        cumulative += data.reserve;
        
        return {
          month: format(new Date(parseInt(year), parseInt(month) - 1), 'MMMM', { locale: fr }),
          year: parseInt(year),
          commissionAmount: data.total,
          reserveAmount: data.reserve,
          cumulativeReserve: cumulative
        };
      });

      setEntries(calculatedEntries);
    } catch (error) {
      console.error('Error fetching reserve data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF' }).format(amount);
  };

  const totalReserve = useMemo(() => {
    return entries.length > 0 ? entries[entries.length - 1].cumulativeReserve : 0;
  }, [entries]);

  const currentYearReserve = useMemo(() => {
    return entries
      .filter(e => e.year === currentYear)
      .reduce((sum, e) => sum + e.reserveAmount, 0);
  }, [entries, currentYear]);

  if (loading) {
    return (
      <div className="mt-6 p-4 bg-muted/50 rounded-xl animate-pulse">
        <div className="h-6 w-48 bg-muted rounded mb-4" />
        <div className="h-24 bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <h4 className="font-semibold flex items-center gap-2">
        <Wallet className="h-5 w-5 text-orange-600" />
        Compte de réserve
      </h4>
      
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-orange-100 to-orange-50 p-4 rounded-xl border border-orange-200">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-orange-600" />
            <p className="text-sm text-orange-700">Réserve totale</p>
          </div>
          <p className="text-2xl font-bold text-orange-700">{formatCurrency(totalReserve)}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-100 to-blue-50 p-4 rounded-xl border border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-4 w-4 text-blue-600" />
            <p className="text-sm text-blue-700">Réserve {currentYear}</p>
          </div>
          <p className="text-2xl font-bold text-blue-700">{formatCurrency(currentYearReserve)}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-100 to-purple-50 p-4 rounded-xl border border-purple-200">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-purple-600" />
            <p className="text-sm text-purple-700">Taux de réserve</p>
          </div>
          <p className="text-2xl font-bold text-purple-700">{reserveRate}%</p>
        </div>
      </div>

      {/* Monthly breakdown */}
      {entries.length > 0 && (
        <Card className="border-orange-200">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">Historique mensuel {currentYear}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {entries
                .filter(e => e.year === currentYear)
                .reverse()
                .map((entry, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="capitalize">{entry.month}</Badge>
                      <span className="text-sm text-muted-foreground">
                        Commissions: {formatCurrency(entry.commissionAmount)}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-orange-600">+{formatCurrency(entry.reserveAmount)}</p>
                      <p className="text-xs text-muted-foreground">Cumul: {formatCurrency(entry.cumulativeReserve)}</p>
                    </div>
                  </div>
                ))}
              {entries.filter(e => e.year === currentYear).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucune commission enregistrée cette année
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
