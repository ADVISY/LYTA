import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  FileText,
  User,
  Building2,
  CreditCard,
  Shield,
  ChevronDown,
  ChevronUp,
  Loader2,
  Eye,
  UserPlus,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { PendingScan, ScanField } from "@/hooks/usePendingScans";
import { cn } from "@/lib/utils";

interface PendingScanCardProps {
  scan: PendingScan;
  onValidate: (scan: PendingScan) => void;
  onReject: (scanId: string) => void;
  isRejecting?: boolean;
}

// Field labels
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

const CATEGORY_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  client: { label: 'Client', icon: User, color: 'text-blue-500' },
  contract: { label: 'Contrat', icon: FileText, color: 'text-violet-500' },
  premium: { label: 'Primes', icon: CreditCard, color: 'text-emerald-500' },
  guarantees: { label: 'Garanties', icon: Shield, color: 'text-amber-500' },
};

const FORM_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  sana: { label: 'SANA', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  vita: { label: 'VITA', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  medio: { label: 'MEDIO', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  business: { label: 'BUSINESS', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
};

const DOC_TYPE_LABELS: Record<string, string> = {
  police: 'Police d\'assurance',
  offre: 'Offre',
  avenant: 'Avenant',
  resiliation: 'Résiliation',
  attestation: 'Attestation',
  autre: 'Autre document',
};

export default function PendingScanCard({ scan, onValidate, onReject, isRejecting }: PendingScanCardProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const formType = scan.source_form_type?.toLowerCase() || 'autre';
  const formConfig = FORM_TYPE_LABELS[formType] || { label: formType.toUpperCase(), color: 'bg-gray-100 text-gray-700' };

  // Group fields by category
  const fieldsByCategory = scan.fields.reduce((acc, field) => {
    if (!acc[field.field_category]) {
      acc[field.field_category] = [];
    }
    acc[field.field_category].push(field);
    return acc;
  }, {} as Record<string, ScanField[]>);

  // Calculate confidence stats
  const highConfidence = scan.fields.filter(f => f.confidence === 'high').length;
  const mediumConfidence = scan.fields.filter(f => f.confidence === 'medium').length;
  const lowConfidence = scan.fields.filter(f => f.confidence === 'low').length;

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

  const overallPercent = Math.round((scan.overall_confidence || 0) * 100);

  return (
    <Card className={cn(
      "border-l-4 transition-all hover:shadow-lg",
      scan.status === 'processing' && "border-l-amber-500 bg-amber-50/50 dark:bg-amber-900/10",
      scan.status === 'completed' && "border-l-emerald-500",
      scan.status === 'failed' && "border-l-destructive",
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Form type badge */}
            <Badge className={cn("shrink-0", formConfig.color)}>
              {formConfig.label}
            </Badge>

            <div className="min-w-0 flex-1">
              {/* Partner email */}
              <p className="font-medium text-sm truncate">
                {scan.verified_partner_email || 'Partenaire inconnu'}
              </p>
              
              {/* Timestamp and file info */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                <Clock className="h-3 w-3" />
                {format(new Date(scan.created_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
                <span className="text-muted-foreground/50">•</span>
                <span className="truncate">{scan.original_file_name}</span>
              </div>
            </div>
          </div>

          {/* Status / confidence indicator */}
          <div className="flex items-center gap-2">
            {scan.status === 'processing' ? (
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs font-medium">Analyse...</span>
              </div>
            ) : scan.status === 'failed' ? (
              <Badge variant="destructive" className="text-xs">
                Échec
              </Badge>
            ) : (
              <div className="text-right">
                <div className={cn(
                  "text-lg font-bold",
                  overallPercent >= 70 ? "text-emerald-600" : overallPercent >= 40 ? "text-amber-600" : "text-destructive"
                )}>
                  {overallPercent}%
                </div>
                <div className="text-xs text-muted-foreground">confiance</div>
              </div>
            )}
          </div>
        </div>

        {/* Document type and fields summary */}
        {scan.status === 'completed' && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {scan.detected_doc_type && (
              <Badge variant="secondary" className="text-xs">
                {DOC_TYPE_LABELS[scan.detected_doc_type] || scan.detected_doc_type}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {scan.fields.length} champs extraits
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <span className="flex items-center gap-1 text-xs">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                {highConfidence}
              </span>
              <span className="flex items-center gap-1 text-xs">
                <AlertTriangle className="h-3 w-3 text-amber-500" />
                {mediumConfidence}
              </span>
              <span className="flex items-center gap-1 text-xs">
                <AlertCircle className="h-3 w-3 text-destructive" />
                {lowConfidence}
              </span>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {/* Expandable fields preview */}
        {scan.status === 'completed' && scan.fields.length > 0 && (
          <>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="w-full justify-between text-muted-foreground hover:text-foreground"
            >
              <span className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                {expanded ? 'Masquer les détails' : 'Voir les champs extraits'}
              </span>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>

            {expanded && (
              <div className="mt-4 space-y-4">
                {Object.entries(fieldsByCategory).map(([category, fields]) => {
                  const categoryConfig = CATEGORY_LABELS[category] || { 
                    label: category, 
                    icon: FileText, 
                    color: 'text-gray-500' 
                  };
                  const CategoryIcon = categoryConfig.icon;

                  return (
                    <div key={category}>
                      <div className="flex items-center gap-2 mb-2">
                        <CategoryIcon className={cn("h-4 w-4", categoryConfig.color)} />
                        <span className="text-sm font-medium">{categoryConfig.label}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {fields.map(field => (
                          <div
                            key={field.id}
                            className={cn(
                              "p-2 rounded-md text-sm",
                              field.confidence === 'low' ? 'bg-red-50 dark:bg-red-900/20' :
                              field.confidence === 'medium' ? 'bg-amber-50 dark:bg-amber-900/20' :
                              'bg-muted/50'
                            )}
                          >
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                              {getConfidenceIcon(field.confidence)}
                              {FIELD_LABELS[field.field_name] || field.field_name}
                            </div>
                            <div className="font-medium truncate">
                              {field.extracted_value || <span className="text-muted-foreground italic">Non détecté</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                      <Separator className="mt-3" />
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Error message */}
        {scan.status === 'failed' && scan.error_message && (
          <p className="text-sm text-destructive mt-2">
            {scan.error_message}
          </p>
        )}

        {/* Action buttons */}
        {scan.status === 'completed' && (
          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => onReject(scan.id)}
              disabled={isRejecting}
              className="text-destructive hover:text-destructive"
            >
              {isRejecting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <X className="h-4 w-4 mr-1" />
              )}
              Rejeter
            </Button>
            <Button
              size="sm"
              type="button"
              onClick={() => onValidate(scan)}
              className="flex-1 bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90"
            >
              <UserPlus className="h-4 w-4 mr-1" />
              Valider & créer client
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
