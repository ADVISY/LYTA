import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePolicies } from "@/hooks/usePolicies";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, FileCheck, Eye, ChevronRight, Building2, Calendar, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function CRMContracts() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { policies, loading, fetchPolicies } = usePolicies();
  const [searchQuery, setSearchQuery] = useState("");

  const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
    pending: { label: t('contracts.pending'), color: "text-amber-700", bgColor: "bg-amber-100" },
    active: { label: t('contracts.active'), color: "text-emerald-700", bgColor: "bg-emerald-100" },
    expired: { label: t('contracts.expired'), color: "text-slate-700", bgColor: "bg-slate-100" },
    cancelled: { label: t('contracts.cancelled'), color: "text-red-700", bgColor: "bg-red-100" },
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const filteredPolicies = policies.filter(policy => {
    if (!searchQuery.trim()) return true;
    const search = searchQuery.toLowerCase();
    const clientName = policy.client?.company_name || 
      `${policy.client?.first_name || ''} ${policy.client?.last_name || ''}`.trim();
    const productName = policy.product?.name || '';
    const companyName = policy.product?.company?.name || policy.company_name || '';
    const policyNumber = policy.policy_number || '';
    
    return (
      clientName.toLowerCase().includes(search) ||
      productName.toLowerCase().includes(search) ||
      companyName.toLowerCase().includes(search) ||
      policyNumber.toLowerCase().includes(search)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary/20 border-t-primary" />
          <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-lg shadow-primary/20">
            <FileCheck className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{t('contracts.title')}</h1>
            <p className="text-muted-foreground">{t('contracts.subtitle')}</p>
          </div>
        </div>
        <Button className="group bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary shadow-lg shadow-primary/20">
          <Plus className="h-4 w-4 mr-2 transition-transform group-hover:rotate-90" />
          {t('contracts.newContract')}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('contracts.total'), value: policies.length, color: "from-blue-500 to-blue-600" },
          { label: t('contracts.activeCount'), value: policies.filter(p => p.status === 'active').length, color: "from-emerald-500 to-emerald-600" },
          { label: t('contracts.pendingCount'), value: policies.filter(p => p.status === 'pending').length, color: "from-amber-500 to-orange-500" },
          { label: t('contracts.expiredCount'), value: policies.filter(p => p.status === 'expired').length, color: "from-slate-400 to-slate-500" },
        ].map((stat) => (
          <Card key={stat.label} className="border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-card/80 backdrop-blur">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className={cn("text-2xl font-bold bg-gradient-to-r bg-clip-text text-transparent", stat.color)}>
                {stat.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Contracts List */}
      <Card className="border-0 shadow-lg bg-card/80 backdrop-blur overflow-hidden">
        <CardHeader className="border-b bg-muted/30">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="flex items-center gap-2">
              <span>{t('contracts.contractsList')}</span>
              <Badge variant="secondary" className="ml-2">{filteredPolicies.length}</Badge>
            </CardTitle>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('contracts.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredPolicies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <FileCheck className="h-16 w-16 mb-4 opacity-20" />
              <p className="text-lg font-medium">
                {searchQuery ? t('common.noResults') : t('contracts.noContracts')}
              </p>
              <p className="text-sm">
                {searchQuery ? t('contracts.tryDifferentSearch') : t('contracts.noContractsDesc')}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filteredPolicies.map((policy, index) => {
                const clientName = policy.client?.company_name || 
                  `${policy.client?.first_name || ''} ${policy.client?.last_name || ''}`.trim() || 
                  'Client inconnu';
                const status = statusConfig[policy.status] || statusConfig.pending;
                
                return (
                  <div
                    key={policy.id}
                    className="group flex items-center justify-between p-5 hover:bg-muted/50 transition-all duration-300 cursor-pointer"
                    onClick={() => navigate(`/crm/clients/${policy.client_id}?tab=contracts`)}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-center gap-4">
                      {/* Company Logo or Icon */}
                      {policy.product?.company?.logo_url ? (
                        <div className="w-12 h-12 rounded-xl bg-white border border-border flex items-center justify-center overflow-hidden p-1 group-hover:scale-110 transition-transform">
                          <img 
                            src={policy.product.company.logo_url} 
                            alt={policy.product.company.name}
                            className="h-full w-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <FileCheck className="h-6 w-6 text-primary" />
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                          {policy.product?.name || 'Produit inconnu'}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          <span>{policy.product?.company?.name}</span>
                          <span className="text-border">•</span>
                          <span>{clientName}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="text-right hidden sm:block">
                        <p className="font-bold text-lg">{policy.premium_monthly} CHF<span className="text-sm font-normal text-muted-foreground">/mois</span></p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {new Date(policy.start_date).toLocaleDateString('fr-CH')}
                        </div>
                      </div>
                      
                      <Badge className={cn("font-medium", status.bgColor, status.color)}>
                        {status.label}
                      </Badge>
                      
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/crm/clients/${policy.client_id}?tab=contracts`);
                        }}
                      >
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
