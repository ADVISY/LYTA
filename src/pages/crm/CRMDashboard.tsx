import { useUserRole } from "@/hooks/useUserRole";
import { useClients } from "@/hooks/useClients";
import { usePolicies } from "@/hooks/usePolicies";
import { useCommissions } from "@/hooks/useCommissions";
import { usePerformance } from "@/hooks/usePerformance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { 
  Users, FileText, DollarSign, TrendingUp, 
  MessageSquare, Loader2, BarChart3, Heart, Shield
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
  Legend,
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

  // Monthly LCA vs VIE contracts data
  const monthlyLcaVie = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 
                    'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    
    const data = months.map((month) => ({
      month,
      lca: 0,
      vie: 0,
    }));

    policies.forEach(p => {
      const date = new Date(p.created_at);
      if (date.getFullYear() === currentYear) {
        const productType = (p.product_type || '').toLowerCase();
        // LCA = complementary health (Maladie complémentaire)
        if (productType.includes('lca') || productType.includes('complémentaire') || productType.includes('maladie')) {
          data[date.getMonth()].lca += 1;
        }
        // VIE = 3e pilier / life insurance
        if (productType.includes('vie') || productType.includes('3') || productType.includes('pilier')) {
          data[date.getMonth()].vie += 1;
        }
      }
    });

    return data;
  }, [policies]);

  // Contracts by manager/team
  const contractsByManager = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    
    // Get all managers (collaborators who have other collaborators assigned to them)
    const managers = clients.filter(c => c.type_adresse === 'collaborateur' && c.manager_id === null);
    
    // Get all collaborators with their managers
    const collaborators = clients.filter(c => c.type_adresse === 'collaborateur');
    
    // Build manager → team members map
    const managerTeams: { [managerId: string]: string[] } = {};
    managers.forEach(m => {
      managerTeams[m.id] = [m.id]; // include manager themselves
    });
    collaborators.forEach(c => {
      if (c.manager_id && managerTeams[c.manager_id]) {
        managerTeams[c.manager_id].push(c.id);
      }
    });

    // Count contracts per manager/team
    const result = managers.map(manager => {
      const teamMemberIds = managerTeams[manager.id] || [manager.id];
      
      let monthCount = 0;
      let yearCount = 0;
      
      policies.forEach(p => {
        const policyClient = clients.find(c => c.id === p.client_id);
        // Check if the policy's assigned agent is in this manager's team
        if (policyClient?.assigned_agent_id && teamMemberIds.includes(policyClient.assigned_agent_id)) {
          const date = new Date(p.created_at);
          if (date.getFullYear() === currentYear) {
            yearCount++;
            if (date.getMonth() === currentMonth) {
              monthCount++;
            }
          }
        }
      });

      return {
        name: `${manager.first_name || ''} ${manager.last_name || ''}`.trim() || 'Manager',
        mois: monthCount,
        annee: yearCount,
      };
    }).filter(m => m.mois > 0 || m.annee > 0);

    return result;
  }, [clients, policies]);

  // Financial summary
  const financialSummary = useMemo(() => {
    const collaborators = clients.filter(c => c.type_adresse === 'collaborateur');
    
    // Total commissions received (CA)
    const totalCommissions = commissions.reduce((sum, c) => sum + (c.amount || 0), 0);
    
    // Total salaries
    const totalSalaries = collaborators.reduce((sum, c) => sum + (c.fixed_salary || 0), 0);
    
    // Social charges (Swiss rates: AVS 5.05%, AC 1.1%, LPP ~7%, AANP 0.5% = ~13.65%)
    const socialChargesRate = 0.1365;
    const socialCharges = totalSalaries * socialChargesRate;
    
    // Total charges
    const totalCharges = totalSalaries + socialCharges;
    
    // Benefit = CA - Charges
    const benefit = totalCommissions - totalCharges;

    return {
      ca: totalCommissions,
      salaries: totalSalaries,
      socialCharges,
      totalCharges,
      benefit,
    };
  }, [clients, commissions]);

  const currentYear = new Date().getFullYear();
  const currentMonthName = format(new Date(), 'MMMM yyyy', { locale: fr });

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
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          {/* Main Column - Charts */}
          <div className="space-y-6">
            {/* Main Chart - LCA vs VIE with financial info */}
            <Card className="border shadow-sm bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm font-semibold">Affaires LCA vs VIE</CardTitle>
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium">
                      {currentYear}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-rose-500" />
                      <span>LCA: <strong>{monthlyLcaVie.reduce((s, m) => s + m.lca, 0)}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-blue-500" />
                      <span>VIE: <strong>{monthlyLcaVie.reduce((s, m) => s + m.vie, 0)}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-emerald-500" />
                      <span>Total: <strong>{policies.length}</strong></span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyLcaVie} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
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
                        cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                      />
                      <Legend 
                        wrapperStyle={{ paddingTop: '10px' }}
                        formatter={(value) => <span className="text-xs">{value === 'lca' ? 'Maladie (LCA)' : '3e Pilier (VIE)'}</span>}
                      />
                      <Bar 
                        dataKey="lca" 
                        name="lca"
                        fill="hsl(340 82% 52%)"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={40}
                      />
                      <Bar 
                        dataKey="vie" 
                        name="vie"
                        fill="hsl(217 91% 60%)"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={40}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Financial & Stats Summary below chart */}
                <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mt-4 pt-4 border-t">
                  <div className="text-center p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
                    <p className="text-[10px] opacity-80">CA</p>
                    <p className="text-lg font-bold">{formatCurrency(financialSummary.ca)}</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                    <p className="text-[10px] opacity-80">Salaires</p>
                    <p className="text-lg font-bold">{formatCurrency(financialSummary.salaries)}</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white">
                    <p className="text-[10px] opacity-80">Charges</p>
                    <p className="text-lg font-bold">{formatCurrency(financialSummary.socialCharges)}</p>
                  </div>
                  <div className={cn(
                    "text-center p-3 rounded-xl text-white",
                    financialSummary.benefit >= 0 
                      ? "bg-gradient-to-br from-green-500 to-green-600" 
                      : "bg-gradient-to-br from-red-500 to-red-600"
                  )}>
                    <p className="text-[10px] opacity-80">Bénéfice</p>
                    <p className="text-lg font-bold">{formatCurrency(financialSummary.benefit)}</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-muted/50">
                    <p className="text-[10px] text-muted-foreground">Clients</p>
                    <p className="text-lg font-bold">{companyTotals.clientsCount}</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-muted/50">
                    <p className="text-[10px] text-muted-foreground">Primes/mois</p>
                    <p className="text-lg font-bold">{formatCurrency(companyTotals.totalPremiumsMonthly)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contracts by Manager/Team */}
            <Card className="border shadow-sm bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-violet-500" />
                  <CardTitle className="text-sm font-semibold">Contrats par équipe</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {contractsByManager.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Aucune donnée d'équipe disponible
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2 text-xs font-medium text-muted-foreground pb-2 border-b">
                      <span>Manager</span>
                      <span className="text-center">Ce mois</span>
                      <span className="text-center">Cette année</span>
                    </div>
                    {contractsByManager.map((manager, i) => (
                      <div key={i} className="grid grid-cols-3 gap-2 items-center py-2 hover:bg-muted/30 rounded-lg px-2 transition-colors">
                        <span className="text-sm font-medium truncate">{manager.name}</span>
                        <div className="text-center">
                          <span className="inline-flex items-center justify-center w-10 h-7 rounded-lg bg-violet-100 text-violet-700 font-bold text-sm">
                            {manager.mois}
                          </span>
                        </div>
                        <div className="text-center">
                          <span className="inline-flex items-center justify-center w-10 h-7 rounded-lg bg-emerald-100 text-emerald-700 font-bold text-sm">
                            {manager.annee}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Recent Activity */}
            <Card className="border shadow-sm bg-card h-fit">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-blue-500" />
                  <CardTitle className="text-sm font-semibold">Dernières nouvelles</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
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
        </div>
      )}
    </div>
  );
}
