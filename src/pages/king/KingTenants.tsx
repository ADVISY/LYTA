import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, Plus, Search, ExternalLink, Settings, MoreHorizontal } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
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
  });

  const filteredTenants = tenants?.filter(tenant => {
    const matchesSearch = 
      tenant.name.toLowerCase().includes(search.toLowerCase()) ||
      tenant.slug.toLowerCase().includes(search.toLowerCase()) ||
      tenant.email.toLowerCase().includes(search.toLowerCase());
    
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
                <SelectItem value="active">Actif</SelectItem>
                <SelectItem value="test">Test</SelectItem>
                <SelectItem value="suspended">Suspendu</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

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
              {filteredTenants.map((tenant) => (
                <div
                  key={tenant.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-12 h-12 rounded-lg flex items-center justify-center"
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
                          className="h-8 w-8 object-contain"
                        />
                      ) : (
                        <Building2 
                          className="h-6 w-6" 
                          style={{ 
                            color: tenant.tenant_branding?.[0]?.primary_color || 'hsl(var(--primary))' 
                          }}
                        />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold">{tenant.name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{tenant.slug}.lyta.ch</span>
                        <ExternalLink className="h-3 w-3" />
                      </div>
                      <p className="text-xs text-muted-foreground">{tenant.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                      tenant.status === 'active' 
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : tenant.status === 'test'
                        ? 'bg-blue-500/10 text-blue-600'
                        : 'bg-red-500/10 text-red-600'
                    }`}>
                      {tenant.status === 'active' ? 'Actif' : tenant.status === 'test' ? 'Test' : 'Suspendu'}
                    </span>
                    <span className="text-sm text-muted-foreground hidden sm:block">
                      {new Date(tenant.created_at).toLocaleDateString('fr-CH')}
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
              ))}
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
