import { useState } from "react";
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

  // Initialize edited values when scan changes
  useState(() => {
    if (scan) {
      const initial: Record<string, string> = {};
      scan.fields.forEach(field => {
        initial[field.field_name] = field.extracted_value || '';
      });
      setEditedValues(initial);
    }
  });

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

      // 2. Mark scan as validated
      const { error: scanError } = await supabase
        .from('document_scans')
        .update({
          validated_at: new Date().toISOString(),
          validated_by: user.id,
          status: 'validated',
        })
        .eq('id', scan.id);

      if (scanError) throw scanError;

      // 3. Update scan results with validated values
      for (const [fieldName, value] of Object.entries(editedValues)) {
        if (value !== undefined) {
          await supabase
            .from('document_scan_results')
            .update({ validated_value: value })
            .eq('scan_id', scan.id)
            .eq('field_name', fieldName);
        }
      }

      // 4. Create audit log
      await supabase.rpc('create_scan_audit_log', {
        p_scan_id: scan.id,
        p_action: 'validated',
        p_ai_snapshot: {
          validated_values: editedValues,
          client_id: newClient.id,
        },
      });

      toast({
        title: "Client créé avec succès",
        description: `${getValue('prenom')} ${getValue('nom')} a été ajouté au CRM`,
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
            Vérifiez et corrigez les données extraites avant de créer le client
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

        <ScrollArea className="max-h-[50vh] pr-4">
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
            Valider & créer client
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
