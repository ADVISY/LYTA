import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, Users, FileCheck, TrendingUp, Crown, ArrowUpRight, ArrowDownRight, DollarSign, CreditCard, AlertTriangle, ChevronRight, Target, PieChart, Bell, Activity, TrendingDown, Percent } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell } from "recharts";
import { useStripeStats } from "@/hooks/useStripeStats";
import { PLAN_CONFIGS, TenantPlan } from "@/config/plans";
import { Badge } from "@/components/ui/badge";
import { KingNotificationsInbox } from "@/components/king/KingNotificationsInbox";
import { useKingNotifications } from "@/hooks/useKingNotifications";
import { formatDistanceToNow, subDays } from "date-fns";
import { fr } from "date-fns/locale";

const PLAN_COLORS: Record<TenantPlan, string> = {
  start: '#64748b',
  pro: '#3b82f6',
  prime: '#8b5cf6',
  founder: '#f59e0b',
};

export default function KingDashboard() {
  const navigate = useNavigate();
  const { unreadCount } = useKingNotifications();

  // Stripe revenue stats
  const { data: stripeStats, isLoading: stripeLoading } = useStripeStats();

  // Platform stats with extended KPIs
  const { data: stats, isLoading } = useQuery({
    queryKey: ['king-dashboard-stats-extended'],
    queryFn: async () => {
      const thirtyDaysAgo = subDays(new Date(), 30);
      const sevenDaysAgo = subDays(new Date(), 7);

      const [tenantsResult, usersResult, policiesResult] = await Promise.all([
        supabase.from('tenants').select('id, status, plan, billing_status, payment_status, tenant_status, mrr_amount, created_at, last_activity_at'),
        supabase.from('user_tenant_assignments').select('id', { count: 'exact' }),
        supabase.from('policies').select('id', { count: 'exact' }),
      ]);

      const tenants = tenantsResult.data || [];
      const activeCount = tenants.filter(t => t.status === 'active' || t.tenant_status === 'active').length;
      const testCount = tenants.filter(t => t.status === 'test').length;
      const pendingCount = tenants.filter(t => t.status === 'pending' || t.tenant_status === 'pending_setup').length;
      const suspendedCount = tenants.filter(t => t.status === 'suspended' || t.tenant_status === 'suspended').length;
      
      // Payment status counts
      const paidCount = tenants.filter(t => t.billing_status === 'paid' || t.payment_status === 'paid').length;
      const pastDueCount = tenants.filter(t => t.billing_status === 'past_due' || t.payment_status === 'past_due').length;
      const trialCount = tenants.filter(t => t.billing_status === 'trial' || t.payment_status === 'trialing').length;

      // Plan distribution
      const planDistribution = {
        start: tenants.filter(t => t.plan === 'start').length,
        pro: tenants.filter(t => t.plan === 'pro').length,
        prime: tenants.filter(t => t.plan === 'prime').length,
        founder: tenants.filter(t => t.plan === 'founder').length,
      };

      // Calculate this month's new tenants
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const newThisMonth = tenants.filter(t => new Date(t.created_at) >= startOfMonth).length;
      const newLastMonth = tenants.filter(t => {
        const created = new Date(t.created_at);
        return created >= startOfLastMonth && created < startOfMonth;
      }).length;

      // Churn calculation (cancelled in last 30 days / active at start of period)
      const cancelledRecently = tenants.filter(t => 
        (t.status === 'suspended' || t.tenant_status === 'cancelled') && 
        new Date(t.created_at) >= thirtyDaysAgo
      ).length;
      const churnRate = activeCount > 0 ? (cancelledRecently / (activeCount + cancelledRecently)) * 100 : 0;

      // MRR at risk (past_due tenants)
      const mrrAtRisk = tenants
        .filter(t => t.billing_status === 'past_due' || t.payment_status === 'past_due')
        .reduce((sum, t) => sum + (Number(t.mrr_amount) || 0), 0);

      // Recent activity (tenants with activity in last 7 days)
      const recentlyActive = tenants.filter(t => 
        t.last_activity_at && new Date(t.last_activity_at) >= sevenDaysAgo
      ).length;

      return {
        totalTenants: tenants.length,
        activeTenants: activeCount,
        testTenants: testCount,
        pendingTenants: pendingCount,
        suspendedTenants: suspendedCount,
        paidTenants: paidCount,
        pastDueTenants: pastDueCount,
        trialTenants: trialCount,
        planDistribution,
        totalUsers: usersResult.count || 0,
        totalPolicies: policiesResult.count || 0,
        newThisMonth,
        newLastMonth,
        churnRate,
        mrrAtRisk,
        recentlyActive,
      };
    },
    refetchInterval: 60000,
  });

  // Recent tenants query
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

  // Calculate ARPA (Average Revenue Per Account)
  const arpa = stats?.activeTenants && stats.activeTenants > 0 
    ? (stripeStats?.mrr || 0) / stats.activeTenants 
    : 0;

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
              className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm relative"
              onClick={() => navigate('/king/tenants?filter=pending')}
            >
              <Bell className="h-4 w-4 mr-2" />
              Notifications
              {unreadCount > 0 && (
                <Badge className="absolute -top-2 -right-2 bg-red-500 text-white h-5 w-5 p-0 flex items-center justify-center">
                  {unreadCount}
                </Badge>
              )}
            </Button>
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
              <TrendingUp className="h-4 w-4 mr-2" />
              Nouveau Client
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs Row 1 - Revenue */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* MRR Card */}
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-white/80">MRR Total</CardTitle>
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

        {/* MRR at Risk */}
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-red-500 to-red-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-white/80">MRR à risque</CardTitle>
            <AlertTriangle className="h-4 w-4 text-white/60" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {isLoading ? '...' : formatCurrency(stats?.mrrAtRisk || 0)}
            </div>
            <p className="text-xs text-white/70 mt-2">
              {stats?.pastDueTenants || 0} tenant(s) en retard
            </p>
          </CardContent>
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full" />
        </Card>

        {/* ARPA */}
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-white/80">ARPA</CardTitle>
            <Target className="h-4 w-4 text-white/60" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {formatCurrency(arpa)}
            </div>
            <p className="text-xs text-white/70 mt-2">
              Revenu moyen par compte
            </p>
          </CardContent>
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full" />
        </Card>

        {/* Churn Rate */}
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-violet-500 to-violet-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-white/80">Churn (30j)</CardTitle>
            <TrendingDown className="h-4 w-4 text-white/60" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {isLoading ? '...' : `${(stats?.churnRate || 0).toFixed(1)}%`}
            </div>
            <p className="text-xs text-white/70 mt-2">
              Taux d'attrition mensuel
            </p>
          </CardContent>
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full" />
        </Card>
      </div>

      {/* KPIs Row 2 - Tenants */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tenants actifs</p>
                <p className="text-2xl font-bold">{stats?.activeTenants || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-emerald-500/10">
                <Building2 className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Nouveaux (30j)</p>
                <p className="text-2xl font-bold">
                  {stats?.newThisMonth || 0}
                  {stats?.newLastMonth !== undefined && stats.newLastMonth !== stats?.newThisMonth && (
                    <span className={`text-sm ml-2 ${(stats?.newThisMonth || 0) >= (stats?.newLastMonth || 0) ? 'text-emerald-500' : 'text-red-500'}`}>
                      {(stats?.newThisMonth || 0) >= (stats?.newLastMonth || 0) ? <ArrowUpRight className="inline h-4 w-4" /> : <ArrowDownRight className="inline h-4 w-4" />}
                    </span>
                  )}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-blue-500/10">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">En attente</p>
                <p className="text-2xl font-bold text-orange-600">{stats?.pendingTenants || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-orange-500/10">
                <Activity className="h-5 w-5 text-orange-600" />
              </div>
            </div>
            {(stats?.pendingTenants || 0) > 0 && (
              <Button 
                variant="link" 
                className="p-0 h-auto text-xs text-orange-600"
                onClick={() => navigate('/king/tenants?filter=pending')}
              >
                Voir les demandes →
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Impayés (7j)</p>
                <p className="text-2xl font-bold text-red-600">{stats?.pastDueTenants || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-red-500/10">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Abonnements actifs</p>
                <p className="text-2xl font-bold">{stripeStats?.totalActiveSubscriptions || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-violet-500/10">
                <CreditCard className="h-5 w-5 text-violet-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
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
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {planPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPie>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground">Aucune donnée</p>
              )}
            </div>
            <div className="flex justify-center gap-4 mt-4">
              {planPieData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-sm">{entry.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notifications Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <KingNotificationsInbox />
        </div>

        {/* Recent Tenants */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Derniers clients
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentTenants?.map((tenant) => (
                <div
                  key={tenant.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/king/tenants/${tenant.id}`)}
                >
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
                      <Building2
                        className="h-5 w-5"
                        style={{
                          color: tenant.tenant_branding?.[0]?.primary_color || 'hsl(var(--primary))'
                        }}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{tenant.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(tenant.created_at), { addSuffix: true, locale: fr })}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      tenant.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-600 border-0'
                        : tenant.status === 'pending'
                        ? 'bg-orange-500/10 text-orange-600 border-0'
                        : 'bg-blue-500/10 text-blue-600 border-0'
                    }
                  >
                    {tenant.status === 'active' ? 'Actif' : tenant.status === 'pending' ? 'En attente' : 'Test'}
                  </Badge>
                </div>
              ))}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate('/king/tenants')}
              >
                Voir tous les clients
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
