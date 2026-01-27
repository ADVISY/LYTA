import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  AlertTriangle, 
  Plus, 
  Clock, 
  CheckCircle2, 
  XCircle,
  FileSearch,
  Car,
  Heart,
  Home,
  Scale,
  Shield,
  ChevronDown,
  ChevronUp,
  FileText,
  Download,
  MapPin,
  Users,
  FileWarning
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import ClaimForm from "@/components/client/ClaimForm";

interface ClaimDocument {
  document_id: string;
  document: {
    id: string;
    file_name: string;
    file_key: string;
    mime_type: string | null;
  };
}

interface Claim {
  id: string;
  client_id: string;
  policy_id: string | null;
  claim_type: string;
  incident_date: string;
  description: string;
  status: string;
  created_at: string;
  location?: string;
  circumstances?: string;
  damage_amount?: number;
  third_party_involved?: boolean;
  third_party_info?: any;
  police_report_number?: string;
  witnesses?: string;
  additional_info?: any;
  policy?: {
    id: string;
    product_type: string;
    company_name: string;
    product?: {
      company?: {
        logo_url: string | null;
      };
    };
  };
  claim_documents?: ClaimDocument[];
}

const getClaimTypeConfig = (t: (key: string) => string): Record<string, { label: string; icon: any; color: string }> => ({
  auto: { label: t('clientClaims.types.auto'), icon: Car, color: "text-blue-600 bg-blue-100" },
  sante: { label: t('clientClaims.types.health'), icon: Heart, color: "text-red-600 bg-red-100" },
  menage: { label: t('clientClaims.types.household'), icon: Home, color: "text-amber-600 bg-amber-100" },
  juridique: { label: t('clientClaims.types.legal'), icon: Scale, color: "text-purple-600 bg-purple-100" },
  autre: { label: t('clientClaims.types.other'), icon: Shield, color: "text-gray-600 bg-gray-100" },
});

const getStatusConfig = (t: (key: string) => string): Record<string, { label: string; icon: any; variant: "default" | "secondary" | "destructive" | "outline" }> => ({
  submitted: { label: t('clientClaims.statuses.submitted'), icon: Clock, variant: "secondary" },
  in_review: { label: t('clientClaims.statuses.inReview'), icon: FileSearch, variant: "default" },
  approved: { label: t('clientClaims.statuses.approved'), icon: CheckCircle2, variant: "default" },
  rejected: { label: t('clientClaims.statuses.rejected'), icon: XCircle, variant: "destructive" },
  closed: { label: t('clientClaims.statuses.closed'), icon: CheckCircle2, variant: "outline" },
});

export default function ClientClaims() {
  const { t } = useTranslation();
  const { clientData } = useOutletContext<{ user: any; clientData: any }>();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const claimTypeConfig = getClaimTypeConfig(t);
  const statusConfig = getStatusConfig(t);

  useEffect(() => {
    if (clientData?.id) {
      fetchClaims();
    }
  }, [clientData]);

  const fetchClaims = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('claims')
      .select(`
        *,
        policy:policies!claims_policy_id_fkey (
          id, product_type, company_name,
          product:insurance_products!policies_product_id_fkey (
            company:insurance_companies!insurance_products_company_id_fkey (logo_url)
          )
        ),
        claim_documents (
          document_id,
          document:documents!claim_documents_document_id_fkey (
            id, file_name, file_key, mime_type
          )
        )
      `)
      .eq('client_id', clientData.id)
      .order('created_at', { ascending: false });
    
    if (data) setClaims(data);
    setLoading(false);
  };

  const handleClaimCreated = () => {
    setDialogOpen(false);
    fetchClaims();
  };

  const pendingClaims = claims.filter(c => ['submitted', 'in_review'].includes(c.status)).length;
  const resolvedClaims = claims.filter(c => ['approved', 'closed'].includes(c.status)).length;
  
  const handleDownloadDocument = async (fileKey: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(fileKey, 3600);
      
      if (error) throw error;
      
      // Open in new tab or trigger download
      const link = document.createElement('a');
      link.href = data.signedUrl;
      link.download = fileName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('clientClaims.title')}</h1>
          <p className="text-muted-foreground">{t('clientClaims.subtitle')}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              {t('clientClaims.declareClaim')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                {t('clientClaims.newDeclaration')}
              </DialogTitle>
            </DialogHeader>
            <ClaimForm 
              clientId={clientData.id} 
              onSuccess={handleClaimCreated}
              onCancel={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{claims.length}</p>
              <p className="text-sm text-muted-foreground">{t('clientClaims.stats.total')}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingClaims}</p>
              <p className="text-sm text-muted-foreground">{t('clientClaims.stats.pending')}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{resolvedClaims}</p>
              <p className="text-sm text-muted-foreground">{t('clientClaims.stats.resolved')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Claims List */}
      {claims.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">{t('clientClaims.noClaims')}</h3>
            <p className="text-muted-foreground mb-4">
              {t('clientClaims.noClaimsDescription')}
            </p>
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              {t('clientClaims.declareClaim')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {claims.map((claim) => {
            const typeConfig = claimTypeConfig[claim.claim_type] || claimTypeConfig.autre;
            const status = statusConfig[claim.status] || statusConfig.submitted;
              const TypeIcon = typeConfig.icon;
              const StatusIcon = status.icon;
              const isExpanded = expandedId === claim.id;
              const documents = claim.claim_documents || [];
              
              return (
                <Collapsible
                  key={claim.id}
                  open={isExpanded}
                  onOpenChange={() => setExpandedId(isExpanded ? null : claim.id)}
                >
                  <Card className="overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <CardContent className="p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-start gap-4">
                          {/* Company logo or type icon */}
                          {claim.policy?.product?.company?.logo_url ? (
                            <div className="h-12 w-12 rounded-xl bg-white border border-border flex items-center justify-center overflow-hidden p-1 flex-shrink-0">
                              <img 
                                src={claim.policy.product.company.logo_url} 
                                alt={claim.policy.company_name}
                                className="h-full w-full object-contain"
                              />
                            </div>
                          ) : (
                            <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${typeConfig.color}`}>
                              <TypeIcon className="h-6 w-6" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div>
                                <p className="font-semibold">{typeConfig.label}</p>
                                {claim.policy && (
                                  <p className="text-sm text-muted-foreground">
                                    {claim.policy.company_name} - {claim.policy.product_type}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={status.variant} className="gap-1 flex-shrink-0">
                                  <StatusIcon className="h-3 w-3" />
                                  {status.label}
                                </Badge>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </Button>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                              {claim.description}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>
                                {t('clientClaims.incidentDate')}: {format(new Date(claim.incident_date), 'dd MMM yyyy', { locale: fr })}
                              </span>
                              <span>
                                {t('clientClaims.declaredOn')}: {format(new Date(claim.created_at), 'dd MMM yyyy', { locale: fr })}
                              </span>
                              {documents.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <FileText className="h-3 w-3" />
                                  {documents.length} {t('clientClaims.documents', { count: documents.length })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                      <CardContent className="pt-0 border-t bg-muted/20">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                          {/* Claim Details */}
                          <div className="space-y-4">
                            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                              {t('clientClaims.details.title')}
                            </h4>
                            <div className="space-y-3">
                              <div>
                                <p className="text-xs text-muted-foreground">{t('clientClaims.details.fullDescription')}</p>
                                <p className="text-sm">{claim.description}</p>
                              </div>
                              
                              {claim.location && (
                                <div className="flex items-start gap-2">
                                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                                  <div>
                                    <p className="text-xs text-muted-foreground">{t('clientClaims.details.location')}</p>
                                    <p className="text-sm">{claim.location}</p>
                                  </div>
                                </div>
                              )}
                              
                              {claim.circumstances && (
                                <div>
                                  <p className="text-xs text-muted-foreground">{t('clientClaims.details.circumstances')}</p>
                                  <p className="text-sm">{claim.circumstances}</p>
                                </div>
                              )}
                              
                              {claim.damage_amount && (
                                <div className="flex items-center gap-2">
                                  <FileWarning className="h-4 w-4 text-muted-foreground" />
                                  <div>
                                    <p className="text-xs text-muted-foreground">{t('clientClaims.details.estimatedDamage')}</p>
                                    <p className="text-sm font-medium">
                                      {new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF' }).format(claim.damage_amount)}
                                    </p>
                                  </div>
                                </div>
                              )}
                              
                              {claim.third_party_involved && (
                                <div className="flex items-start gap-2">
                                  <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
                                  <div>
                                    <p className="text-xs text-muted-foreground">{t('clientClaims.details.thirdParty')}</p>
                                    <p className="text-sm">{t('common.yes')}</p>
                                    {claim.third_party_info && typeof claim.third_party_info === 'object' && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {claim.third_party_info.name || claim.third_party_info.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}
                              
                              {claim.police_report_number && (
                                <div>
                                  <p className="text-xs text-muted-foreground">{t('clientClaims.details.policeReport')}</p>
                                  <p className="text-sm font-mono">{claim.police_report_number}</p>
                                </div>
                              )}
                              
                              {claim.witnesses && (
                                <div>
                                  <p className="text-xs text-muted-foreground">{t('clientClaims.details.witnesses')}</p>
                                  <p className="text-sm">{claim.witnesses}</p>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Documents */}
                          <div className="space-y-4">
                            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                              {t('clientClaims.attachedDocuments')} ({documents.length})
                            </h4>
                            {documents.length === 0 ? (
                              <p className="text-sm text-muted-foreground">{t('clientClaims.noDocuments')}</p>
                            ) : (
                              <div className="space-y-2">
                                {documents.map((doc) => (
                                  <div 
                                    key={doc.document_id}
                                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                                  >
                                    <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                                    <span className="text-sm flex-1 truncate">{doc.document.file_name}</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDownloadDocument(doc.document.file_key, doc.document.file_name);
                                      }}
                                      className="gap-1"
                                    >
                                      <Download className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
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