import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle,
  Sparkles,
  Edit2,
  Check,
  X
} from "lucide-react";
import type { ScanResults, ExtractedField } from "./IAScanUpload";

interface IAScanValidationProps {
  results: ScanResults;
  onValidate: (validatedFields: Record<string, string>) => void;
  onCancel: () => void;
  primaryColor?: string;
}

// Map field names to French labels
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

// Map category to French labels
const CATEGORY_LABELS: Record<string, string> = {
  client: 'Informations client',
  contract: 'Informations contrat',
  premium: 'Primes et franchise',
  guarantees: 'Garanties',
};

// Document type labels
const DOC_TYPE_LABELS: Record<string, string> = {
  police: 'Police d\'assurance',
  offre: 'Offre',
  avenant: 'Avenant',
  resiliation: 'Résiliation',
  attestation: 'Attestation',
  autre: 'Autre document',
};

export default function IAScanValidation({ 
  results, 
  onValidate, 
  onCancel,
  primaryColor 
}: IAScanValidationProps) {
  // Initialize edited values from extracted values
  const [editedValues, setEditedValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    results.fields.forEach(field => {
      initial[field.name] = field.value || '';
    });
    return initial;
  });

  const [editingField, setEditingField] = useState<string | null>(null);

  // Group fields by category
  const fieldsByCategory = results.fields.reduce((acc, field) => {
    if (!acc[field.category]) {
      acc[field.category] = [];
    }
    acc[field.category].push(field);
    return acc;
  }, {} as Record<string, ExtractedField[]>);

  const getConfidenceIcon = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high':
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case 'medium':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'low':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const getConfidenceBadge = (confidence: 'high' | 'medium' | 'low') => {
    const variants = {
      high: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      low: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };
    const labels = {
      high: 'Haute confiance',
      medium: 'Moyenne confiance',
      low: 'À vérifier',
    };
    return (
      <Badge variant="secondary" className={`text-xs ${variants[confidence]}`}>
        {labels[confidence]}
      </Badge>
    );
  };

  const handleFieldChange = (fieldName: string, value: string) => {
    setEditedValues(prev => ({ ...prev, [fieldName]: value }));
  };

  const handleValidate = () => {
    onValidate(editedValues);
  };

  const overallConfidencePercent = Math.round(results.overallConfidence * 100);

  return (
    <Card className="border-2" style={{ borderColor: primaryColor || 'hsl(var(--primary))' }}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: primaryColor ? `${primaryColor}15` : 'hsl(var(--primary)/0.1)' }}>
              <Sparkles className="h-5 w-5" style={{ color: primaryColor || 'hsl(var(--primary))' }} />
            </div>
            <div>
              <CardTitle className="text-lg">Pré-remplissage IA</CardTitle>
              <CardDescription>
                Vérifiez et corrigez les données extraites avant validation
              </CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="text-xs">
            {DOC_TYPE_LABELS[results.documentType] || results.documentType}
          </Badge>
        </div>

        {/* Confidence meter */}
        <div className="flex items-center gap-4 mt-4 p-3 bg-muted/50 rounded-lg">
          <div className="flex-1">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-muted-foreground">Confiance globale</span>
              <span className="font-medium">{overallConfidencePercent}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full transition-all"
                style={{ 
                  width: `${overallConfidencePercent}%`,
                  backgroundColor: overallConfidencePercent >= 70 ? '#10b981' : overallConfidencePercent >= 40 ? '#f59e0b' : '#ef4444'
                }}
              />
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {results.fields.length} champs extraits
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {Object.entries(fieldsByCategory).map(([category, fields]) => (
          <div key={category}>
            <h4 className="font-medium text-sm text-muted-foreground mb-3">
              {CATEGORY_LABELS[category] || category}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {fields.map(field => (
                <div 
                  key={field.id}
                  className={`p-3 rounded-lg border transition-all ${
                    field.confidence === 'low' 
                      ? 'border-destructive/50 bg-destructive/5' 
                      : field.confidence === 'medium'
                      ? 'border-amber-500/50 bg-amber-500/5'
                      : 'border-border bg-muted/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      {getConfidenceIcon(field.confidence)}
                      {FIELD_LABELS[field.name] || field.name}
                    </Label>
                    {getConfidenceBadge(field.confidence)}
                  </div>
                  
                  {editingField === field.name ? (
                    <div className="flex gap-2">
                      <Input
                        value={editedValues[field.name] || ''}
                        onChange={(e) => handleFieldChange(field.name, e.target.value)}
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
                      onClick={() => setEditingField(field.name)}
                    >
                      <span className={`text-sm ${!editedValues[field.name] ? 'text-muted-foreground italic' : ''}`}>
                        {editedValues[field.name] || 'Non détecté'}
                      </span>
                      <Edit2 className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  )}

                  {field.notes && (
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      💡 {field.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <Separator className="mt-4" />
          </div>
        ))}

        {/* Disclaimer */}
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            ⚠️ Les données ont été proposées par une IA. Vérifiez avant validation.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            onClick={onCancel}
            className="flex-1"
          >
            <X className="h-4 w-4 mr-2" />
            Annuler
          </Button>
          <Button
            onClick={handleValidate}
            className="flex-1"
            style={primaryColor ? { backgroundColor: primaryColor } : undefined}
          >
            <Check className="h-4 w-4 mr-2" />
            Valider & Pré-remplir
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
