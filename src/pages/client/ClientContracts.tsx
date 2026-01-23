import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
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

const categoryLabels: Record<string, string> = {
  health: "Santé",
  auto: "Auto",
  home: "Ménage/RC",
  life: "Vie/Prévoyance",
  legal: "Protection juridique",
  property: "Ménage/RC",
  multi: "Multi-produits",
  other: "Autre",
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any; color: string }> = {
  active: { label: "Actif", variant: "default", icon: CheckCircle2, color: "text-emerald-600" },
  pending: { label: "En attente", variant: "secondary", icon: Clock, color: "text-amber-600" },
  cancelled: { label: "Résilié", variant: "destructive", icon: AlertCircle, color: "text-destructive" },
};

export default function ClientContracts() {
  const { clientData } = useOutletContext<{ user: any; clientData: any }>();
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
    
    if (data) setContracts(data);
    setLoading(false);
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mes contrats</h1>
        <p className="text-muted-foreground">Retrouvez tous vos contrats d'assurance</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeContracts.length}</p>
              <p className="text-sm text-muted-foreground">Contrats actifs</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{contracts.length}</p>
              <p className="text-sm text-muted-foreground">Total contrats</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Shield className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {formatCurrency(activeContracts.reduce((sum, c) => sum + (Number(c.premium_monthly) || 0), 0))}
              </p>
              <p className="text-sm text-muted-foreground">Prime mensuelle</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contracts List */}
      {contracts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">Aucun contrat</h3>
            <p className="text-muted-foreground">
              Vous n'avez pas encore de contrat enregistré
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
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
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-4">
                        {/* Company Logo or Category Icon */}
                        {contract.product?.company?.logo_url ? (
                          <div className="h-12 w-12 rounded-xl bg-white border border-border flex items-center justify-center overflow-hidden p-1">
                            <img 
                              src={contract.product.company.logo_url} 
                              alt={contract.product.company.name}
                              className="h-full w-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Icon className="h-6 w-6 text-primary" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <CardTitle className="text-base truncate">
                              {contract.product?.name || categoryLabels[category] || 'Contrat'}
                            </CardTitle>
                            <Badge variant={status.variant} className="gap-1">
                              <StatusIcon className="h-3 w-3" />
                              {status.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {contract.company_name || contract.product?.company?.name}
                            {contract.policy_number && ` • N° ${contract.policy_number}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">
                            {formatCurrency(Number(contract.premium_monthly) || 0)}
                            <span className="text-sm font-normal text-muted-foreground">/mois</span>
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatCurrency(Number(contract.premium_yearly) || 0)}/an
                          </p>
                        </div>
                        <Button variant="ghost" size="icon">
                          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </Button>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <CardContent className="pt-0 border-t">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                        {/* Contract Details */}
                        <div className="space-y-4">
                          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                            Détails du contrat
                          </h4>
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">
                                Début: {format(new Date(contract.start_date), 'dd MMMM yyyy', { locale: fr })}
                              </span>
                            </div>
                            {contract.end_date && (
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">
                                  Fin: {format(new Date(contract.end_date), 'dd MMMM yyyy', { locale: fr })}
                                </span>
                              </div>
                            )}
                            {contract.deductible && (
                              <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">
                                  Franchise: {formatCurrency(Number(contract.deductible))}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Products included */}
                        {productsData && productsData.length > 0 && (
                          <div className="space-y-4">
                            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                              Produits inclus
                            </h4>
                            <div className="space-y-2">
                              {productsData.map((prod, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                                  <span className="text-sm">{prod.name}</span>
                                  <span className="text-sm font-medium">
                                    {formatCurrency(prod.premium || 0)}/mois
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Actions */}
                      <div className="flex gap-2 mt-6 pt-4 border-t">
                        <Button variant="outline" size="sm" className="gap-2">
                          <Eye className="h-4 w-4" />
                          Voir le document
                        </Button>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Download className="h-4 w-4" />
                          Télécharger
                        </Button>
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
