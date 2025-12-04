import { useUserRole } from "@/hooks/useUserRole";
import { useClients } from "@/hooks/useClients";
import { usePolicies } from "@/hooks/usePolicies";
import { useCommissions } from "@/hooks/useCommissions";
import { Card, CardContent } from "@/components/ui/card";
import { Users, FileText, DollarSign, TrendingUp, ArrowUpRight, Sparkles, Clock, FileCheck, Bell, ChevronRight, Loader2, AlertCircle, Calendar, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

export default function CRMDashboard() {
  const { role, isAdmin, isPartner, isClient } = useUserRole();
  const { clients, loading: clientsLoading } = useClients();
  const { policies, loading: policiesLoading } = usePolicies();
  const { commissions, loading: commissionsLoading } = useCommissions();

  const loading = clientsLoading || policiesLoading || commissionsLoading;

  // Calculate real statistics
  const stats = useMemo(() => {
    const activeClients = clients.filter(c => c.status === 'actif').length;
    const totalClients = clients.length;
    
    const activeContracts = policies.filter(p => p.status === 'active').length;
    const pendingContracts = policies.filter(p => p.status === 'pending').length;
    const totalContracts = policies.length;
    
    const totalCommissions = commissions.reduce((sum, c) => sum + (c.amount || 0), 0);
    const pendingCommissions = commissions.filter(c => c.status === 'due' || c.status === 'pending').reduce((sum, c) => sum + (c.amount || 0), 0);
    const paidCommissions = commissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + (c.amount || 0), 0);
    
    const monthlyPremiums = policies.reduce((sum, p) => sum + (p.premium_monthly || 0), 0);
    const yearlyPremiums = policies.reduce((sum, p) => sum + (p.premium_yearly || 0), 0);

    // Get contracts to renew (ending within 30 days)
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const contractsToRenew = policies.filter(p => {
      if (!p.end_date) return false;
      const endDate = new Date(p.end_date);
      return endDate >= today && endDate <= thirtyDaysFromNow;
    }).length;

    return {
      activeClients,
      totalClients,
      activeContracts,
      pendingContracts,
      totalContracts,
      totalCommissions,
      pendingCommissions,
      paidCommissions,
      monthlyPremiums,
      yearlyPremiums,
      contractsToRenew,
    };
  }, [clients, policies, commissions]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-CH', { 
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0 
    }).format(value) + ' CHF';
  };

  const kpiCards = [
    {
      title: "Clients",
      value: loading ? "..." : stats.totalClients.toString(),
      subtitle: loading ? "" : `${stats.activeClients} actifs`,
      icon: Users,
      gradient: "from-blue-500 to-indigo-600",
    },
    {
      title: "Contrats",
      value: loading ? "..." : stats.totalContracts.toString(),
      subtitle: loading ? "" : `${stats.activeContracts} actifs, ${stats.pendingContracts} en attente`,
      icon: FileText,
      gradient: "from-emerald-500 to-teal-600",
    },
    {
      title: "Commissions",
      value: loading ? "..." : formatCurrency(stats.totalCommissions),
      subtitle: loading ? "" : `${formatCurrency(stats.pendingCommissions)} en attente`,
      icon: DollarSign,
      gradient: "from-amber-500 to-orange-600",
      roles: ["admin", "partner"],
    },
    {
      title: "Primes mensuelles",
      value: loading ? "..." : formatCurrency(stats.monthlyPremiums),
      subtitle: loading ? "" : `${formatCurrency(stats.yearlyPremiums)} annuelles`,
      icon: TrendingUp,
      gradient: "from-violet-500 to-purple-600",
      roles: ["admin", "partner"],
    },
  ];

  const visibleCards = kpiCards.filter(
    (card) => !card.roles || card.roles.includes(role || "")
  );

  // Recent activities based on real data
  const recentActivities = useMemo(() => {
    const activities: { icon: any; text: string; time: string; color: string }[] = [];
    
    // Get recent clients
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

    // Get recent contracts
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

  // To do items based on real data
  const todoItems = useMemo(() => [
    { 
      label: "Contrats à renouveler", 
      count: stats.contractsToRenew, 
      color: "from-red-500 to-rose-600" 
    },
    { 
      label: "Contrats en attente", 
      count: stats.pendingContracts, 
      color: "from-amber-500 to-orange-600" 
    },
    { 
      label: "Commissions en attente", 
      count: commissions.filter(c => c.status === 'due' || c.status === 'pending').length, 
      color: "from-blue-500 to-indigo-600" 
    },
  ], [stats, commissions]);

  return (
    <div className="space-y-8">
      {/* Header with decorative background */}
      <div className="relative">
        <div className="absolute -inset-4 bg-gradient-to-r from-primary/10 via-violet-500/5 to-transparent rounded-3xl blur-2xl" />
        <div className="relative flex items-start justify-between">
          <div>
            <div className="flex items-center gap-4 mb-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-violet-600 rounded-2xl blur-lg opacity-50" />
                <div className="relative p-3 rounded-2xl bg-gradient-to-br from-primary to-violet-600 shadow-xl">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
                  Tableau de bord
                </h1>
                <p className="text-muted-foreground">
                  {isAdmin && "Vue d'ensemble administrative"}
                  {isPartner && "Vue d'ensemble partenaire"}
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

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Chargement des données...</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {visibleCards.map((card, index) => (
          <Card
            key={card.title}
            className={cn(
              "group relative overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-500",
              "hover:-translate-y-2 cursor-pointer bg-white/80 backdrop-blur"
            )}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            {/* Decorative gradient orbs */}
            <div className={cn(
              "absolute -top-16 -right-16 w-40 h-40 rounded-full opacity-20 blur-3xl transition-all duration-700",
              `bg-gradient-to-br ${card.gradient}`,
              "group-hover:opacity-40 group-hover:scale-150"
            )} />
            <div className={cn(
              "absolute -bottom-8 -left-8 w-24 h-24 rounded-full opacity-10 blur-2xl",
              `bg-gradient-to-br ${card.gradient}`
            )} />
            
            {/* Shine effect */}
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            
            <CardContent className="p-6 relative">
              <div className="flex items-start justify-between mb-5">
                <div className="relative">
                  <div className={cn(
                    "absolute inset-0 bg-gradient-to-br rounded-xl blur-lg opacity-50 group-hover:opacity-70",
                    card.gradient
                  )} />
                  <div className={cn(
                    "relative p-3 rounded-xl bg-gradient-to-br shadow-lg group-hover:scale-110 transition-transform duration-300",
                    card.gradient
                  )}>
                    <card.icon className="h-5 w-5 text-white" />
                  </div>
                </div>
              </div>
              
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                <p className="text-3xl font-bold tracking-tight">{card.value}</p>
                <p className="text-xs text-muted-foreground">{card.subtitle}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bottom Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">Activité récente</h3>
            </div>
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
                    <div className={cn(
                      "p-2.5 rounded-xl bg-gradient-to-br shadow-md group-hover:scale-110 transition-transform",
                      activity.color
                    )}>
                      <activity.icon className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm group-hover:text-primary transition-colors truncate">{activity.text}</p>
                      <p className="text-xs text-muted-foreground">{activity.time}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* To Do */}
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
                  <span className="text-sm font-medium group-hover:text-primary transition-colors">{item.label}</span>
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "px-3 py-1.5 rounded-full text-white text-sm font-bold shadow-md bg-gradient-to-r",
                      item.color
                    )}>
                      {item.count}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
