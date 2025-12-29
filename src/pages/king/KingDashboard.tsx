import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, FileCheck, TrendingUp, Crown, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function KingDashboard() {
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['king-dashboard-stats'],
    queryFn: async () => {
      const [tenantsResult, usersResult] = await Promise.all([
        supabase.from('tenants').select('id, status', { count: 'exact' }),
        supabase.from('user_tenant_assignments').select('id', { count: 'exact' }),
      ]);

      const tenants = tenantsResult.data || [];
      const activeCount = tenants.filter(t => t.status === 'active').length;
      const testCount = tenants.filter(t => t.status === 'test').length;
      const suspendedCount = tenants.filter(t => t.status === 'suspended').length;

      return {
        totalTenants: tenantsResult.count || 0,
        activeTenants: activeCount,
        testTenants: testCount,
        suspendedTenants: suspendedCount,
        totalUsers: usersResult.count || 0,
      };
    },
  });

  const { data: recentTenants } = useQuery({
    queryKey: ['king-recent-tenants'],
    queryFn: async () => {
      const { data } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Crown className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Dashboard KING</h1>
              <p className="text-muted-foreground">Vue d'ensemble de la plateforme LYTA</p>
            </div>
          </div>
        </div>
        <Button 
          onClick={() => navigate('/king/wizard')}
          className="bg-amber-500 hover:bg-amber-600"
        >
          <Building2 className="h-4 w-4 mr-2" />
          Nouveau Client SaaS
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Clients SaaS
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '...' : stats?.totalTenants}</div>
            <div className="flex gap-2 mt-2">
              <span className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-600 rounded-full">
                {stats?.activeTenants || 0} actifs
              </span>
              <span className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-600 rounded-full">
                {stats?.testTenants || 0} test
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Utilisateurs
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '...' : stats?.totalUsers}</div>
            <p className="text-xs text-muted-foreground mt-2">
              Sur tous les tenants
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Clients suspendus
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {isLoading ? '...' : stats?.suspendedTenants}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Nécessitent attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              MRR Estimé
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              CHF {((stats?.activeTenants || 0) * 299).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Basé sur les actifs
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Tenants */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Derniers clients créés
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentTenants && recentTenants.length > 0 ? (
            <div className="space-y-4">
              {recentTenants.map((tenant) => (
                <div
                  key={tenant.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/king/tenants/${tenant.id}`)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{tenant.name}</p>
                      <p className="text-sm text-muted-foreground">{tenant.slug}.lyta.ch</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      tenant.status === 'active' 
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : tenant.status === 'test'
                        ? 'bg-blue-500/10 text-blue-600'
                        : 'bg-red-500/10 text-red-600'
                    }`}>
                      {tenant.status}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(tenant.created_at).toLocaleDateString('fr-CH')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Aucun client SaaS pour le moment</p>
              <Button 
                className="mt-4 bg-amber-500 hover:bg-amber-600"
                onClick={() => navigate('/king/wizard')}
              >
                Créer votre premier client
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
