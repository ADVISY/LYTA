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
import { PendingScan, ScanField, WorkflowAction } from "@/hooks/usePendingScans";
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
  Clock,
  XCircle,
  ArrowRightLeft,
  IdCard,
  FileWarning,
  AlertOctagon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ScanValidationDialogProps {
  scan: PendingScan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onValidated: () => void;
}

const FIELD_LABELS: Record<string, string> = {
  // Client fields
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
  etat_civil: 'État civil',
  numero_avs: 'N° AVS',
  profession: 'Profession',
  employeur: 'Employeur',
  // Old contract fields
  ancienne_compagnie: 'Ancienne compagnie',
  ancien_numero_police: 'Ancien N° police',
  ancien_type_produit: 'Ancien type produit',
  ancienne_date_debut: 'Ancienne date début',
  ancienne_date_fin: 'Ancienne date fin',
  ancienne_prime_mensuelle: 'Ancienne prime/mois',
  ancienne_prime_annuelle: 'Ancienne prime/an',
  ancienne_franchise: 'Ancienne franchise',
  // New contract fields
  nouvelle_compagnie: 'Nouvelle compagnie',
  nouveau_numero_police: 'Nouveau N° police',
  nouveau_type_produit: 'Nouveau type produit',
  nouvelle_date_debut: 'Nouvelle date début',
  nouvelle_date_fin: 'Nouvelle date fin',
  nouvelle_prime_mensuelle: 'Nouvelle prime/mois',
  nouvelle_prime_annuelle: 'Nouvelle prime/an',
  nouvelle_franchise: 'Nouvelle franchise',
  duree_engagement: 'Durée engagement',
  // Standard contract fields
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
  // Termination fields
  date_resiliation: 'Date résiliation',
  motif_resiliation: 'Motif résiliation',
  compagnie_resiliee: 'Compagnie résiliée',
};

const CATEGORY_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  client: { label: 'Informations client', icon: User, color: 'text-blue-500' },
  identity: { label: 'Pièce d\'identité', icon: IdCard, color: 'text-indigo-500' },
  contract: { label: 'Contrat', icon: FileText, color: 'text-violet-500' },
  old_contract: { label: 'Ancienne police', icon: FileWarning, color: 'text-orange-500' },
  new_contract: { label: 'Nouvelle police', icon: FileCheck, color: 'text-emerald-500' },
  premium: { label: 'Primes & Franchise', icon: CreditCard, color: 'text-cyan-500' },
  guarantees: { label: 'Garanties', icon: Shield, color: 'text-amber-500' },
  termination: { label: 'Résiliation', icon: XCircle, color: 'text-red-500' },
};

const DOC_TYPE_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  police_active: { label: 'Police active', icon: FileCheck, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  ancienne_police: { label: 'Ancienne police', icon: FileWarning, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  nouvelle_police: { label: 'Nouvelle police', icon: FileText, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  resiliation: { label: 'Résiliation', icon: XCircle, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  piece_identite: { label: 'Pièce d\'identité', icon: IdCard, color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
  attestation: { label: 'Attestation', icon: FileCheck, color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
  offre: { label: 'Offre', icon: FileText, color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  avenant: { label: 'Avenant', icon: ArrowRightLeft, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  autre: { label: 'Autre', icon: FileText, color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400' },
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
  const [createOldContract, setCreateOldContract] = useState(true);
  const [createNewContract, setCreateNewContract] = useState(true);
  const [createSuivis, setCreateSuivis] = useState(true);
  const [linkDocuments, setLinkDocuments] = useState(true);

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

  // Check what data we have
  const hasOldContractData = scan.has_old_policy || scan.fields.some(f => f.field_category === 'old_contract');
  const hasNewContractData = scan.has_new_policy || scan.fields.some(f => f.field_category === 'new_contract');
  const hasContractData = scan.fields.some(f => f.field_category === 'contract' || f.field_category === 'premium');
  const hasTermination = scan.has_termination || scan.fields.some(f => f.field_category === 'termination');

  const parseAmount = (value: string | null | undefined): number | null => {
    if (!value) return null;
    const cleaned = value.replace(/[^0-9.,]/g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  };

  // Parse European date format (DD.MM.YYYY or DD/MM/YYYY) to ISO format (YYYY-MM-DD)
  const parseDate = (value: string | null | undefined): string | null => {
    if (!value) return null;
    
    // If already in ISO format (YYYY-MM-DD), return as-is
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    
    // Parse European format: DD.MM.YYYY or DD/MM/YYYY
    const europeanMatch = value.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
    if (europeanMatch) {
      const [, day, month, year] = europeanMatch;
      const paddedDay = day.padStart(2, '0');
      const paddedMonth = month.padStart(2, '0');
      return `${year}-${paddedMonth}-${paddedDay}`;
    }
    
    // Try parsing as a date string
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
    
    return null;
  };

  const handleValidate = async () => {
    if (!user || !tenantId) return;

    setIsSubmitting(true);
    try {
      // 1. Create the client
      const clientData = {
        tenant_id: tenantId,
        last_name: getValue('nom') || null,
        first_name: getValue('prenom') || null,
        birthdate: parseDate(getValue('date_naissance')),
        email: getValue('email') || null,
        phone: getValue('telephone') || null,
        address: getValue('adresse') || null,
        postal_code: getValue('npa') || null,
        city: getValue('localite') || null,
        canton: getValue('canton') || null,
        nationality: getValue('nationalite') || null,
        civil_status: getValue('etat_civil') || null,
        profession: getValue('profession') || null,
        employer: getValue('employeur') || null,
        status: 'prospect',
      };

      const { data: newClient, error: clientError } = await supabase
        .from('clients')
        .insert(clientData)
        .select()
        .single();

      if (clientError) throw clientError;

      const createdPolicies: { id: string; type: 'old' | 'new' | 'standard' }[] = [];
      const createdSuivis: string[] = [];

      // Helper to find product ID
      const findProductId = async (companyName: string | null): Promise<string | null> => {
        if (!companyName) return null;
        
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
            return products[0].id;
          }
        }

        // Fallback to any product
        const { data: anyProduct } = await supabase
          .from('insurance_products')
          .select('id')
          .limit(1)
          .single();
        
        return anyProduct?.id || null;
      };

      // 2. Create OLD contract/policy if requested and data available
      if (createOldContract && hasOldContractData) {
        const companyName = getValue('ancienne_compagnie') || getValue('compagnie');
        const productId = await findProductId(companyName);

        if (productId) {
          const policyData = {
            tenant_id: tenantId,
            client_id: newClient.id,
            product_id: productId,
            policy_number: getValue('ancien_numero_police') || getValue('numero_police') || null,
            status: hasTermination ? 'resilie' : 'active',
            start_date: parseDate(getValue('ancienne_date_debut') || getValue('date_debut')) || new Date().toISOString().split('T')[0],
            end_date: parseDate(getValue('ancienne_date_fin') || getValue('date_fin')),
            premium_monthly: parseAmount(getValue('ancienne_prime_mensuelle') || getValue('prime_mensuelle')),
            premium_yearly: parseAmount(getValue('ancienne_prime_annuelle') || getValue('prime_annuelle')),
            deductible: parseAmount(getValue('ancienne_franchise') || getValue('franchise')),
            currency: 'CHF',
            company_name: companyName || null,
            product_type: getValue('ancien_type_produit') || getValue('type_produit') || null,
            notes: `Ancienne police importée via IA Scan le ${new Date().toLocaleDateString('fr-CH')}${hasTermination ? ' - À RÉSILIER' : ''}`,
          };

          const { data: oldPolicy, error: policyError } = await supabase
            .from('policies')
            .insert(policyData)
            .select()
            .single();

          if (!policyError && oldPolicy) {
            createdPolicies.push({ id: oldPolicy.id, type: 'old' });
          }
        }
      }

      // 3. Create NEW contract/policy if requested and data available
      if (createNewContract && hasNewContractData) {
        const companyName = getValue('nouvelle_compagnie');
        const productId = await findProductId(companyName);

        if (productId) {
          const policyData = {
            tenant_id: tenantId,
            client_id: newClient.id,
            product_id: productId,
            policy_number: getValue('nouveau_numero_police') || null,
            status: 'active',
            start_date: parseDate(getValue('nouvelle_date_debut')) || new Date().toISOString().split('T')[0],
            end_date: parseDate(getValue('nouvelle_date_fin')),
            premium_monthly: parseAmount(getValue('nouvelle_prime_mensuelle')),
            premium_yearly: parseAmount(getValue('nouvelle_prime_annuelle')),
            deductible: parseAmount(getValue('nouvelle_franchise')),
            currency: 'CHF',
            company_name: companyName || null,
            product_type: getValue('nouveau_type_produit') || null,
            notes: `Nouvelle police importée via IA Scan le ${new Date().toLocaleDateString('fr-CH')}`,
          };

          const { data: newPolicy, error: policyError } = await supabase
            .from('policies')
            .insert(policyData)
            .select()
            .single();

          if (!policyError && newPolicy) {
            createdPolicies.push({ id: newPolicy.id, type: 'new' });
          }
        }
      }

      // 4. Create standard contract if no old/new specific data but has contract data
      if (!hasOldContractData && !hasNewContractData && hasContractData && createNewContract) {
        const companyName = getValue('compagnie');
        const productId = await findProductId(companyName);

        if (productId) {
          const policyData = {
            tenant_id: tenantId,
            client_id: newClient.id,
            product_id: productId,
            policy_number: getValue('numero_police') || null,
            status: getValue('statut_contrat') || 'active',
            start_date: parseDate(getValue('date_debut')) || new Date().toISOString().split('T')[0],
            end_date: parseDate(getValue('date_fin')),
            premium_monthly: parseAmount(getValue('prime_mensuelle')),
            premium_yearly: parseAmount(getValue('prime_annuelle')),
            deductible: parseAmount(getValue('franchise')),
            currency: 'CHF',
            company_name: companyName || null,
            product_type: getValue('type_produit') || null,
            notes: `Contrat importé via IA Scan le ${new Date().toLocaleDateString('fr-CH')}`,
          };

          const { data: newPolicy, error: policyError } = await supabase
            .from('policies')
            .insert(policyData)
            .select()
            .single();

          if (!policyError && newPolicy) {
            createdPolicies.push({ id: newPolicy.id, type: 'standard' });
          }
        }
      }

      // 5. Link scanned documents to client
      if (linkDocuments && scan.original_file_key) {
        const documentData = {
          tenant_id: tenantId,
          owner_type: 'client',
          owner_id: newClient.id,
          file_name: scan.original_file_name,
          file_key: scan.original_file_key,
          mime_type: 'application/pdf',
          doc_kind: scan.detected_doc_type || 'police',
          created_by: user.id,
          category: 'Dossier IA Scan',
          metadata: {
            source: 'ia_scan',
            scan_id: scan.id,
            detected_type: scan.detected_doc_type,
            confidence: scan.overall_confidence,
          },
        };

        await supabase.from('documents').insert([documentData]);
      }

      // 6. Create workflow-based follow-ups (suivis)
      if (createSuivis) {
        // Process workflow actions from AI analysis
        if (scan.workflow_actions && scan.workflow_actions.length > 0) {
          for (const action of scan.workflow_actions) {
            let suiviType = 'autre';
            let title = action.description;
            
            switch (action.action_type) {
              case 'create_termination_suivi':
                suiviType = 'resiliation';
                title = `🚨 Résiliation à envoyer: ${action.details?.company || 'Ancienne police'}`;
                break;
              case 'create_activation_suivi':
                suiviType = 'activation';
                title = `✅ Activer nouvelle police: ${action.details?.company || 'Nouvelle police'}`;
                break;
              case 'create_replacement_suivi':
                suiviType = 'changement';
                title = `🔄 Remplacement de police: ${action.details?.old_company} → ${action.details?.new_company}`;
                break;
              case 'request_documents':
                suiviType = 'documents';
                title = `📁 Documents manquants à demander`;
                break;
            }

            const { data: suiviData } = await supabase.from('suivis').insert([{
              tenant_id: tenantId,
              client_id: newClient.id,
              title,
              description: action.description + (action.details ? `\n\nDétails: ${JSON.stringify(action.details, null, 2)}` : ''),
              type: suiviType,
              status: 'ouvert',
              reminder_date: action.deadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            }]).select('id').single();
            
            if (suiviData?.id) createdSuivis.push(suiviData.id);
          }
        }

        // If termination detected but no specific workflow action, create one
        if (hasTermination && (!scan.workflow_actions || !scan.workflow_actions.some(a => a.action_type === 'create_termination_suivi'))) {
          const terminationDeadline = scan.engagement_analysis?.termination_deadline;
          const { data: termSuivi } = await supabase.from('suivis').insert([{
            tenant_id: tenantId,
            client_id: newClient.id,
            title: `🚨 Résiliation détectée - ${getValue('compagnie_resiliee') || getValue('ancienne_compagnie') || 'Compagnie'}`,
            description: `Lettre de résiliation détectée dans le dossier.\n\nDate résiliation: ${getValue('date_resiliation') || 'Non spécifiée'}\nMotif: ${getValue('motif_resiliation') || 'Non spécifié'}`,
            type: 'resiliation',
            status: 'ouvert',
            reminder_date: terminationDeadline || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          }]).select('id').single();
          
          if (termSuivi?.id) createdSuivis.push(termSuivi.id);
        }

        // Create general follow-up for new client if no other suivis created
        if (createdSuivis.length === 0) {
          const { data: generalSuivi } = await supabase.from('suivis').insert([{
            tenant_id: tenantId,
            client_id: newClient.id,
            title: `📋 Nouveau client - ${getValue('prenom')} ${getValue('nom')}`,
            description: `Client créé via IA Scan.\n\n${scan.dossier_summary || 'Vérifier les informations du dossier.'}`,
            type: 'activation',
            status: 'ouvert',
            reminder_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          }]).select('id').single();
          
          if (generalSuivi?.id) createdSuivis.push(generalSuivi.id);
        }
      }

      // 7. Mark scan as validated
      const { error: scanError } = await supabase
        .from('document_scans')
        .update({
          validated_at: new Date().toISOString(),
          validated_by: user.id,
          status: 'validated',
        })
        .eq('id', scan.id);

      if (scanError) throw scanError;

      // 8. Update scan results with validated values
      for (const [fieldName, value] of Object.entries(editedValues)) {
        if (value !== undefined) {
          await supabase
            .from('document_scan_results')
            .update({ validated_value: value })
            .eq('scan_id', scan.id)
            .eq('field_name', fieldName);
        }
      }

      // 9. Create audit log
      await supabase.rpc('create_scan_audit_log', {
        p_scan_id: scan.id,
        p_action: 'validated',
        p_ai_snapshot: {
          validated_values: editedValues,
          client_id: newClient.id,
          policies: createdPolicies,
          suivis: createdSuivis,
          options: {
            createOldContract,
            createNewContract,
            createSuivis,
            linkDocuments,
          },
        },
      });

      // Build success message
      const createdItems = ['Client'];
      if (createdPolicies.length > 0) createdItems.push(`${createdPolicies.length} Contrat(s)`);
      if (linkDocuments) createdItems.push('Document');
      if (createdSuivis.length > 0) createdItems.push(`${createdSuivis.length} Suivi(s)`);

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
      <DialogContent className="max-w-3xl max-h-[95vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-4 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            Validation du dossier IA Scan
          </DialogTitle>
          <DialogDescription>
            {scan.dossier_summary || 'Vérifiez les données extraites et choisissez ce que vous souhaitez créer'}
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable content area */}
        <ScrollArea className="flex-1 px-6 overflow-y-auto" style={{ maxHeight: 'calc(95vh - 180px)' }}>
          <div className="space-y-4 pb-4">
            {/* Documents detected */}
            {scan.documents_detected && scan.documents_detected.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {scan.documents_detected.map((doc, i) => {
                  const docConfig = DOC_TYPE_LABELS[doc.doc_type] || DOC_TYPE_LABELS.autre;
                  const DocIcon = docConfig.icon;
                  return (
                    <Badge key={i} variant="outline" className={cn("text-xs", docConfig.color)}>
                      <DocIcon className="h-3 w-3 mr-1" />
                      {doc.description || docConfig.label}
                    </Badge>
                  );
                })}
              </div>
            )}

            {/* Alerts for termination or engagement issues */}
            {(hasTermination || (scan.engagement_analysis?.warnings && scan.engagement_analysis.warnings.length > 0)) && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertOctagon className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800 dark:text-red-200">
                      {hasTermination ? '⚠️ Résiliation détectée' : '⚠️ Attention aux dates'}
                    </p>
                    {scan.engagement_analysis?.warnings?.map((warning, i) => (
                      <p key={i} className="text-sm text-red-700 dark:text-red-300 mt-1">
                        • {warning}
                      </p>
                    ))}
                    {scan.engagement_analysis?.termination_deadline && (
                      <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                        📅 Deadline résiliation: <strong>{scan.engagement_analysis.termination_deadline}</strong>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Inconsistencies */}
            {scan.inconsistencies && scan.inconsistencies.length > 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
                  ⚠️ Incohérences détectées
                </p>
                {scan.inconsistencies.map((inc, i) => (
                  <p key={i} className="text-sm text-amber-700 dark:text-amber-300">• {inc}</p>
                ))}
              </div>
            )}

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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center gap-2 p-2 rounded-md bg-background/50 cursor-pointer hover:bg-background transition-colors">
                  <Checkbox checked disabled className="data-[state=checked]:bg-blue-500" />
                  <User className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">Client</span>
                  <Badge variant="outline" className="ml-auto text-xs">Requis</Badge>
                </label>
                
                {hasOldContractData && (
                  <label className="flex items-center gap-2 p-2 rounded-md bg-background/50 cursor-pointer hover:bg-background transition-colors">
                    <Checkbox 
                      checked={createOldContract} 
                      onCheckedChange={(checked) => setCreateOldContract(checked as boolean)}
                      className="data-[state=checked]:bg-orange-500"
                    />
                    <FileWarning className="h-4 w-4 text-orange-500" />
                    <span className="text-sm">Ancienne police</span>
                  </label>
                )}
                
                {(hasNewContractData || hasContractData) && (
                  <label className="flex items-center gap-2 p-2 rounded-md bg-background/50 cursor-pointer hover:bg-background transition-colors">
                    <Checkbox 
                      checked={createNewContract} 
                      onCheckedChange={(checked) => setCreateNewContract(checked as boolean)}
                      className="data-[state=checked]:bg-emerald-500"
                    />
                    <FileCheck className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm">{hasNewContractData ? 'Nouvelle police' : 'Contrat'}</span>
                  </label>
                )}
                
                <label className="flex items-center gap-2 p-2 rounded-md bg-background/50 cursor-pointer hover:bg-background transition-colors">
                  <Checkbox 
                    checked={linkDocuments} 
                    onCheckedChange={(checked) => setLinkDocuments(checked as boolean)}
                    className="data-[state=checked]:bg-indigo-500"
                  />
                  <FileText className="h-4 w-4 text-indigo-500" />
                  <span className="text-sm">Lier documents</span>
                </label>
                
                <label className="flex items-center gap-2 p-2 rounded-md bg-background/50 cursor-pointer hover:bg-background transition-colors">
                  <Checkbox 
                    checked={createSuivis} 
                    onCheckedChange={(checked) => setCreateSuivis(checked as boolean)}
                    className="data-[state=checked]:bg-amber-500"
                  />
                  <CalendarCheck className="h-4 w-4 text-amber-500" />
                  <span className="text-sm">
                    Créer suivis
                    {scan.workflow_actions && scan.workflow_actions.length > 0 && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({scan.workflow_actions.length} action{scan.workflow_actions.length > 1 ? 's' : ''})
                      </span>
                    )}
                  </span>
                </label>
              </div>
            </div>

            {/* Workflow actions preview */}
            {scan.workflow_actions && scan.workflow_actions.length > 0 && createSuivis && (
              <div className="p-3 bg-muted/30 rounded-lg border">
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Actions back-office à créer
                </p>
                <div className="space-y-2">
                  {scan.workflow_actions.map((action, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <Badge variant={action.priority === 'high' ? 'destructive' : 'secondary'} className="text-xs">
                        {action.priority === 'high' ? 'Urgent' : 'Normal'}
                      </Badge>
                      <span className="flex-1">{action.description}</span>
                      {action.deadline && (
                        <span className="text-xs text-muted-foreground">
                          📅 {action.deadline}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fields by category */}
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

            {/* Missing documents */}
            {scan.missing_documents && scan.missing_documents.length > 0 && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                  📁 Documents à demander
                </p>
                {scan.missing_documents.map((doc, i) => (
                  <p key={i} className="text-sm text-blue-700 dark:text-blue-300">• {doc}</p>
                ))}
              </div>
            )}

            {/* Disclaimer */}
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                ⚠️ Les données ont été proposées par une IA. Vérifiez avant validation.
              </p>
            </div>
          </div>
        </ScrollArea>

        {/* Fixed action buttons at the bottom */}
        <div className="flex gap-3 p-6 pt-4 border-t bg-background flex-shrink-0">
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
