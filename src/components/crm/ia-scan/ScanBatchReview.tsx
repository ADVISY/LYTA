import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useScanBatches, ScanBatch, DocClassification } from "@/hooks/useScanBatches";
import { 
  FileText, 
  CheckCircle2,
  AlertCircle,
  User,
  FileSearch,
  FileX,
  FilePlus,
  FileWarning,
  FileCheck,
  ArrowRight,
  Edit2,
  Trash2
} from "lucide-react";

interface ScanBatchReviewProps {
  batch: ScanBatch;
  onValidate?: () => void;
  primaryColor?: string;
}

const CLASSIFICATION_CONFIG: Record<DocClassification, { 
  label: string; 
  icon: React.ReactNode; 
  color: string;
  description: string;
}> = {
  identity_doc: { 
    label: 'Pièce d\'identité', 
    icon: <User className="h-4 w-4" />,
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    description: 'Passeport, carte ID, permis de séjour'
  },
  old_policy: { 
    label: 'Ancienne police', 
    icon: <FileX className="h-4 w-4" />,
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    description: 'Police à résilier/remplacer'
  },
  new_contract: { 
    label: 'Nouveau contrat', 
    icon: <FilePlus className="h-4 w-4" />,
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    description: 'Proposition ou contrat à activer'
  },
  termination: { 
    label: 'Résiliation', 
    icon: <FileWarning className="h-4 w-4" />,
    color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    description: 'Lettre de résiliation'
  },
  article_45: { 
    label: 'Art. 45 LCA', 
    icon: <FileCheck className="h-4 w-4" />,
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    description: 'Attestation libre passage'
  },
  other: { 
    label: 'Autre', 
    icon: <FileText className="h-4 w-4" />,
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    description: 'Autre document'
  },
  unknown: { 
    label: 'Non classifié', 
    icon: <FileSearch className="h-4 w-4" />,
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    description: 'À classifier manuellement'
  },
};

export default function ScanBatchReview({ batch, onValidate, primaryColor }: ScanBatchReviewProps) {
  const { toast } = useToast();
  const { updateDocumentClassification, deleteBatch } = useScanBatches();
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const documents = batch.documents || [];
  const sortedDocs = [...documents].sort((a, b) => a.sort_order - b.sort_order);

  const handleClassificationChange = async (docId: string, newClassification: DocClassification) => {
    await updateDocumentClassification(docId, newClassification);
    setEditingDocId(null);
  };

  const handleDelete = async () => {
    if (!confirm('Supprimer ce dossier et tous ses documents ?')) return;
    
    setIsDeleting(true);
    await deleteBatch(batch.id);
    setIsDeleting(false);
  };

  const getConfidenceBadge = (confidence: number | null) => {
    if (!confidence) return null;
    if (confidence >= 0.9) return <Badge variant="outline" className="text-xs text-emerald-600">Confiance haute</Badge>;
    if (confidence >= 0.7) return <Badge variant="outline" className="text-xs text-amber-600">Confiance moyenne</Badge>;
    return <Badge variant="outline" className="text-xs text-red-600">Confiance faible</Badge>;
  };

  const consolidation = batch.consolidation_summary;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              Dossier: {batch.total_documents} documents
              {batch.status === 'classified' && (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              )}
            </CardTitle>
            <CardDescription>
              {batch.documents_classified}/{batch.total_documents} classifiés
              {batch.verified_partner_email && ` • ${batch.verified_partner_email}`}
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Consolidation hints */}
        {consolidation && (
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <h4 className="font-medium text-sm">Analyse du dossier</h4>
            <div className="flex flex-wrap gap-2 text-xs">
              {consolidation.primary_holder_found && (
                <Badge variant="secondary">✓ Titulaire identifié</Badge>
              )}
              {consolidation.old_policy_count && consolidation.old_policy_count > 0 && (
                <Badge variant="secondary">{consolidation.old_policy_count} ancienne(s) police(s)</Badge>
              )}
              {consolidation.new_contract_count && consolidation.new_contract_count > 0 && (
                <Badge variant="secondary">{consolidation.new_contract_count} nouveau(x) contrat(s)</Badge>
              )}
              {consolidation.termination_found && (
                <Badge variant="destructive">Résiliation détectée</Badge>
              )}
            </div>
            {consolidation.recommended_action && (
              <p className="text-sm text-muted-foreground">
                → {consolidation.recommended_action}
              </p>
            )}
          </div>
        )}

        {/* Documents list */}
        <div className="space-y-2">
          {sortedDocs.map((doc) => {
            const classification = doc.document_classification || 'unknown';
            const config = CLASSIFICATION_CONFIG[classification];
            const isEditing = editingDocId === doc.id;

            return (
              <div
                key={doc.id}
                className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                {/* Icon */}
                <div className={`p-2 rounded-md ${config.color}`}>
                  {config.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{doc.file_name}</span>
                    {doc.classification_corrected && (
                      <Badge variant="outline" className="text-xs">Corrigé</Badge>
                    )}
                    {getConfidenceBadge(doc.classification_confidence)}
                  </div>

                  {/* Classification display/edit */}
                  {isEditing ? (
                    <Select
                      value={classification}
                      onValueChange={(val) => handleClassificationChange(doc.id, val as DocClassification)}
                    >
                      <SelectTrigger className="h-8 w-48 mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CLASSIFICATION_CONFIG).map(([key, cfg]) => (
                          <SelectItem key={key} value={key}>
                            <span className="flex items-center gap-2">
                              {cfg.icon}
                              {cfg.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={config.color}>{config.label}</Badge>
                      <button
                        type="button"
                        onClick={() => setEditingDocId(doc.id)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}

                  {/* Extracted summary */}
                  {doc.extracted_data?.description && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {doc.extracted_data.description}
                    </p>
                  )}
                </div>

                {/* Status indicator */}
                {doc.status === 'error' && (
                  <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                )}
                {doc.status === 'classified' && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>

        {/* Actions */}
        {batch.status === 'classified' && onValidate && (
          <div className="flex justify-end pt-2">
            <Button
              type="button"
              onClick={onValidate}
              style={primaryColor ? { backgroundColor: primaryColor } : undefined}
              className="gap-2"
            >
              Consolider et créer client
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
