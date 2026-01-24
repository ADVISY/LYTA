import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Search, ExternalLink, Settings, MoreHorizontal, Users, FileText, Briefcase, TrendingUp, Crown, Zap, Star, CreditCard } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { PLAN_CONFIGS, TenantPlan } from "@/config/plans";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TenantStats {
  clients: number;
  collaborateurs: number;
  policies: number;
  commissions_total: number;
  active_users: number;
}

const PLAN_COLORS: Record<TenantPlan, string> = {
  start: 'bg-slate-500/10 text-slate-600',
  pro: 'bg-blue-500/10 text-blue-600',
  prime: 'bg-purple-500/10 text-purple-600',
  founder: 'bg-amber-500/10 text-amber-600',
};

const BILLING_COLORS: Record<string, string> = {
  paid: 'bg-emerald-500/10 text-emerald-600',
  trial: 'bg-blue-500/10 text-blue-600',
  past_due: 'bg-red-500/10 text-red-600',
  canceled: 'bg-slate-500/10 text-slate-600',
};

const BILLING_LABELS: Record<string, string> = {
  paid: 'Payé',
  trial: 'Essai',
  past_due: 'Impayé',
  canceled: 'Annulé',
};

export default function KingTenants() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: tenants, isLoading } = useQuery({
    queryKey: ['king-tenants'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select(`
          *,
          tenant_branding (*)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch stats for each tenant with auto-refresh
  const { data: tenantsStats } = useQuery({
    queryKey: ['king-tenants-stats'],
    refetchInterval: 30000, // Refresh every 30 seconds
    queryFn: async () => {
      // Get all clients grouped by tenant with type_adresse and user_id
      const { data: clientsData } = await supabase
        .from('clients')
        .select('tenant_id, type_adresse, user_id');
      
      // Get all policies grouped by tenant
      const { data: policiesData } = await supabase
        .from('policies')
        .select('tenant_id');
      
      // Get all commissions grouped by tenant
      const { data: commissionsData } = await supabase
        .from('commissions')
        .select('tenant_id, amount');

      // Calculate stats per tenant
      const stats: Record<string, TenantStats> = {};
      
      // Count clients and collaborateurs per tenant based on type_adresse
      clientsData?.forEach(client => {
        const tenantId = client.tenant_id || 'no-tenant';
        if (!stats[tenantId]) {
          stats[tenantId] = { clients: 0, collaborateurs: 0, policies: 0, commissions_total: 0, active_users: 0 };
        }
        
        // collaborateur and partenaire are considered as collaborateurs
        if (client.type_adresse === 'collaborateur' || client.type_adresse === 'partenaire') {
          stats[tenantId].collaborateurs++;
          // Count as active user if they have a user_id
          if (client.user_id) {
            stats[tenantId].active_users++;
          }
        } else {
          stats[tenantId].clients++;
        }
      });

      // Count policies per tenant
      policiesData?.forEach(policy => {
        const tenantId = policy.tenant_id || 'no-tenant';
        if (!stats[tenantId]) {
          stats[tenantId] = { clients: 0, collaborateurs: 0, policies: 0, commissions_total: 0, active_users: 0 };
        }
        stats[tenantId].policies++;
      });

      // Sum commissions per tenant
      commissionsData?.forEach(commission => {
        const tenantId = commission.tenant_id || 'no-tenant';
        if (!stats[tenantId]) {
          stats[tenantId] = { clients: 0, collaborateurs: 0, policies: 0, commissions_total: 0, active_users: 0 };
        }
        stats[tenantId].commissions_total += Number(commission.amount) || 0;
      });

      return stats;
    },
  });

  // Count pending tenants
  const pendingCount = tenants?.filter(t => t.status === 'pending').length || 0;

  const filteredTenants = tenants?.filter(tenant => {
    const matchesSearch = 
      tenant.name.toLowerCase().includes(search.toLowerCase()) ||
      tenant.slug.toLowerCase().includes(search.toLowerCase()) ||
      (tenant.email?.toLowerCase() || '').includes(search.toLowerCase()) ||
      (tenant.contact_name?.toLowerCase() || '').includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || tenant.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Clients SaaS</h1>
          <p className="text-muted-foreground">Gérez tous les cabinets qui utilisent LYTA</p>
        </div>
        <Button 
          onClick={() => navigate('/king/wizard')}
          className="bg-amber-500 hover:bg-amber-600"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nouveau Client
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, slug ou email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="pending">
                  <span className="flex items-center gap-2">
                    En attente
                    {pendingCount > 0 && (
                      <span className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">{pendingCount}</span>
                    )}
                  </span>
                </SelectItem>
                <SelectItem value="active">Actif</SelectItem>
                <SelectItem value="test">Test</SelectItem>
                <SelectItem value="suspended">Suspendu</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Pending Alert Banner */}
      {pendingCount > 0 && statusFilter !== 'pending' && (
        <Card className="border-orange-500/50 bg-orange-500/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-orange-500/20">
                  <Building2 className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="font-semibold text-orange-700">{pendingCount} demande(s) en attente</p>
                  <p className="text-sm text-muted-foreground">Des clients attendent l'activation de leur compte</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                className="border-orange-500 text-orange-600 hover:bg-orange-500/10"
                onClick={() => setStatusFilter('pending')}
              >
                Voir les demandes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tenants List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {filteredTenants?.length || 0} client(s)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-muted border-t-primary" />
            </div>
          ) : filteredTenants && filteredTenants.length > 0 ? (
            <div className="space-y-4">
              {filteredTenants.map((tenant) => {
                const stats: TenantStats = tenantsStats?.[tenant.id] || { clients: 0, collaborateurs: 0, policies: 0, commissions_total: 0, active_users: 0 };
                const logoUrl = tenant.tenant_branding?.[0]?.logo_url;
                const primaryColor = tenant.tenant_branding?.[0]?.primary_color;
                
                return (
                  <div
                    key={tenant.id}
                    className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div 
                          className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden"
                          style={{ 
                            backgroundColor: primaryColor 
                              ? `${primaryColor}20` 
                              : 'hsl(var(--primary) / 0.1)' 
                          }}
                        >
                          {logoUrl ? (
                            <img 
                              src={logoUrl} 
                              alt={tenant.name}
                              className="h-8 w-8 object-contain"
                              onError={(e) => {
                                // Hide broken image and show fallback
                                (e.target as HTMLImageElement).style.display = 'none';
                                const sibling = (e.target as HTMLImageElement).nextElementSibling;
                                if (sibling) sibling.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <Building2 
                            className={`h-6 w-6 ${logoUrl ? 'hidden' : ''}`}
                            style={{ color: primaryColor || 'hsl(var(--primary))' }}
                          />
                        </div>
                        <div>
                          <p className="font-semibold text-lg">{tenant.name}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{tenant.slug}.lyta.ch</span>
                            <ExternalLink className="h-3 w-3" />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {/* Plan Badge */}
                        {tenant.plan && (
                          <Badge className={`${PLAN_COLORS[tenant.plan as TenantPlan] || PLAN_COLORS.start}`}>
                            {tenant.plan === 'founder' && <Crown className="h-3 w-3 mr-1" />}
                            {tenant.plan === 'prime' && <Star className="h-3 w-3 mr-1" />}
                            {tenant.plan === 'pro' && <Zap className="h-3 w-3 mr-1" />}
                            {PLAN_CONFIGS[tenant.plan as TenantPlan]?.name || 'START'}
                          </Badge>
                        )}
                        {/* Billing Status Badge */}
                        {tenant.billing_status && (
                          <Badge variant="outline" className={BILLING_COLORS[tenant.billing_status] || ''}>
                            <CreditCard className="h-3 w-3 mr-1" />
                            {BILLING_LABELS[tenant.billing_status] || tenant.billing_status}
                          </Badge>
                        )}
                        <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                          tenant.status === 'active' 
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : tenant.status === 'test'
                            ? 'bg-blue-500/10 text-blue-600'
                            : tenant.status === 'pending'
                            ? 'bg-orange-500/10 text-orange-600'
                            : 'bg-red-500/10 text-red-600'
                        }`}>
                          {tenant.status === 'active' ? 'Actif' : tenant.status === 'test' ? 'Test' : tenant.status === 'pending' ? 'En attente' : 'Suspendu'}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/king/tenants/${tenant.id}`)}>
                              <Settings className="h-4 w-4 mr-2" />
                              Gérer
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Voir le CRM
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    
                    {/* Stats Row */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 pt-4 border-t">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                          <Users className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-xl font-bold">{stats.clients}</p>
                          <p className="text-xs text-muted-foreground">Clients</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-purple-500/10">
                          <Briefcase className="h-4 w-4 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-xl font-bold">{stats.collaborateurs}</p>
                          <p className="text-xs text-muted-foreground">Collaborateurs</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-500/10">
                          <FileText className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-xl font-bold">{stats.policies}</p>
                          <p className="text-xs text-muted-foreground">Contrats</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-amber-500/10">
                          <TrendingUp className="h-4 w-4 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-xl font-bold">CHF {stats.commissions_total.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Commissions</p>
                        </div>
                      </div>
                      {/* Users count with seat info */}
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${stats.active_users > (tenant.seats_included || 1) ? 'bg-orange-500/10' : 'bg-cyan-500/10'}`}>
                          <Users className={`h-4 w-4 ${stats.active_users > (tenant.seats_included || 1) ? 'text-orange-600' : 'text-cyan-600'}`} />
                        </div>
                        <div>
                          <p className="text-xl font-bold">
                            {stats.active_users}
                            <span className="text-sm font-normal text-muted-foreground">/{tenant.seats_included || 1}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Utilisateurs
                            {stats.active_users > (tenant.seats_included || 1) && (
                              <span className="text-orange-600 ml-1">
                                (+{stats.active_users - (tenant.seats_included || 1)} supp.)
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Footer info */}
                    <div className="flex items-center justify-between mt-4 pt-3 border-t text-xs text-muted-foreground">
                      <span>
                        {tenant.status === 'pending' && tenant.contact_name 
                          ? `Contact: ${tenant.contact_name}` 
                          : `Email: ${tenant.email || tenant.admin_email || 'N/A'}`}
                      </span>
                      <span>Créé le {new Date(tenant.created_at).toLocaleDateString('fr-CH')}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {search || statusFilter !== "all" 
                  ? "Aucun client ne correspond à vos critères" 
                  : "Aucun client SaaS pour le moment"}
              </p>
              {!search && statusFilter === "all" && (
                <Button 
                  className="mt-4 bg-amber-500 hover:bg-amber-600"
                  onClick={() => navigate('/king/wizard')}
                >
                  Créer votre premier client
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
