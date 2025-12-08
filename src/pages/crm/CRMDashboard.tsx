import { useUserRole } from "@/hooks/useUserRole";
import { useClients } from "@/hooks/useClients";
import { usePolicies } from "@/hooks/usePolicies";
import { useCommissions } from "@/hooks/useCommissions";
import { usePerformance } from "@/hooks/usePerformance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, FileText, DollarSign, TrendingUp, Clock, FileCheck, ChevronRight, Loader2, AlertCircle, UserCheck, Building2, UsersRound, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemo } from "react";
import { PerformanceCard } from "@/components/crm/PerformanceCard";
import { TeamPerformanceCard } from "@/components/crm/TeamPerformanceCard";

export default function CRMDashboard() {
  const { role, isAdmin, isManager, isAgent, isPartner, isClient } = useUserRole();
  const { clients, loading: clientsLoading } = useClients();
  const { policies, loading: policiesLoading } = usePolicies();
  const { commissions, loading: commissionsLoading } = useCommissions();
  const { 
    loading: performanceLoading, 
    individualPerformance, 
    teamPerformance, 
    companyTotals,
    myPerformance,
    myTeam 
  } = usePerformance();

  const loading = clientsLoading || policiesLoading || commissionsLoading || performanceLoading;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-CH', { 
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0 
    }).format(value) + ' CHF';
  };

  // Recent activities based on real data
  const recentActivities = useMemo(() => {
    const activities: { icon: any; text: string; time: string; color: string }[] = [];
    
    const recentClients = [...clients]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 2);
    
    recentClients.forEach(client => {
      const date = new Date(client.created_at);
      const now = new Date();
      const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
      const timeStr = diffHours < 24 ? `Il y a ${diffHours}h` : `Il y a ${Math.floor(diffHours / 24)}j`;
      
      activities.push({
        icon: UserCheck,
        text: `Client ajouté: ${client.first_name || ''} ${client.last_name || ''}`.trim(),
        time: timeStr,
        color: "from-blue-500 to-indigo-600"
      });
    });

    const recentPolicies = [...policies]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 2);
    
    recentPolicies.forEach(policy => {
      const date = new Date(policy.created_at);
      const now = new Date();
      const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
      const timeStr = diffHours < 24 ? `Il y a ${diffHours}h` : `Il y a ${Math.floor(diffHours / 24)}j`;
      
      activities.push({
        icon: FileCheck,
        text: `Contrat créé: ${policy.policy_number || 'N/A'}`,
        time: timeStr,
        color: "from-emerald-500 to-teal-600"
      });
    });

    return activities.sort((a, b) => {
      const getHours = (str: string) => {
        const match = str.match(/(\d+)/);
        const num = match ? parseInt(match[1]) : 0;
        return str.includes('j') ? num * 24 : num;
      };
      return getHours(a.time) - getHours(b.time);
    }).slice(0, 4);
  }, [clients, policies]);

  // To do items
  const todoItems = useMemo(() => {
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const contractsToRenew = policies.filter(p => {
      if (!p.end_date) return false;
      const endDate = new Date(p.end_date);
      return endDate >= today && endDate <= thirtyDaysFromNow;
    }).length;

    return [
      { label: "Contrats à renouveler", count: contractsToRenew, color: "from-red-500 to-rose-600" },
      { label: "Contrats en attente", count: policies.filter(p => p.status === 'pending').length, color: "from-amber-500 to-orange-600" },
      { label: "Commissions en attente", count: commissions.filter(c => c.status === 'due' || c.status === 'pending').length, color: "from-blue-500 to-indigo-600" },
    ];
  }, [policies, commissions]);

  // Determine which performance view to show
  const showAdminView = isAdmin;
  const showManagerView = isManager && !isAdmin;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative">
        <div className="absolute -inset-4 bg-gradient-to-r from-primary/10 via-violet-500/5 to-transparent rounded-3xl blur-2xl" />
        <div className="relative flex items-start justify-between">
          <div>
            <div className="flex items-center gap-4 mb-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-violet-600 rounded-2xl blur-lg opacity-50" />
                <div className="relative p-3 rounded-2xl bg-gradient-to-br from-primary to-violet-600 shadow-xl">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
                  Tableau de bord
                </h1>
                <p className="text-muted-foreground">
                  {isAdmin && "Vue administrative complète"}
                  {isManager && !isAdmin && "Performance équipe et personnelle"}
                  {isAgent && "Mes performances"}
                  {isPartner && !isAdmin && !isManager && !isAgent && "Vue d'ensemble partenaire"}
                  {isClient && "Aperçu de vos contrats"}
                </p>
              </div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 backdrop-blur border border-primary/10 shadow-lg">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{new Date().toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Chargement des données...</span>
        </div>
      )}

      {!loading && (
        <>
          {/* Admin View */}
          {showAdminView && (
            <Tabs defaultValue="entreprise" className="space-y-6">
              <TabsList className="bg-white/80 backdrop-blur border shadow-sm">
                <TabsTrigger value="entreprise" className="gap-2">
                  <Building2 className="h-4 w-4" />
                  Entreprise
                </TabsTrigger>
                <TabsTrigger value="equipes" className="gap-2">
                  <UsersRound className="h-4 w-4" />
                  Par équipe
                </TabsTrigger>
                <TabsTrigger value="agents" className="gap-2">
                  <Users className="h-4 w-4" />
                  Par agent
                </TabsTrigger>
                <TabsTrigger value="personnel" className="gap-2">
                  <User className="h-4 w-4" />
                  Personnel
                </TabsTrigger>
              </TabsList>

              {/* Company-wide view */}
              <TabsContent value="entreprise" className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3">
                        <Users className="h-8 w-8 opacity-80" />
                        <div>
                          <p className="text-3xl font-bold">{companyTotals.clientsCount}</p>
                          <p className="text-sm opacity-80">Clients ({companyTotals.activeClients} actifs)</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3">
                        <FileText className="h-8 w-8 opacity-80" />
                        <div>
                          <p className="text-3xl font-bold">{companyTotals.contractsCount}</p>
                          <p className="text-sm opacity-80">Contrats ({companyTotals.activeContracts} actifs)</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3">
                        <DollarSign className="h-8 w-8 opacity-80" />
                        <div>
                          <p className="text-2xl font-bold">{formatCurrency(companyTotals.totalCommissions)}</p>
                          <p className="text-sm opacity-80">Commissions totales</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3">
                        <TrendingUp className="h-8 w-8 opacity-80" />
                        <div>
                          <p className="text-2xl font-bold">{formatCurrency(companyTotals.totalPremiumsMonthly)}</p>
                          <p className="text-sm opacity-80">Primes mensuelles</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="border-0 shadow-lg bg-white/80 backdrop-blur">
                    <CardContent className="p-6 text-center">
                      <p className="text-4xl font-bold text-primary">{companyTotals.collaboratorsCount}</p>
                      <p className="text-sm text-muted-foreground">Collaborateurs</p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-lg bg-white/80 backdrop-blur">
                    <CardContent className="p-6 text-center">
                      <p className="text-4xl font-bold text-emerald-600">{formatCurrency(companyTotals.paidCommissions)}</p>
                      <p className="text-sm text-muted-foreground">Commissions payées</p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-lg bg-white/80 backdrop-blur">
                    <CardContent className="p-6 text-center">
                      <p className="text-4xl font-bold text-amber-600">{formatCurrency(companyTotals.pendingCommissions)}</p>
                      <p className="text-sm text-muted-foreground">Commissions en attente</p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Teams view */}
              <TabsContent value="equipes" className="space-y-6">
                {teamPerformance.length === 0 ? (
                  <Card className="border-0 shadow-lg bg-white/80 backdrop-blur">
                    <CardContent className="p-8 text-center">
                      <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">Aucune équipe configurée</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-6">
                    {teamPerformance.map(team => (
                      <TeamPerformanceCard key={team.managerId} team={team} />
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Individual agents view */}
              <TabsContent value="agents" className="space-y-6">
                {individualPerformance.length === 0 ? (
                  <Card className="border-0 shadow-lg bg-white/80 backdrop-blur">
                    <CardContent className="p-8 text-center">
                      <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">Aucun agent trouvé</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {individualPerformance.map(agent => (
                      <PerformanceCard key={agent.id} data={agent} />
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Personal view */}
              <TabsContent value="personnel" className="space-y-6">
                {myPerformance ? (
                  <div className="max-w-md">
                    <PerformanceCard data={myPerformance} />
                  </div>
                ) : (
                  <Card className="border-0 shadow-lg bg-white/80 backdrop-blur">
                    <CardContent className="p-8 text-center">
                      <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">Aucune donnée personnelle disponible</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          )}

          {/* Manager View */}
          {showManagerView && (
            <Tabs defaultValue="equipe" className="space-y-6">
              <TabsList className="bg-white/80 backdrop-blur border shadow-sm">
                <TabsTrigger value="equipe" className="gap-2">
                  <UsersRound className="h-4 w-4" />
                  Mon équipe
                </TabsTrigger>
                <TabsTrigger value="personnel" className="gap-2">
                  <User className="h-4 w-4" />
                  Personnel
                </TabsTrigger>
              </TabsList>

              <TabsContent value="equipe" className="space-y-6">
                {myTeam ? (
                  <TeamPerformanceCard team={myTeam} />
                ) : (
                  <Card className="border-0 shadow-lg bg-white/80 backdrop-blur">
                    <CardContent className="p-8 text-center">
                      <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">Aucun membre dans votre équipe</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="personnel" className="space-y-6">
                {myPerformance ? (
                  <div className="max-w-md">
                    <PerformanceCard data={myPerformance} />
                  </div>
                ) : (
                  <Card className="border-0 shadow-lg bg-white/80 backdrop-blur">
                    <CardContent className="p-8 text-center">
                      <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">Aucune donnée personnelle disponible</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          )}

          {/* Agent/Partner/Client View - Simple KPIs + Activity */}
          {!showAdminView && !showManagerView && (
            <>
              {/* KPI Cards */}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card className="group relative overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 bg-white/80 backdrop-blur">
                  <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full opacity-20 blur-3xl bg-gradient-to-br from-blue-500 to-indigo-600 group-hover:opacity-40 group-hover:scale-150 transition-all duration-700" />
                  <CardContent className="p-6 relative">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg w-fit mb-4">
                      <Users className="h-5 w-5 text-white" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">Clients</p>
                    <p className="text-3xl font-bold">{companyTotals.clientsCount}</p>
                    <p className="text-xs text-muted-foreground">{companyTotals.activeClients} actifs</p>
                  </CardContent>
                </Card>

                <Card className="group relative overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 bg-white/80 backdrop-blur">
                  <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full opacity-20 blur-3xl bg-gradient-to-br from-emerald-500 to-teal-600 group-hover:opacity-40 group-hover:scale-150 transition-all duration-700" />
                  <CardContent className="p-6 relative">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg w-fit mb-4">
                      <FileText className="h-5 w-5 text-white" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">Contrats</p>
                    <p className="text-3xl font-bold">{companyTotals.contractsCount}</p>
                    <p className="text-xs text-muted-foreground">{companyTotals.activeContracts} actifs</p>
                  </CardContent>
                </Card>

                {(isPartner || isAgent) && (
                  <>
                    <Card className="group relative overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 bg-white/80 backdrop-blur">
                      <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full opacity-20 blur-3xl bg-gradient-to-br from-amber-500 to-orange-600 group-hover:opacity-40 group-hover:scale-150 transition-all duration-700" />
                      <CardContent className="p-6 relative">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg w-fit mb-4">
                          <DollarSign className="h-5 w-5 text-white" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">Commissions</p>
                        <p className="text-3xl font-bold">{formatCurrency(companyTotals.totalCommissions)}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(companyTotals.pendingCommissions)} en attente</p>
                      </CardContent>
                    </Card>

                    <Card className="group relative overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 bg-white/80 backdrop-blur">
                      <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full opacity-20 blur-3xl bg-gradient-to-br from-violet-500 to-purple-600 group-hover:opacity-40 group-hover:scale-150 transition-all duration-700" />
                      <CardContent className="p-6 relative">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg w-fit mb-4">
                          <TrendingUp className="h-5 w-5 text-white" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">Primes mensuelles</p>
                        <p className="text-3xl font-bold">{formatCurrency(companyTotals.totalPremiumsMonthly)}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(companyTotals.totalPremiumsYearly)} annuelles</p>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            </>
          )}

          {/* Activity and To-Do Section (for all roles) */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur overflow-hidden">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold mb-6">Activité récente</h3>
                {recentActivities.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">Aucune activité récente</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentActivities.map((activity, i) => (
                      <div 
                        key={i} 
                        className="group flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-muted/50 to-transparent hover:from-primary/5 hover:to-transparent transition-all duration-300 cursor-pointer"
                      >
                        <div className={cn("p-2.5 rounded-xl bg-gradient-to-br shadow-md", activity.color)}>
                          <activity.icon className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{activity.text}</p>
                          <p className="text-xs text-muted-foreground">{activity.time}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold">À faire</h3>
                  <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
                    {todoItems.reduce((acc, item) => acc + item.count, 0)} total
                  </span>
                </div>
                <div className="space-y-4">
                  {todoItems.map((item, i) => (
                    <div 
                      key={i}
                      className="group flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-muted/50 to-transparent hover:from-primary/5 hover:to-transparent transition-all duration-300 cursor-pointer"
                    >
                      <span className="text-sm font-medium">{item.label}</span>
                      <div className="flex items-center gap-3">
                        <span className={cn("px-3 py-1.5 rounded-full text-white text-sm font-bold shadow-md bg-gradient-to-r", item.color)}>
                          {item.count}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
