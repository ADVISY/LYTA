import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, DollarSign, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { PerformanceCard } from "./PerformanceCard";
import type { TeamPerformance } from "@/hooks/usePerformance";

interface TeamPerformanceCardProps {
  team: TeamPerformance;
}

export function TeamPerformanceCard({ team }: TeamPerformanceCardProps) {
  const [expanded, setExpanded] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-CH', { 
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0 
    }).format(value) + ' CHF';
  };

  return (
    <Card className="border-0 shadow-lg bg-white/80 backdrop-blur overflow-hidden">
      <CardHeader 
        className="cursor-pointer hover:bg-muted/20 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">Équipe {team.managerName}</CardTitle>
              <p className="text-sm text-muted-foreground">{team.teamMembers.length} membres</p>
            </div>
          </div>
          {expanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Team totals */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-r from-blue-50 to-blue-100/50 text-center">
            <p className="text-2xl font-bold">{team.totals.clientsCount}</p>
            <p className="text-xs text-muted-foreground">Clients</p>
          </div>
          <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-50 to-emerald-100/50 text-center">
            <p className="text-2xl font-bold">{team.totals.contractsCount}</p>
            <p className="text-xs text-muted-foreground">Contrats</p>
          </div>
          <div className="p-3 rounded-xl bg-gradient-to-r from-amber-50 to-amber-100/50 text-center">
            <p className="text-lg font-bold">{formatCurrency(team.totals.totalCommissions)}</p>
            <p className="text-xs text-muted-foreground">Commissions</p>
          </div>
          <div className="p-3 rounded-xl bg-gradient-to-r from-violet-50 to-violet-100/50 text-center">
            <p className="text-lg font-bold">{formatCurrency(team.totals.totalPremiumsMonthly)}</p>
            <p className="text-xs text-muted-foreground">Primes/mois</p>
          </div>
        </div>

        {/* Team members (expandable) */}
        {expanded && team.teamMembers.length > 0 && (
          <div className="pt-4 border-t border-border/50 space-y-4">
            <h4 className="text-sm font-semibold text-muted-foreground">Membres de l'équipe</h4>
            <div className="grid gap-4 md:grid-cols-2">
              {team.teamMembers.map(member => (
                <PerformanceCard key={member.id} data={member} showDetails={false} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
