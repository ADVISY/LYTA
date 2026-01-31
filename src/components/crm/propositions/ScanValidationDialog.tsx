import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserTenant } from "@/hooks/useUserTenant";
import { PendingScan, ScanField } from "@/hooks/usePendingScans";
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  User,
  FileText,
  CreditCard,
  Shield,
  Edit2,
  Check,
  Loader2,
  Sparkles,
  FolderPlus,
  CalendarCheck,
  FileCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ScanValidationDialogProps {
  scan: PendingScan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onValidated: () => void;
}

const FIELD_LABELS: Record<string, string> = {
  nom: 'Nom',
  prenom: 'Prénom',
  date_naissance: 'Date de naissance',
  email: 'Email',
  telephone: 'Téléphone',
  adresse: 'Adresse',
  npa: 'NPA',
  localite: 'Localité',
  canton: 'Canton',
  nationalite: 'Nationalité',
  compagnie: 'Compagnie',
  numero_police: 'N° Police',
  type_produit: 'Type de produit',
  categorie: 'Catégorie',
  date_debut: 'Date début',
  date_fin: 'Date fin',
  duree_contrat: 'Durée contrat',
  prime_mensuelle: 'Prime mensuelle',
  prime_annuelle: 'Prime annuelle',
  franchise: 'Franchise',
  garanties_principales: 'Garanties',
  statut_contrat: 'Statut contrat',
};

const CATEGORY_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  client: { label: 'Informations client', icon: User, color: 'text-blue-500' },
  contract: { label: 'Contrat', icon: FileText, color: 'text-violet-500' },
  premium: { label: 'Primes & Franchise', icon: CreditCard, color: 'text-emerald-500' },
  guarantees: { label: 'Garanties', icon: Shield, color: 'text-amber-500' },
};

export default function ScanValidationDialog({
  scan,
  open,
  onOpenChange,
  onValidated,
}: ScanValidationDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tenantId } = useUserTenant();

  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [editingField, setEditingField] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Creation options
  const [createContract, setCreateContract] = useState(true);
  const [createSuivi, setCreateSuivi] = useState(true);
  const [linkDocument, setLinkDocument] = useState(true);

  // Initialize edited values when scan changes
  useEffect(() => {
    if (scan) {
      const initial: Record<string, string> = {};
      scan.fields.forEach(field => {
        initial[field.field_name] = field.extracted_value || '';
      });
      setEditedValues(initial);
    }
  }, [scan]);

  if (!scan) return null;

  const getValue = (fieldName: string) => {
    if (editedValues[fieldName] !== undefined) {
      return editedValues[fieldName];
    }
    const field = scan.fields.find(f => f.field_name === fieldName);
    return field?.extracted_value || '';
  };

  const handleFieldChange = (fieldName: string, value: string) => {
    setEditedValues(prev => ({ ...prev, [fieldName]: value }));
  };

  const getConfidenceIcon = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high':
        return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
      case 'medium':
        return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
      case 'low':
        return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
    }
  };

  const getConfidenceBadge = (confidence: 'high' | 'medium' | 'low') => {
    const variants = {
      high: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      low: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };
    const labels = {
      high: 'Haute',
      medium: 'Moyenne',
      low: 'À vérifier',
    };
    return (
      <Badge variant="secondary" className={cn("text-xs", variants[confidence])}>
        {labels[confidence]}
      </Badge>
    );
  };

  // Group fields by category
  const fieldsByCategory = scan.fields.reduce((acc, field) => {
    if (!acc[field.field_category]) {
      acc[field.field_category] = [];
    }
    acc[field.field_category].push(field);
    return acc;
  }, {} as Record<string, ScanField[]>);

  // Check if we have contract data
  const hasContractData = scan.fields.some(f => 
    f.field_category === 'contract' || f.field_category === 'premium'
  );

  const handleValidate = async () => {
    if (!user || !tenantId) return;

    setIsSubmitting(true);
    try {
      // 1. Create the client
      const clientData = {
        tenant_id: tenantId,
        last_name: getValue('nom') || null,
        first_name: getValue('prenom') || null,
        birthdate: getValue('date_naissance') || null,
        email: getValue('email') || null,
        phone: getValue('telephone') || null,
        address: getValue('adresse') || null,
        postal_code: getValue('npa') || null,
        city: getValue('localite') || null,
        canton: getValue('canton') || null,
        nationality: getValue('nationalite') || null,
        status: 'prospect',
      };

      const { data: newClient, error: clientError } = await supabase
        .from('clients')
        .insert(clientData)
        .select()
        .single();

      if (clientError) throw clientError;

      let createdPolicyId: string | null = null;

      // 2. Create contract/policy if requested and data available
      if (createContract && hasContractData) {
        const companyName = getValue('compagnie');
        const productType = getValue('type_produit') || getValue('categorie');
        const policyNumber = getValue('numero_police');
        const startDate = getValue('date_debut');
        const endDate = getValue('date_fin');
        const premiumMonthly = getValue('prime_mensuelle');
        const premiumYearly = getValue('prime_annuelle');
        const deductible = getValue('franchise');
        const status = getValue('statut_contrat') || 'active';

        // Find or create a default product
        let productId: string | null = null;
        
        // Try to find matching product by company and type
        if (companyName) {
          const { data: companies } = await supabase
            .from('insurance_companies')
            .select('id')
            .ilike('name', `%${companyName}%`)
            .limit(1);

          if (companies && companies.length > 0) {
            const { data: products } = await supabase
              .from('insurance_products')
              .select('id')
              .eq('company_id', companies[0].id)
              .limit(1);

            if (products && products.length > 0) {
              productId = products[0].id;
            }
          }
        }

        // If no product found, get any product as fallback
        if (!productId) {
          const { data: anyProduct } = await supabase
            .from('insurance_products')
            .select('id')
            .limit(1)
            .single();
          
          if (anyProduct) {
            productId = anyProduct.id;
          }
        }

        if (productId) {
          const policyData = {
            tenant_id: tenantId,
            client_id: newClient.id,
            product_id: productId,
            policy_number: policyNumber || null,
            status: status,
            start_date: startDate || new Date().toISOString().split('T')[0],
            end_date: endDate || null,
            premium_monthly: premiumMonthly ? parseFloat(premiumMonthly.replace(/[^0-9.,]/g, '').replace(',', '.')) : null,
            premium_yearly: premiumYearly ? parseFloat(premiumYearly.replace(/[^0-9.,]/g, '').replace(',', '.')) : null,
            deductible: deductible ? parseFloat(deductible.replace(/[^0-9.,]/g, '').replace(',', '.')) : null,
            currency: 'CHF',
            company_name: companyName || null,
            product_type: productType || null,
            notes: `Contrat importé via IA Scan le ${new Date().toLocaleDateString('fr-CH')}`,
          };

          const { data: newPolicy, error: policyError } = await supabase
            .from('policies')
            .insert(policyData)
            .select()
            .single();

          if (policyError) {
            console.error('Policy creation error:', policyError);
          } else {
            createdPolicyId = newPolicy.id;
          }
        }
      }

      // 3. Link scanned document to client
      if (linkDocument && scan.original_file_key) {
        const documentData = {
          tenant_id: tenantId,
          owner_type: 'client',
          owner_id: newClient.id,
          file_name: scan.original_file_name,
          file_key: scan.original_file_key,
          mime_type: 'application/pdf',
          doc_kind: scan.detected_doc_type || 'police',
          created_by: user.id,
          category: 'Contrats',
          metadata: {
            source: 'ia_scan',
            scan_id: scan.id,
            detected_type: scan.detected_doc_type,
            confidence: scan.overall_confidence,
          },
        };

        const { error: docError } = await supabase
          .from('documents')
          .insert(documentData);

        if (docError) {
          console.error('Document linking error:', docError);
        }
      }

      // 4. Create follow-up (suivi)
      if (createSuivi) {
        const suiviData = {
          tenant_id: tenantId,
          client_id: newClient.id,
          title: `Nouveau client - ${getValue('prenom')} ${getValue('nom')}`,
          description: `Client créé via IA Scan.\n${hasContractData ? 'Contrat importé: ' + (getValue('compagnie') || 'N/A') + ' - ' + (getValue('type_produit') || 'N/A') : 'Aucun contrat détecté.'}\n\nVérifier les informations et contacter le client.`,
          type: 'activation',
          status: 'ouvert',
          reminder_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // +2 days
        };

        const { error: suiviError } = await supabase
          .from('suivis')
          .insert(suiviData);

        if (suiviError) {
          console.error('Suivi creation error:', suiviError);
        }
      }

      // 5. Mark scan as validated
      const { error: scanError } = await supabase
        .from('document_scans')
        .update({
          validated_at: new Date().toISOString(),
          validated_by: user.id,
          status: 'validated',
        })
        .eq('id', scan.id);

      if (scanError) throw scanError;

      // 6. Update scan results with validated values
      for (const [fieldName, value] of Object.entries(editedValues)) {
        if (value !== undefined) {
          await supabase
            .from('document_scan_results')
            .update({ validated_value: value })
            .eq('scan_id', scan.id)
            .eq('field_name', fieldName);
        }
      }

      // 7. Create audit log
      await supabase.rpc('create_scan_audit_log', {
        p_scan_id: scan.id,
        p_action: 'validated',
        p_ai_snapshot: {
          validated_values: editedValues,
          client_id: newClient.id,
          policy_id: createdPolicyId,
          options: {
            createContract,
            createSuivi,
            linkDocument,
          },
        },
      });

      // Build success message
      const createdItems = ['Client'];
      if (createContract && createdPolicyId) createdItems.push('Contrat');
      if (linkDocument) createdItems.push('Document');
      if (createSuivi) createdItems.push('Suivi');

      toast({
        title: "Validation réussie ! 🎉",
        description: `${createdItems.join(', ')} créé(s) pour ${getValue('prenom')} ${getValue('nom')}`,
      });

      onValidated();
      onOpenChange(false);

      // Navigate to client detail
      navigate(`/crm/clients/${newClient.id}`);

    } catch (error: any) {
      console.error('Validation error:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer le client",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const overallPercent = Math.round((scan.overall_confidence || 0) * 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            Validation du pré-remplissage IA
          </DialogTitle>
          <DialogDescription>
            Vérifiez les données extraites et choisissez ce que vous souhaitez créer
          </DialogDescription>
        </DialogHeader>

        {/* Confidence meter */}
        <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
          <div className="flex-1">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-muted-foreground">Confiance globale</span>
              <span className="font-medium">{overallPercent}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full transition-all"
                style={{
                  width: `${overallPercent}%`,
                  backgroundColor: overallPercent >= 70 ? '#10b981' : overallPercent >= 40 ? '#f59e0b' : '#ef4444',
                }}
              />
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {scan.fields.length} champs
          </div>
        </div>

        {/* Creation options */}
        <div className="p-4 bg-gradient-to-r from-primary/5 to-violet-500/5 rounded-lg border border-primary/10">
          <p className="text-sm font-medium mb-3 flex items-center gap-2">
            <FolderPlus className="h-4 w-4 text-primary" />
            Éléments à créer
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="flex items-center gap-2 p-2 rounded-md bg-background/50 cursor-pointer hover:bg-background transition-colors">
              <Checkbox checked disabled className="data-[state=checked]:bg-blue-500" />
              <User className="h-4 w-4 text-blue-500" />
              <span className="text-sm">Client</span>
              <Badge variant="outline" className="ml-auto text-xs">Requis</Badge>
            </label>
            
            <label className="flex items-center gap-2 p-2 rounded-md bg-background/50 cursor-pointer hover:bg-background transition-colors">
              <Checkbox 
                checked={createContract} 
                onCheckedChange={(checked) => setCreateContract(checked as boolean)}
                disabled={!hasContractData}
                className="data-[state=checked]:bg-violet-500"
              />
              <FileCheck className="h-4 w-4 text-violet-500" />
              <span className="text-sm">Contrat</span>
              {!hasContractData && (
                <Badge variant="secondary" className="ml-auto text-xs">Aucune donnée</Badge>
              )}
            </label>
            
            <label className="flex items-center gap-2 p-2 rounded-md bg-background/50 cursor-pointer hover:bg-background transition-colors">
              <Checkbox 
                checked={linkDocument} 
                onCheckedChange={(checked) => setLinkDocument(checked as boolean)}
                className="data-[state=checked]:bg-emerald-500"
              />
              <FileText className="h-4 w-4 text-emerald-500" />
              <span className="text-sm">Document</span>
            </label>
            
            <label className="flex items-center gap-2 p-2 rounded-md bg-background/50 cursor-pointer hover:bg-background transition-colors sm:col-span-3">
              <Checkbox 
                checked={createSuivi} 
                onCheckedChange={(checked) => setCreateSuivi(checked as boolean)}
                className="data-[state=checked]:bg-amber-500"
              />
              <CalendarCheck className="h-4 w-4 text-amber-500" />
              <span className="text-sm">Suivi de rappel (dans 2 jours)</span>
            </label>
          </div>
        </div>

        <ScrollArea className="max-h-[40vh] pr-4">
          <div className="space-y-6">
            {Object.entries(fieldsByCategory).map(([category, fields]) => {
              const categoryConfig = CATEGORY_CONFIG[category] || {
                label: category,
                icon: FileText,
                color: 'text-gray-500',
              };
              const CategoryIcon = categoryConfig.icon;

              return (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-3">
                    <CategoryIcon className={cn("h-4 w-4", categoryConfig.color)} />
                    <span className="font-medium text-sm">{categoryConfig.label}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {fields.map(field => (
                      <div
                        key={field.id}
                        className={cn(
                          "p-3 rounded-lg border transition-all",
                          field.confidence === 'low'
                            ? 'border-destructive/50 bg-destructive/5'
                            : field.confidence === 'medium'
                            ? 'border-amber-500/50 bg-amber-500/5'
                            : 'border-border bg-muted/30'
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-sm font-medium flex items-center gap-1.5">
                            {getConfidenceIcon(field.confidence)}
                            {FIELD_LABELS[field.field_name] || field.field_name}
                          </Label>
                          {getConfidenceBadge(field.confidence)}
                        </div>

                        {editingField === field.field_name ? (
                          <div className="flex gap-2">
                            <Input
                              value={getValue(field.field_name)}
                              onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
                              className="h-9"
                              autoFocus
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingField(null)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div
                            className="flex items-center justify-between group cursor-pointer p-2 rounded hover:bg-muted/50"
                            onClick={() => setEditingField(field.field_name)}
                          >
                            <span className={cn(
                              "text-sm",
                              !getValue(field.field_name) && 'text-muted-foreground italic'
                            )}>
                              {getValue(field.field_name) || 'Non détecté'}
                            </span>
                            <Edit2 className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        )}

                        {field.extraction_notes && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            💡 {field.extraction_notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  <Separator className="mt-4" />
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Disclaimer */}
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            ⚠️ Les données ont été proposées par une IA. Vérifiez avant validation.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
            disabled={isSubmitting}
          >
            Annuler
          </Button>
          <Button
            onClick={handleValidate}
            disabled={isSubmitting}
            className="flex-1 bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Valider & créer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
