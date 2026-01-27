import { useState, useEffect } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  FileText, 
  Send, 
  Eye, 
  MessageCircle, 
  ChevronRight,
  Heart,
  Car,
  Home,
  Shield,
  Scale,
  AlertCircle,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Phone,
  Mail,
  Building2,
  MapPin,
  Globe
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useTenant } from "@/contexts/TenantContext";

const categoryIcons: Record<string, any> = {
  health: Heart,
  auto: Car,
  home: Home,
  life: Shield,
  legal: Scale,
  property: Home,
  other: Shield,
};

const getStatusConfig = (t: (key: string) => string): Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> => ({
  active: { label: t('clientSpace.status.active'), variant: "default", icon: CheckCircle2 },
  pending: { label: t('clientSpace.status.pending'), variant: "secondary", icon: Clock },
  cancelled: { label: t('clientSpace.status.cancelled'), variant: "destructive", icon: AlertCircle },
});

type AdvisorData = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  photo_url: string | null;
};

export default function ClientDashboard() {
  const { t } = useTranslation();
  const { user, clientData, advisorData } = useOutletContext<{ 
    user: any; 
    clientData: any; 
    advisorData: AdvisorData | null;
  }>();
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const statusConfig = getStatusConfig(t);
  const [contracts, setContracts] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Get tenant branding info
  const branding = tenant?.branding;
  const cabinetName = branding?.display_name || tenant?.name || "Cabinet";
  const cabinetPhone = branding?.company_phone;
  const cabinetEmail = branding?.company_email;
  const cabinetLogo = branding?.logo_url;

  useEffect(() => {
    if (clientData?.id) {
      fetchData();
    }
  }, [clientData]);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch contracts
    const { data: policiesData } = await supabase
      .from('policies')
      .select(`
        *,
        product:insurance_products!policies_product_id_fkey (
          id, name, category,
          company:insurance_companies!insurance_products_company_id_fkey (name, logo_url)
        )
      `)
      .eq('client_id', clientData.id)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (policiesData) setContracts(policiesData);
    
    // Fetch documents
    const { data: docsData } = await supabase
      .from('documents')
      .select('*')
      .eq('owner_id', clientData.id)
      .eq('owner_type', 'client')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (docsData) setDocuments(docsData);
    
    setLoading(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF' }).format(amount);
  };

  const getFirstName = () => {
    return clientData?.first_name || user?.user_metadata?.first_name || 'Client';
  };

  // Advisor helpers
  const hasAdvisor = advisorData && (advisorData.first_name || advisorData.last_name);
  
  const getAdvisorName = () => {
    if (hasAdvisor) {
      return `${advisorData!.first_name || ''} ${advisorData!.last_name || ''}`.trim();
    }
    return null;
  };

  const getAdvisorInitials = () => {
    if (hasAdvisor) {
      return `${advisorData!.first_name?.[0] || ''}${advisorData!.last_name?.[0] || ''}`.toUpperCase();
    }
    return cabinetName[0]?.toUpperCase() || "C";
  };

  const getAdvisorPhone = () => advisorData?.mobile || advisorData?.phone || null;
  
  const formatPhoneForLink = (phone: string) => phone.replace(/\s/g, '').replace('+', '');
  
  const getWhatsAppLink = (phone: string) => `https://wa.me/${formatPhoneForLink(phone)}`;

  const activeContracts = contracts.filter(c => c.status === 'active').length;
  const totalPremium = contracts
    .filter(c => c.status === 'active')
    .reduce((sum, c) => sum + (Number(c.premium_monthly) || 0), 0);

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-xl lg:text-2xl font-bold">
          {t('clientSpace.welcome', { name: getFirstName() })}
        </h1>
        <p className="text-sm lg:text-base text-muted-foreground">
          {t('clientSpace.findAllInsurances')}
        </p>
      </div>

      {/* Quick Stats - Horizontal scroll on mobile */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 lg:mx-0 lg:px-0 lg:grid lg:grid-cols-3 lg:overflow-visible scrollbar-hide">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 min-w-[140px] lg:min-w-0 flex-shrink-0">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center gap-3 lg:gap-4">
              <div className="h-10 w-10 lg:h-12 lg:w-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <FileText className="h-5 w-5 lg:h-6 lg:w-6 text-primary" />
              </div>
              <div>
                <p className="text-xs lg:text-sm text-muted-foreground">{t('clientSpace.activeContracts')}</p>
                <p className="text-xl lg:text-2xl font-bold">{activeContracts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="min-w-[160px] lg:min-w-0 flex-shrink-0">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center gap-3 lg:gap-4">
              <div className="h-10 w-10 lg:h-12 lg:w-12 rounded-xl bg-secondary flex items-center justify-center">
                <Shield className="h-5 w-5 lg:h-6 lg:w-6 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-xs lg:text-sm text-muted-foreground">{t('clientSpace.monthlyPremium')}</p>
                <p className="text-xl lg:text-2xl font-bold">{formatCurrency(totalPremium)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="min-w-[140px] lg:min-w-0 flex-shrink-0">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center gap-3 lg:gap-4">
              <div className="h-10 w-10 lg:h-12 lg:w-12 rounded-xl bg-accent flex items-center justify-center">
                <MessageCircle className="h-5 w-5 lg:h-6 lg:w-6 text-accent-foreground" />
              </div>
              <div>
                <p className="text-xs lg:text-sm text-muted-foreground">{t('clientSpace.documents')}</p>
                <p className="text-xl lg:text-2xl font-bold">{documents.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Advisor & Cabinet Info Row - Stack on mobile */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Personal Advisor Card */}
        {hasAdvisor && (
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader className="pb-2 lg:pb-3">
              <div className="flex items-center justify-between">
            <CardTitle className="text-sm lg:text-base flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  {t('clientSpace.yourAdvisor')}
                </CardTitle>
                <Badge variant="secondary" className="text-[10px] lg:text-xs">{t('clientSpace.personal')}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 lg:gap-4">
                <Avatar className="h-12 w-12 lg:h-14 lg:w-14 ring-2 ring-primary/20">
                  {advisorData?.photo_url ? (
                    <AvatarImage 
                      src={advisorData.photo_url} 
                      alt={getAdvisorName() || "Conseiller"}
                      className="object-cover"
                    />
                  ) : null}
                  <AvatarFallback className="bg-primary text-primary-foreground text-base lg:text-lg font-medium">
                    {getAdvisorInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-base lg:text-lg">{getAdvisorName()}</p>
                  <p className="text-xs lg:text-sm text-muted-foreground">{t('clientSpace.insuranceAdvisor')}</p>
                  {advisorData?.email && (
                    <a 
                      href={`mailto:${advisorData.email}`}
                      className="text-xs lg:text-sm text-primary hover:underline block truncate"
                    >
                      {advisorData.email}
                    </a>
                  )}
                </div>
                {getAdvisorPhone() && (
                  <div className="flex flex-col gap-2">
                    <a 
                      href={`tel:${formatPhoneForLink(getAdvisorPhone()!)}`}
                      className="p-2.5 rounded-xl bg-muted hover:bg-muted/80 transition-colors"
                    >
                      <Phone className="h-5 w-5" />
                    </a>
                    <a 
                      href={getWhatsAppLink(getAdvisorPhone()!)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                    >
                      <MessageCircle className="h-5 w-5 text-emerald-600" />
                    </a>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cabinet Info Card */}
        <Card>
          <CardHeader className="pb-2 lg:pb-3">
            <CardTitle className="text-sm lg:text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {cabinetName}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 lg:gap-4">
              {cabinetLogo ? (
                <div className="h-12 w-12 lg:h-14 lg:w-14 rounded-xl bg-background border border-border flex items-center justify-center p-2">
                  <img 
                    src={cabinetLogo} 
                    alt={cabinetName} 
                    className="h-full w-full object-contain"
                  />
                </div>
              ) : (
                <div className="h-12 w-12 lg:h-14 lg:w-14 rounded-xl bg-muted flex items-center justify-center">
                  <Building2 className="h-5 w-5 lg:h-6 lg:w-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0 space-y-1">
                {cabinetPhone && (
                  <a 
                    href={`tel:${formatPhoneForLink(cabinetPhone)}`}
                    className="flex items-center gap-2 text-xs lg:text-sm hover:text-primary transition-colors"
                  >
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    {cabinetPhone}
                  </a>
                )}
                {cabinetEmail && (
                  <a 
                    href={`mailto:${cabinetEmail}`}
                    className="flex items-center gap-2 text-xs lg:text-sm hover:text-primary transition-colors"
                  >
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate">{cabinetEmail}</span>
                  </a>
                )}
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 text-xs lg:text-sm h-9 lg:h-10"
                onClick={() => navigate('/espace-client/messages')}
              >
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">{t('clientSpace.contact')}</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions - Horizontal scroll on mobile */}
      <Card>
        <CardHeader className="pb-2 lg:pb-3">
          <CardTitle className="text-sm lg:text-base">{t('clientSpace.quickActions')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 lg:gap-3 overflow-x-auto pb-1 -mx-2 px-2 lg:mx-0 lg:px-0 lg:flex-wrap scrollbar-hide">
            <Button variant="outline" className="gap-2 flex-shrink-0 h-10 lg:h-11 text-xs lg:text-sm" onClick={() => navigate('/espace-client/sinistres')}>
              <AlertTriangle className="h-4 w-4" />
              {t('clientSpace.declareClaim')}
            </Button>
            <Button variant="outline" className="gap-2 flex-shrink-0 h-10 lg:h-11 text-xs lg:text-sm" onClick={() => navigate('/espace-client/messages')}>
              <Send className="h-4 w-4" />
              {t('clientSpace.contact')}
            </Button>
            <Button variant="outline" className="gap-2 flex-shrink-0 h-10 lg:h-11 text-xs lg:text-sm" onClick={() => navigate('/espace-client/contrats')}>
              <Eye className="h-4 w-4" />
              {t('clientSpace.myContracts')}
            </Button>
            <Button variant="outline" className="gap-2 flex-shrink-0 h-10 lg:h-11 text-xs lg:text-sm" onClick={() => navigate('/espace-client/documents')}>
              <FileText className="h-4 w-4" />
              {t('clientSpace.documents')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Latest Contracts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 lg:pb-3">
          <div>
            <CardTitle className="text-sm lg:text-base">{t('clientSpace.yourRecentContracts')}</CardTitle>
            <p className="text-xs lg:text-sm text-muted-foreground">{t('clientSpace.insuranceOverview')}</p>
          </div>
          <Button variant="ghost" size="sm" className="gap-1 text-xs lg:text-sm h-8 lg:h-9" onClick={() => navigate('/espace-client/contrats')}>
            {t('clientSpace.seeAll')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : contracts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>{t('clientSpace.noContractsYet')}</p>
            </div>
          ) : (
            <div className="space-y-2 lg:space-y-3">
              {contracts.map((contract) => {
                const category = contract.product?.category || 'other';
                const Icon = categoryIcons[category] || Shield;
                const status = statusConfig[contract.status] || statusConfig.active;
                const StatusIcon = status.icon;
                
                return (
                  <div 
                    key={contract.id}
                    className="flex items-center gap-3 lg:gap-4 p-3 lg:p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors cursor-pointer active:scale-[0.98]"
                    onClick={() => navigate('/espace-client/contrats')}
                  >
                    {contract.product?.company?.logo_url ? (
                      <div className="h-10 w-10 rounded-lg bg-background border border-border flex items-center justify-center overflow-hidden p-1">
                        <img 
                          src={contract.product.company.logo_url} 
                          alt={contract.product.company.name}
                          className="h-full w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-sm lg:text-base">{contract.product?.name || contract.product_type}</p>
                      <p className="text-xs lg:text-sm text-muted-foreground truncate">{contract.company_name || contract.product?.company?.name}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-semibold text-sm lg:text-base">{formatCurrency(Number(contract.premium_monthly) || 0)}<span className="text-xs text-muted-foreground">{t('clientSpace.perMonth')}</span></p>
                      <Badge variant={status.variant} className="gap-1 text-[10px] lg:text-xs h-5 lg:h-6">
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Documents */}
      {documents.length > 0 && (
        <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 lg:pb-3">
            <CardTitle className="text-sm lg:text-base">{t('clientSpace.recentDocuments')}</CardTitle>
            <Button variant="ghost" size="sm" className="gap-1 text-xs lg:text-sm h-8 lg:h-9" onClick={() => navigate('/espace-client/documents')}>
              Voir tout
              <ChevronRight className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {documents.slice(0, 3).map((doc) => (
                <div 
                  key={doc.id}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer active:scale-[0.98]"
                >
                  <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(doc.created_at), 'dd MMM yyyy', { locale: fr })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
