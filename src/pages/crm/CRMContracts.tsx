import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePolicies } from "@/hooks/usePolicies";
import { usePermissions } from "@/hooks/usePermissions";
import { InsuranceCompanyLogo } from "@/components/crm/InsuranceCompanyLogo";
import { DataPagination } from "@/components/ui/DataPagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, FileCheck, ChevronRight, ChevronDown, Building2, Calendar, Search, Check, User, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ContractClientOption {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
}

export default function CRMContracts() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { can, isLoading: permissionsLoading } = usePermissions();
  const { policies, loading, page, totalCount, totalPages, goToPage } = usePolicies();
  const [searchQuery, setSearchQuery] = useState("");
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  // Contrat actuellement déplié (click = expand pour voir le détail)
  const [expandedPolicyId, setExpandedPolicyId] = useState<string | null>(null);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientOptions, setClientOptions] = useState<ContractClientOption[]>([]);

  const canCreateContract = can('contracts', 'deposit');

  const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
    pending: { label: t('contracts.pending'), color: "text-amber-700", bgColor: "bg-amber-100" },
    active: { label: t('contracts.active'), color: "text-emerald-700", bgColor: "bg-emerald-100" },
    expired: { label: t('contracts.expired'), color: "text-slate-700", bgColor: "bg-slate-100" },
    cancelled: { label: t('contracts.cancelled'), color: "text-red-700", bgColor: "bg-red-100" },
  };

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

  useEffect(() => {
    if (!clientPickerOpen || !canCreateContract) {
      return;
    }

    const loadClients = async () => {
      setClientsLoading(true);

      let query = supabase
        .from('clients')
        .select('id, first_name, last_name, company_name, email')
        .eq('type_adresse', 'client')
        .order('company_name', { ascending: true })
        .order('last_name', { ascending: true })
        .order('first_name', { ascending: true })
        .limit(25);

      const normalizedSearch = clientSearch.trim();
      if (normalizedSearch) {
        const safeSearch = normalizedSearch.replace(/[%_,]/g, '').trim();
        if (safeSearch) {
          query = query.or(
            `company_name.ilike.%${safeSearch}%,first_name.ilike.%${safeSearch}%,last_name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%`
          );
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading clients for contract creation:', error);
        toast({
          title: t('common.error'),
          description: "Impossible de charger les clients pour créer un contrat.",
          variant: 'destructive',
        });
        setClientOptions([]);
      } else {
        setClientOptions((data || []) as ContractClientOption[]);
      }

      setClientsLoading(false);
    };

    void loadClients();
  }, [canCreateContract, clientPickerOpen, clientSearch, t, toast]);

  const getClientLabel = (client: ContractClientOption) => {
    if (client.company_name) {
      return client.company_name;
    }

    return `${client.first_name || ''} ${client.last_name || ''}`.trim() || 'Client sans nom';
  };

  const handleNewContractClick = () => {
    if (permissionsLoading) {
      return;
    }

    if (!canCreateContract) {
      toast({
        title: t('common.error'),
        description: "Vous n'avez pas les permissions pour créer un contrat.",
        variant: 'destructive',
      });
      return;
    }

    setClientSearch("");
    setClientPickerOpen(true);
  };

  const handleSelectClient = (clientId: string) => {
    setClientPickerOpen(false);
    navigate(`/crm/clients/${clientId}?tab=contracts&newContract=1`);
  };

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
        <Button
          onClick={handleNewContractClick}
          disabled={permissionsLoading}
          className="group bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary shadow-lg shadow-primary/20"
        >
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
                const isExpanded = expandedPolicyId === policy.id;
                const productsDataList = Array.isArray((policy as any).products_data) ? (policy as any).products_data : [];

                return (
                  <div
                    key={policy.id}
                    className={cn(
                      "group hover:bg-muted/50 transition-all duration-300 cursor-pointer",
                      isExpanded && "bg-muted/30 border-l-4 border-l-primary"
                    )}
                    onClick={() => setExpandedPolicyId((prev) => (prev === policy.id ? null : policy.id))}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                  <div className="flex items-center justify-between p-5">
                    <div className="flex items-center gap-4">
                      {/* Company Logo or Icon */}
                      {policy.product?.company?.name ? (
                        <InsuranceCompanyLogo
                          name={policy.product.company.name}
                          logoUrl={policy.product.company.logo_url}
                          size="lg"
                          className="group-hover:scale-110 transition-transform"
                        />
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

                      {/* Chevron : toggle expand/collapse */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground"
                        title={isExpanded ? "Replier" : "Voir le détail"}
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedPolicyId((prev) => (prev === policy.id ? null : policy.id));
                        }}
                      >
                        {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                      </Button>

                      {/* Ouvrir le client (icône secondaire, visible au hover) */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Ouvrir la fiche client"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/crm/clients/${policy.client_id}?tab=contracts`);
                        }}
                      >
                        <User className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>

                  {/* Détail du contrat — visible quand expanded */}
                  {isExpanded && (
                    <div
                      className="px-5 pb-5 pt-2 border-t border-border/30 space-y-3 text-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground">N° police</p>
                          <p className="font-medium">{(policy as any).policy_number || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Date début</p>
                          <p className="font-medium">
                            {policy.start_date ? new Date(policy.start_date).toLocaleDateString('fr-CH') : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Date fin</p>
                          <p className="font-medium">
                            {(policy as any).end_date ? new Date((policy as any).end_date).toLocaleDateString('fr-CH') : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Prime annuelle</p>
                          <p className="font-medium">
                            {(policy as any).premium_yearly ? `${Number((policy as any).premium_yearly).toFixed(2)} CHF` : '—'}
                          </p>
                        </div>
                      </div>

                      {productsDataList.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-2">Produits ({productsDataList.length})</p>
                          <div className="space-y-1.5">
                            {productsDataList.map((prod: any, idx: number) => {
                              const isLppProd = prod?.avoirTotal != null || /libre[\s_-]?passage|\bLPP\b|2e?\s*pilier|prévoyance prof/i.test(prod?.name || '');
                              return (
                                <div key={idx} className="flex items-center justify-between gap-3 p-2 bg-muted/30 rounded text-xs">
                                  <div className="flex-1 min-w-0 truncate">
                                    <span className="font-medium">{prod?.name || 'Produit'}</span>
                                    {isLppProd && (
                                      <Badge variant="outline" className="ml-2 text-[10px] bg-amber-50 text-amber-700 border-amber-300">
                                        LPP
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex-shrink-0 text-right">
                                    {isLppProd && prod?.avoirTotal != null ? (
                                      <span className="font-semibold text-amber-700">
                                        Avoir total : {Number(prod.avoirTotal).toLocaleString('fr-CH')} CHF
                                      </span>
                                    ) : (
                                      <>
                                        {prod?.premium != null && Number(prod.premium) > 0 && (
                                          <span className="font-medium">{Number(prod.premium).toFixed(2)} CHF/mois</span>
                                        )}
                                        {prod?.deductible != null && Number(prod.deductible) > 0 && (
                                          <span className="ml-2 text-muted-foreground">Fr. {prod.deductible} CHF</span>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {(policy as any).notes && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Notes</p>
                          <p className="whitespace-pre-wrap text-xs bg-muted/30 p-2 rounded">{(policy as any).notes}</p>
                        </div>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/crm/clients/${policy.client_id}?tab=contracts`);
                        }}
                      >
                        <User className="h-4 w-4 mr-2" />
                        Ouvrir la fiche client
                      </Button>
                    </div>
                  )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <DataPagination
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        onPageChange={goToPage}
      />

      <Dialog open={clientPickerOpen} onOpenChange={setClientPickerOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('contracts.newContract')}</DialogTitle>
            <DialogDescription>
              Selectionnez d'abord un client pour ouvrir le formulaire de contrat.
            </DialogDescription>
          </DialogHeader>

          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Rechercher un client..."
              value={clientSearch}
              onValueChange={setClientSearch}
            />
            <CommandList>
              {clientsLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Chargement des clients...
                </div>
              ) : (
                <>
                  <CommandEmpty>Aucun client trouvé.</CommandEmpty>
                  <CommandGroup>
                    {clientOptions.map((client) => (
                      <CommandItem
                        key={client.id}
                        value={client.id}
                        onSelect={() => handleSelectClient(client.id)}
                      >
                        <Check className="mr-2 h-4 w-4 opacity-0" />
                        <div className="flex flex-col">
                          <span className="font-medium flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {getClientLabel(client)}
                          </span>
                          {client.email && (
                            <span className="text-xs text-muted-foreground">{client.email}</span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>

          {!clientsLoading && clientOptions.length === 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setClientPickerOpen(false);
                navigate('/crm/clients/nouveau');
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Créer un client
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
