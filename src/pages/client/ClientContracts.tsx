import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  FileText, 
  ChevronDown, 
  ChevronUp,
  Heart,
  Car,
  Home,
  Shield,
  Scale,
  Download,
  Eye,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const categoryIcons: Record<string, any> = {
  health: Heart,
  auto: Car,
  home: Home,
  life: Shield,
  legal: Scale,
  property: Home,
  other: Shield,
};

const getCategoryLabels = (t: (key: string) => string): Record<string, string> => ({
  health: t('clientSpace.categories.health'),
  auto: t('clientSpace.categories.auto'),
  home: t('clientSpace.categories.home'),
  life: t('clientSpace.categories.life'),
  legal: t('clientSpace.categories.legal'),
  property: t('clientSpace.categories.property'),
  multi: t('clientSpace.categories.multi'),
  other: t('clientSpace.categories.other'),
});

const getStatusConfig = (t: (key: string) => string): Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any; color: string }> => ({
  active: { label: t('clientSpace.status.active'), variant: "default", icon: CheckCircle2, color: "text-emerald-600" },
  pending: { label: t('clientSpace.status.pending'), variant: "secondary", icon: Clock, color: "text-amber-600" },
  cancelled: { label: t('clientSpace.status.cancelled'), variant: "destructive", icon: AlertCircle, color: "text-destructive" },
});

export default function ClientContracts() {
  const { t } = useTranslation();
  const { clientData } = useOutletContext<{ user: any; clientData: any }>();
  const [contracts, setContracts] = useState<any[]>([]);
  const [policyDocuments, setPolicyDocuments] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const categoryLabels = getCategoryLabels(t);
  const statusConfig = getStatusConfig(t);

  useEffect(() => {
    if (clientData?.id) {
      fetchContracts();
    }
  }, [clientData]);

  const fetchContracts = async () => {
    setLoading(true);
    
    const { data } = await supabase
      .from('policies')
      .select(`
        *,
        product:insurance_products!policies_product_id_fkey (
          id, name, category,
          company:insurance_companies!insurance_products_company_id_fkey (name, logo_url)
        )
      `)
      .eq('client_id', clientData.id)
      .order('created_at', { ascending: false });
    
    if (data) {
      setContracts(data);
      
      // Fetch policy documents for each contract
      const policyIds = data.map(c => c.id) as string[];
      if (policyIds.length > 0) {
        const { data: docs } = await supabase
          .from('documents')
          .select('*')
          .eq('owner_type', 'policy')
          .in('owner_id', policyIds)
          .or('document_type.eq.police,document_type.eq.police_assurance,document_type.ilike.%Police%');
        
        if (docs) {
          const docsMap: Record<string, any> = {};
          docs.forEach(doc => {
            // Store the first matching document per policy
            if (!docsMap[doc.owner_id]) {
              docsMap[doc.owner_id] = doc;
            }
          });
          setPolicyDocuments(docsMap);
        }
      }
    }
    setLoading(false);
  };

  const handleViewDocument = async (doc: any) => {
    if (!doc?.file_path) return;
    
    const { data } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.file_path, 3600);
    
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    }
  };

  const handleDownloadDocument = async (doc: any) => {
    if (!doc?.file_path) return;
    
    const { data } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.file_path, 3600);
    
    if (data?.signedUrl) {
      const link = document.createElement('a');
      link.href = data.signedUrl;
      link.download = doc.file_name || 'police-assurance.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF' }).format(amount);
  };

  const activeContracts = contracts.filter(c => c.status === 'active');
  const otherContracts = contracts.filter(c => c.status !== 'active');

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      <div>
        <h1 className="text-xl lg:text-2xl font-bold">{t('clientSpace.myContracts')}</h1>
        <p className="text-sm lg:text-base text-muted-foreground">{t('clientSpace.findAllContracts')}</p>
      </div>

      {/* Stats - Horizontal scroll on mobile */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 lg:mx-0 lg:px-0 lg:grid lg:grid-cols-3 lg:overflow-visible scrollbar-hide">
        <Card className="min-w-[130px] lg:min-w-0 flex-shrink-0">
          <CardContent className="p-3 lg:p-4 flex items-center gap-2 lg:gap-3">
            <div className="h-9 w-9 lg:h-10 lg:w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 lg:h-5 lg:w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xl lg:text-2xl font-bold">{activeContracts.length}</p>
              <p className="text-[10px] lg:text-sm text-muted-foreground">{t('clientSpace.activeContracts')}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="min-w-[120px] lg:min-w-0 flex-shrink-0">
          <CardContent className="p-3 lg:p-4 flex items-center gap-2 lg:gap-3">
            <div className="h-9 w-9 lg:h-10 lg:w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-4 w-4 lg:h-5 lg:w-5 text-primary" />
            </div>
            <div>
              <p className="text-xl lg:text-2xl font-bold">{contracts.length}</p>
              <p className="text-[10px] lg:text-sm text-muted-foreground">{t('clientSpace.totalContracts')}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="min-w-[150px] lg:min-w-0 flex-shrink-0">
          <CardContent className="p-3 lg:p-4 flex items-center gap-2 lg:gap-3">
            <div className="h-9 w-9 lg:h-10 lg:w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Shield className="h-4 w-4 lg:h-5 lg:w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-lg lg:text-2xl font-bold">
                {formatCurrency(activeContracts.reduce((sum, c) => sum + (Number(c.premium_monthly) || 0), 0))}
              </p>
              <p className="text-[10px] lg:text-sm text-muted-foreground">{t('clientSpace.monthlyPremium')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contracts List */}
      {contracts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 lg:h-16 lg:w-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-base lg:text-lg font-medium mb-2">{t('clientSpace.noContract')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('clientSpace.noContractRegistered')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 lg:space-y-4">
          {contracts.map((contract) => {
            const category = contract.product?.category || contract.product_type || 'other';
            const Icon = categoryIcons[category] || Shield;
            const status = statusConfig[contract.status] || statusConfig.active;
            const StatusIcon = status.icon;
            const isExpanded = expandedId === contract.id;
            const productsData = contract.products_data as any[] | null;
            
            return (
              <Collapsible 
                key={contract.id} 
                open={isExpanded}
                onOpenChange={() => setExpandedId(isExpanded ? null : contract.id)}
              >
                <Card className="overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors p-3 lg:p-6 active:bg-muted/70">
                      <div className="flex items-center gap-3 lg:gap-4">
                        {/* Company Logo or Category Icon */}
                        {contract.product?.company?.logo_url ? (
                          <div className="h-10 w-10 lg:h-12 lg:w-12 rounded-xl bg-background border border-border flex items-center justify-center overflow-hidden p-1 flex-shrink-0">
                            <img 
                              src={contract.product.company.logo_url} 
                              alt={contract.product.company.name}
                              className="h-full w-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="h-10 w-10 lg:h-12 lg:w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Icon className="h-5 w-5 lg:h-6 lg:w-6 text-primary" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 lg:mb-1 flex-wrap">
                            <CardTitle className="text-sm lg:text-base truncate">
                              {contract.product?.name || categoryLabels[category] || t('contracts.title')}
                            </CardTitle>
                            <Badge variant={status.variant} className="gap-1 text-[10px] lg:text-xs h-5 lg:h-6 flex-shrink-0">
                              <StatusIcon className="h-2.5 w-2.5 lg:h-3 lg:w-3" />
                              {status.label}
                            </Badge>
                          </div>
                          <p className="text-xs lg:text-sm text-muted-foreground truncate">
                            {contract.company_name || contract.product?.company?.name}
                            {contract.policy_number && <span className="hidden sm:inline"> • N° {contract.policy_number}</span>}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-sm lg:text-lg">
                            {formatCurrency(Number(contract.premium_monthly) || 0)}
                            <span className="text-[10px] lg:text-sm font-normal text-muted-foreground">{t('clientSpace.perMonth')}</span>
                          </p>
                          <p className="text-[10px] lg:text-sm text-muted-foreground hidden sm:block">
                            {formatCurrency(Number(contract.premium_yearly) || 0)}{t('clientSpace.perYear')}
                          </p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 lg:h-10 lg:w-10 flex-shrink-0">
                          {isExpanded ? <ChevronUp className="h-4 w-4 lg:h-5 lg:w-5" /> : <ChevronDown className="h-4 w-4 lg:h-5 lg:w-5" />}
                        </Button>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <CardContent className="pt-0 border-t p-3 lg:p-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 pt-3 lg:pt-4">
                        {/* Contract Details */}
                        <div className="space-y-3 lg:space-y-4">
                          <h4 className="font-medium text-xs lg:text-sm text-muted-foreground uppercase tracking-wide">
                            {t('clientSpace.contractDetails')}
                          </h4>
                          <div className="space-y-2 lg:space-y-3">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span className="text-xs lg:text-sm">
                                {t('clientSpace.startDate')}: {format(new Date(contract.start_date), 'dd MMM yyyy', { locale: fr })}
                              </span>
                            </div>
                            {contract.end_date && (
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <span className="text-xs lg:text-sm">
                                  {t('clientSpace.endDate')}: {format(new Date(contract.end_date), 'dd MMM yyyy', { locale: fr })}
                                </span>
                              </div>
                            )}
                            {contract.deductible && (
                              <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <span className="text-xs lg:text-sm">
                                  {t('clientSpace.deductible')}: {formatCurrency(Number(contract.deductible))}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Products included */}
                          {productsData && productsData.length > 0 && (
                            <div className="space-y-3 lg:space-y-4">
                              <h4 className="font-medium text-xs lg:text-sm text-muted-foreground uppercase tracking-wide">
                                {t('clientSpace.productsIncluded')}
                            </h4>
                            <div className="space-y-2">
                              {productsData.map((prod, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                                  <span className="text-xs lg:text-sm">{prod.name}</span>
                                  <span className="text-xs lg:text-sm font-medium">
                                    {formatCurrency(prod.premium || 0)}{t('clientSpace.perMonth')}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Actions - Policy Document */}
                      <div className="mt-4 lg:mt-6 pt-3 lg:pt-4 border-t">
                        {policyDocuments[contract.id] ? (
                          <div className="flex gap-2 flex-wrap">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="gap-2 h-9 lg:h-10 text-xs lg:text-sm"
                              onClick={() => handleViewDocument(policyDocuments[contract.id])}
                            >
                              <Eye className="h-4 w-4" />
                              {t('clientSpace.viewPolicy')}
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="gap-2 h-9 lg:h-10 text-xs lg:text-sm"
                              onClick={() => handleDownloadDocument(policyDocuments[contract.id])}
                            >
                              <Download className="h-4 w-4" />
                              {t('clientSpace.download')}
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-dashed">
                            <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                              <AlertCircle className="h-4 w-4 text-amber-600" />
                            </div>
                            <div>
                              <p className="text-xs lg:text-sm font-medium">{t('clientSpace.documentUnavailable')}</p>
                              <p className="text-[10px] lg:text-xs text-muted-foreground">
                                {t('clientSpace.policyWillBeAdded')}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}
