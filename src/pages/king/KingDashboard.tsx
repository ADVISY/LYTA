import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, FileCheck, TrendingUp, Crown, ArrowUpRight, ArrowDownRight, Activity, Zap, DollarSign, CreditCard, AlertTriangle, ChevronRight, Sparkles, Target, PieChart } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart as RechartsPie, Pie } from "recharts";
import { useStripeStats } from "@/hooks/useStripeStats";
import { PLAN_CONFIGS, TenantPlan } from "@/config/plans";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const PLAN_COLORS: Record<TenantPlan, string> = {
  start: '#64748b',
  pro: '#3b82f6',
  prime: '#8b5cf6',
  founder: '#f59e0b',
};

export default function KingDashboard() {
  const navigate = useNavigate();

  // Stripe revenue stats
  const { data: stripeStats, isLoading: stripeLoading } = useStripeStats();

  // Platform stats
  const { data: stats, isLoading } = useQuery({
    queryKey: ['king-dashboard-stats'],
    queryFn: async () => {
      const [tenantsResult, usersResult, policiesResult, commissionsResult] = await Promise.all([
        supabase.from('tenants').select('id, status, plan, billing_status, created_at'),
        supabase.from('user_tenant_assignments').select('id', { count: 'exact' }),
        supabase.from('policies').select('id', { count: 'exact' }),
        supabase.from('commissions').select('amount'),
      ]);

      const tenants = tenantsResult.data || [];
      const activeCount = tenants.filter(t => t.status === 'active').length;
      const testCount = tenants.filter(t => t.status === 'test').length;
      const pendingCount = tenants.filter(t => t.status === 'pending').length;
      const trialCount = tenants.filter(t => t.billing_status === 'trial').length;
      
      // Plan distribution
      const planDistribution = {
        start: tenants.filter(t => t.plan === 'start').length,
        pro: tenants.filter(t => t.plan === 'pro').length,
        prime: tenants.filter(t => t.plan === 'prime').length,
        founder: tenants.filter(t => t.plan === 'founder').length,
      };
      
      // Calculate total commissions
      const totalCommissions = (commissionsResult.data || []).reduce(
        (sum, c) => sum + (Number(c.amount) || 0), 0
      );

      // Calculate this month's new tenants
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const newThisMonth = tenants.filter(t => new Date(t.created_at) >= startOfMonth).length;

      return {
        totalTenants: tenantsResult.count || tenants.length,
        activeTenants: activeCount,
        testTenants: testCount,
        pendingTenants: pendingCount,
        trialTenants: trialCount,
        planDistribution,
        totalUsers: usersResult.count || 0,
        totalPolicies: policiesResult.count || 0,
        totalCommissions,
        newThisMonth,
      };
    },
  });

  // Get monthly growth data for chart
  const { data: growthData } = useQuery({
    queryKey: ['king-growth-data'],
    queryFn: async () => {
      const { data: tenants } = await supabase
        .from('tenants')
        .select('created_at')
        .order('created_at', { ascending: true });

      // Group by month
      const monthlyData: Record<string, number> = {};
      const now = new Date();
      
      // Initialize last 6 months
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = date.toLocaleDateString('fr-CH', { month: 'short', year: '2-digit' });
        monthlyData[key] = 0;
      }

      // Count tenants created each month
      tenants?.forEach(t => {
        const date = new Date(t.created_at);
        const key = date.toLocaleDateString('fr-CH', { month: 'short', year: '2-digit' });
        if (monthlyData.hasOwnProperty(key)) {
          monthlyData[key]++;
        }
      });

      // Calculate cumulative
      let cumulative = 0;
      const entries = Object.entries(monthlyData);
      
      // Count tenants before our range
      if (entries.length > 0) {
        const beforeRange = tenants?.filter(t => {
          const date = new Date(t.created_at);
          const key = date.toLocaleDateString('fr-CH', { month: 'short', year: '2-digit' });
          return !monthlyData.hasOwnProperty(key);
        }).length || 0;
        cumulative = beforeRange;
      }

      return entries.map(([month, newTenants]) => {
        cumulative += newTenants;
        return { month, newTenants, total: cumulative };
      });
    },
  });

  const { data: recentTenants } = useQuery({
    queryKey: ['king-recent-tenants'],
    queryFn: async () => {
      const { data } = await supabase
        .from('tenants')
        .select(`
          *,
          tenant_branding (logo_url, display_name, primary_color)
        `)
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  // Plan distribution for pie chart
  const planPieData = stats?.planDistribution ? [
    { name: 'Start', value: stats.planDistribution.start, color: PLAN_COLORS.start },
    { name: 'Pro', value: stats.planDistribution.pro, color: PLAN_COLORS.pro },
    { name: 'Prime', value: stats.planDistribution.prime, color: PLAN_COLORS.prime },
    { name: 'Founder', value: stats.planDistribution.founder, color: PLAN_COLORS.founder },
  ].filter(d => d.value > 0) : [];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-CH', {
      style: 'currency',
      currency: 'CHF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    return `Il y a ${diffDays}j`;
  };

  return (
    <div className="space-y-8">
      {/* Header with gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 p-8 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
              <Crown className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Dashboard KING</h1>
              <p className="text-white/80">Vue d'ensemble de la plateforme LYTA</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="secondary"
              className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
              onClick={() => navigate('/king/tenants')}
            >
              <Building2 className="h-4 w-4 mr-2" />
              Tous les clients
            </Button>
            <Button 
              onClick={() => navigate('/king/wizard')}
              className="bg-white text-amber-600 hover:bg-white/90"
            >
              <Zap className="h-4 w-4 mr-2" />
              Nouveau Client
            </Button>
          </div>
        </div>
      </div>

      {/* Revenue Stats - Top Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* MRR Card */}
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-white/80">
              MRR
            </CardTitle>
            <DollarSign className="h-4 w-4 text-white/60" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stripeLoading ? '...' : formatCurrency(stripeStats?.mrr || 0)}
            </div>
            <p className="text-xs text-white/70 mt-2">
              ARR: {formatCurrency((stripeStats?.mrr || 0) * 12)}
            </p>
          </CardContent>
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full" />
        </Card>

        {/* Extra Users Revenue */}
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-white/80">
              Revenu Utilisateurs Supp.
            </CardTitle>
            <Users className="h-4 w-4 text-white/60" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stripeLoading ? '...' : formatCurrency(stripeStats?.extraUsersMRR || 0)}
            </div>
            <p className="text-xs text-white/70 mt-2">
              +20 CHF/utilisateur/mois
            </p>
          </CardContent>
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full" />
        </Card>

        {/* Active Subscriptions */}
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-violet-500 to-violet-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-white/80">
              Abonnements Actifs
            </CardTitle>
            <CreditCard className="h-4 w-4 text-white/60" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stripeLoading ? '...' : stripeStats?.totalActiveSubscriptions || 0}
            </div>
            {(stripeStats?.totalPastDueSubscriptions || 0) > 0 && (
              <p className="text-xs text-orange-200 mt-2 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {stripeStats?.totalPastDueSubscriptions} impayé(s)
              </p>
            )}
            {(stripeStats?.totalPastDueSubscriptions || 0) === 0 && (
              <p className="text-xs text-white/70 mt-2">
                Tous à jour
              </p>
            )}
          </CardContent>
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full" />
        </Card>

        {/* Clients SaaS */}
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-white/80">
              Clients SaaS
            </CardTitle>
            <Building2 className="h-4 w-4 text-white/60" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{isLoading ? '...' : stats?.totalTenants}</div>
            <div className="flex items-center gap-2 mt-2">
              {(stats?.newThisMonth || 0) > 0 ? (
                <span className="flex items-center text-xs text-white/80">
                  <ArrowUpRight className="h-3 w-3 mr-0.5" />
                  +{stats?.newThisMonth} ce mois
                </span>
              ) : (
                <span className="text-xs text-white/70">Aucun nouveau</span>
              )}
            </div>
          </CardContent>
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full" />
        </Card>
      </div>

      {/* Plan Revenue Breakdown */}
      <div className="grid gap-4 md:grid-cols-4">
        {(['start', 'pro', 'prime', 'founder'] as TenantPlan[]).map((plan) => {
          const planConfig = PLAN_CONFIGS[plan];
          const planStats = stripeStats?.planStats?.[plan];
          const count = planStats?.count || 0;
          const mrr = planStats?.mrr || 0;
          
          return (
            <Card key={plan} className="relative overflow-hidden">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <Badge 
                    className="text-xs" 
                    style={{ 
                      backgroundColor: `${PLAN_COLORS[plan]}20`,
                      color: PLAN_COLORS[plan],
                    }}
                  >
                    {planConfig.displayName}
                  </Badge>
                  <span className="text-2xl font-bold">{count}</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">MRR</span>
                    <span className="font-medium">{formatCurrency(mrr)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Prix/mois</span>
                    <span className="font-medium">{formatCurrency(planConfig.monthlyPrice)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Sièges inclus</span>
                    <span className="font-medium">{planConfig.seatsIncluded}</span>
                  </div>
                </div>
                <div 
                  className="absolute bottom-0 left-0 right-0 h-1"
                  style={{ backgroundColor: PLAN_COLORS[plan] }}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              Revenus mensuels
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stripeStats?.revenueChart || []}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    tickFormatter={(value) => `${value}.-`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => [formatCurrency(value), 'Revenu']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorRevenue)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Plan Distribution Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-violet-500" />
              Répartition par plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center">
              {planPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie
                      data={planPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {planPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                  </RechartsPie>
                </ResponsiveContainer>
              ) : (
                <div className="text-muted-foreground text-center">
                  <Building2 className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>Aucun tenant configuré</p>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 mt-4">
              {planPieData.map((plan) => (
                <div key={plan.name} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: plan.color }}
                  />
                  <span className="text-sm text-muted-foreground">
                    {plan.name}: <span className="font-medium text-foreground">{plan.value}</span>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-500" />
              Métriques clés
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Utilisateurs totaux</span>
                <span className="font-medium">{stats?.totalUsers || 0}</span>
              </div>
              <Progress value={Math.min((stats?.totalUsers || 0) / 100 * 100, 100)} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Contrats gérés</span>
                <span className="font-medium">{stats?.totalPolicies || 0}</span>
              </div>
              <Progress value={Math.min((stats?.totalPolicies || 0) / 1000 * 100, 100)} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Commissions totales</span>
                <span className="font-medium">{formatCurrency(stats?.totalCommissions || 0)}</span>
              </div>
              <Progress value={Math.min((stats?.totalCommissions || 0) / 1000000 * 100, 100)} className="h-2" />
            </div>
            <div className="grid grid-cols-3 gap-4 pt-4 border-t">
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-600">{stats?.activeTenants || 0}</p>
                <p className="text-xs text-muted-foreground">Actifs</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{stats?.trialTenants || 0}</p>
                <p className="text-xs text-muted-foreground">En essai</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">{stats?.pendingTenants || 0}</p>
                <p className="text-xs text-muted-foreground">En attente</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Tenants */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              Derniers clients
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/king/tenants')}>
              Voir tous
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentTenants && recentTenants.length > 0 ? (
              <div className="space-y-3">
                {recentTenants.map((tenant: any) => (
                  <div
                    key={tenant.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/king/tenants/${tenant.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ 
                          backgroundColor: tenant.tenant_branding?.[0]?.primary_color 
                            ? `${tenant.tenant_branding[0].primary_color}20` 
                            : 'hsl(var(--primary) / 0.1)' 
                        }}
                      >
                        {tenant.tenant_branding?.[0]?.logo_url ? (
                          <img 
                            src={tenant.tenant_branding[0].logo_url} 
                            alt={tenant.name}
                            className="h-6 w-6 object-contain"
                          />
                        ) : (
                          <Building2 className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{tenant.name}</p>
                        <p className="text-xs text-muted-foreground">{tenant.slug}.lyta.ch</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge 
                        variant="outline" 
                        className="text-xs"
                        style={{
                          backgroundColor: `${PLAN_COLORS[tenant.plan as TenantPlan] || PLAN_COLORS.start}15`,
                          borderColor: PLAN_COLORS[tenant.plan as TenantPlan] || PLAN_COLORS.start,
                          color: PLAN_COLORS[tenant.plan as TenantPlan] || PLAN_COLORS.start,
                        }}
                      >
                        {PLAN_CONFIGS[tenant.plan as TenantPlan]?.displayName || 'Start'}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTimeAgo(tenant.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p>Aucun client pour le moment</p>
                <Button 
                  variant="link" 
                  className="mt-2"
                  onClick={() => navigate('/king/wizard')}
                >
                  Créer le premier client
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
