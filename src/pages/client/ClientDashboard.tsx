import { useState, useEffect } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  AlertTriangle
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

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  active: { label: "Actif", variant: "default", icon: CheckCircle2 },
  pending: { label: "En attente", variant: "secondary", icon: Clock },
  cancelled: { label: "Résilié", variant: "destructive", icon: AlertCircle },
};

export default function ClientDashboard() {
  const { user, clientData, advisorData } = useOutletContext<{ user: any; clientData: any; advisorData: any }>();
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  const activeContracts = contracts.filter(c => c.status === 'active').length;
  const totalPremium = contracts
    .filter(c => c.status === 'active')
    .reduce((sum, c) => sum + (Number(c.premium_monthly) || 0), 0);

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-bold">
          Bienvenue {getFirstName()} 👋
        </h1>
        <p className="text-muted-foreground">
          Retrouvez toutes les informations sur vos assurances
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Contrats actifs</p>
                <p className="text-2xl font-bold">{activeContracts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Shield className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Prime mensuelle</p>
                <p className="text-2xl font-bold">{formatCurrency(totalPremium)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <MessageCircle className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Documents</p>
                <p className="text-2xl font-bold">{documents.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Actions rapides</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="gap-2" onClick={() => navigate('/espace-client/sinistres')}>
              <AlertTriangle className="h-4 w-4" />
              Déclarer un sinistre
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => navigate('/espace-client/messages')}>
              <Send className="h-4 w-4" />
              Contacter mon conseiller
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => navigate('/espace-client/contrats')}>
              <Eye className="h-4 w-4" />
              Voir mes contrats
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => navigate('/espace-client/documents')}>
              <FileText className="h-4 w-4" />
              Mes documents
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Latest Contracts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">Vos contrats récents</CardTitle>
            <p className="text-sm text-muted-foreground">Aperçu de vos assurances</p>
          </div>
          <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate('/espace-client/contrats')}>
            Voir tout
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
              <p>Aucun contrat pour le moment</p>
            </div>
          ) : (
            <div className="space-y-3">
              {contracts.map((contract) => {
                const category = contract.product?.category || 'other';
                const Icon = categoryIcons[category] || Shield;
                const status = statusConfig[contract.status] || statusConfig.active;
                const StatusIcon = status.icon;
                
                return (
                  <div 
                    key={contract.id}
                    className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => navigate('/espace-client/contrats')}
                  >
                    {contract.product?.company?.logo_url ? (
                      <div className="h-10 w-10 rounded-lg bg-white border border-border flex items-center justify-center overflow-hidden p-1">
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
                      <p className="font-medium truncate">{contract.product?.name || contract.product_type}</p>
                      <p className="text-sm text-muted-foreground">{contract.company_name || contract.product?.company?.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(Number(contract.premium_monthly) || 0)}/mois</p>
                      <Badge variant={status.variant} className="gap-1">
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
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Documents récents</CardTitle>
            <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate('/espace-client/documents')}>
              Voir tout
              <ChevronRight className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {documents.slice(0, 3).map((doc) => (
                <div 
                  key={doc.id}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <FileText className="h-5 w-5 text-muted-foreground" />
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
