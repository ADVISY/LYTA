import { useUserRole } from "@/hooks/useUserRole";
import { useClients } from "@/hooks/useClients";
import { usePolicies } from "@/hooks/usePolicies";
import { useCommissions } from "@/hooks/useCommissions";
import { usePerformance } from "@/hooks/usePerformance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { 
  Users, FileText, DollarSign, TrendingUp, 
  MessageSquare, Loader2, BarChart3
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function CRMDashboard() {
  const { role, isAdmin, isManager, isAgent, isPartner, isClient } = useUserRole();
  const { clients, loading: clientsLoading } = useClients();
  const { policies, loading: policiesLoading } = usePolicies();
  const { commissions, loading: commissionsLoading } = useCommissions();
  const { loading: performanceLoading, companyTotals } = usePerformance();

  const [showMyContracts, setShowMyContracts] = useState(false);

  const loading = clientsLoading || policiesLoading || commissionsLoading || performanceLoading;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-CH', { 
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0 
    }).format(value);
  };

  // All CRM activities for admin (contracts, clients, commissions)
  const recentActivities = useMemo(() => {
    const activities: { 
      id: string;
      type: 'contract' | 'client' | 'commission';
      title: string;
      description: string;
      date: Date;
      color: string;
      icon: 'contract' | 'client' | 'commission';
    }[] = [];

    // Add policies/contracts
    policies.forEach(policy => {
      const client = clients.find(c => c.id === policy.client_id);
      const clientName = client ? `${client.first_name || ''} ${client.last_name || ''}`.trim() : 'Client';
      activities.push({
        id: `policy-${policy.id}`,
        type: 'contract',
        title: 'Nouveau contrat',
        description: `${clientName} - ${policy.product_type || policy.company_name || 'Assurance'}`,
        date: new Date(policy.created_at),
        color: 'emerald',
        icon: 'contract',
      });
    });

    // Add clients
    clients.forEach(client => {
      const name = `${client.first_name || ''} ${client.last_name || ''}`.trim() || client.company_name || 'Client';
      const typeLabel = client.type_adresse === 'collaborateur' ? 'Collaborateur' : 
                        client.type_adresse === 'partenaire' ? 'Partenaire' : 'Client';
      activities.push({
        id: `client-${client.id}`,
        type: 'client',
        title: `Nouveau ${typeLabel.toLowerCase()}`,
        description: name,
        date: new Date(client.created_at),
        color: 'blue',
        icon: 'client',
      });
    });

    // Add commissions
    commissions.forEach(commission => {
      const policy = policies.find(p => p.id === commission.policy_id);
      const client = policy ? clients.find(c => c.id === policy.client_id) : null;
      const clientName = client ? `${client.first_name || ''} ${client.last_name || ''}`.trim() : 'Client';
      activities.push({
        id: `commission-${commission.id}`,
        type: 'commission',
        title: 'Commission enregistrée',
        description: `${clientName} - ${commission.amount?.toFixed(2) || '0'} CHF`,
        date: new Date(commission.created_at),
        color: 'amber',
        icon: 'commission',
      });
    });

    return activities
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 50);
  }, [policies, clients, commissions]);

  // Group activities by date
  const groupedActivities = useMemo(() => {
    const groups: { [key: string]: typeof recentActivities } = {};
    
    recentActivities.forEach(activity => {
      const dateKey = format(activity.date, 'dd.MM.yyyy');
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(activity);
    });

    return Object.entries(groups).map(([date, items]) => ({
      date,
      items,
    }));
  }, [recentActivities]);

  // Monthly contracts data for chart
  const monthlyContracts = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 
                    'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    
    const data = months.map((month) => ({
      month,
      value: 0,
    }));

    policies.forEach(p => {
      const date = new Date(p.created_at);
      if (date.getFullYear() === currentYear) {
        data[date.getMonth()].value += 1;
      }
    });

    return data;
  }, [policies]);

  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tableau de bord</h1>
            <p className="text-sm text-muted-foreground">
              {format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}
            </p>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Chargement...</span>
        </div>
      )}

      {!loading && (
        <>
          {/* Main 3-column layout */}
          <div className={cn("grid gap-6", isAdmin ? "lg:grid-cols-[1fr_400px]" : "")}>
            
            {/* Main Column - Chart */}
            <Card className="border shadow-sm bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-emerald-500" />
                    <CardTitle className="text-sm font-semibold">Statistiques des contrats signés</CardTitle>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-xs font-medium">
                      {currentYear}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Mes contrats</span>
                    <Switch 
                      checked={showMyContracts} 
                      onCheckedChange={setShowMyContracts}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyContracts} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="month" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        }}
                        labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                        formatter={(value: number) => [`${value} Contrats`, `Signé ${currentYear}`]}
                        cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                      />
                      <Bar 
                        dataKey="value" 
                        fill="hsl(142 76% 45%)"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={50}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Summary stats below chart */}
                <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t">
                  <div className="text-center p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                    <Users className="h-5 w-5 mx-auto mb-1 opacity-80" />
                    <p className="text-lg font-bold">{companyTotals.clientsCount}</p>
                    <p className="text-[10px] opacity-80">Clients</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
                    <FileText className="h-5 w-5 mx-auto mb-1 opacity-80" />
                    <p className="text-lg font-bold">{companyTotals.contractsCount}</p>
                    <p className="text-[10px] opacity-80">Contrats</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white">
                    <DollarSign className="h-5 w-5 mx-auto mb-1 opacity-80" />
                    <p className="text-lg font-bold">{formatCurrency(companyTotals.totalCommissions)}</p>
                    <p className="text-[10px] opacity-80">Commissions</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white">
                    <TrendingUp className="h-5 w-5 mx-auto mb-1 opacity-80" />
                    <p className="text-lg font-bold">{formatCurrency(companyTotals.totalPremiumsMonthly)}</p>
                    <p className="text-[10px] opacity-80">Primes/mois</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Right Column - Recent Activity (Admin only) */}
            {isAdmin && (
              <Card className="border shadow-sm bg-card">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-blue-500" />
                    <CardTitle className="text-sm font-semibold">Dernières nouvelles</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                    {groupedActivities.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Aucune activité récente
                      </p>
                    ) : (
                      groupedActivities.map((group) => (
                        <div key={group.date}>
                          <p className="text-xs font-semibold text-muted-foreground mb-2">{group.date}</p>
                          <div className="space-y-2">
                            {group.items.map((activity) => {
                              const colorClasses = {
                                emerald: { border: 'border-emerald-500', bg: 'bg-emerald-100', text: 'text-emerald-600', title: 'text-emerald-700' },
                                blue: { border: 'border-blue-500', bg: 'bg-blue-100', text: 'text-blue-600', title: 'text-blue-700' },
                                amber: { border: 'border-amber-500', bg: 'bg-amber-100', text: 'text-amber-600', title: 'text-amber-700' },
                              };
                              const colors = colorClasses[activity.color as keyof typeof colorClasses] || colorClasses.emerald;
                              const IconComponent = activity.icon === 'contract' ? FileText : 
                                                    activity.icon === 'client' ? Users : DollarSign;
                              
                              return (
                                <div 
                                  key={activity.id}
                                  className={cn("p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border-l-4", colors.border)}
                                >
                                  <div className="flex items-start gap-2">
                                    <div className={cn("p-1.5 rounded-md flex-shrink-0", colors.bg)}>
                                      <IconComponent className={cn("h-3.5 w-3.5", colors.text)} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-0.5">
                                        <p className={cn("text-xs font-semibold", colors.title)}>{activity.title}</p>
                                        <span className="text-[10px] text-muted-foreground">
                                          {format(activity.date, "HH:mm")}
                                        </span>
                                      </div>
                                      <p className="text-sm truncate">{activity.description}</p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
