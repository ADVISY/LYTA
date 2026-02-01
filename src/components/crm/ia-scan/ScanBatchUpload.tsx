import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useScanBatches } from "@/hooks/useScanBatches";
import { 
  Upload, 
  Loader2, 
  FolderOpen, 
  FileText, 
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  ArrowRight
} from "lucide-react";

interface ScanBatchUploadProps {
  verifiedPartnerEmail?: string;
  verifiedPartnerId?: string;
  onBatchCreated?: (batchId: string) => void;
  primaryColor?: string;
}

interface PendingFile {
  file: File;
  name: string;
}

type UploadStatus = 'idle' | 'uploading' | 'classifying' | 'done' | 'error';

export default function ScanBatchUpload({
  verifiedPartnerEmail,
  verifiedPartnerId,
  onBatchCreated,
  primaryColor,
}: ScanBatchUploadProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { createBatch, classifyBatch } = useScanBatches();
  
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 20 * 1024 * 1024; // 20MB

    const validFiles: PendingFile[] = [];
    for (const file of files) {
      if (file.size > maxSize) {
        toast({
          title: "Fichier trop volumineux",
          description: `${file.name} dépasse la limite de 20MB`,
          variant: "destructive",
        });
        continue;
      }
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Type non supporté",
          description: `${file.name}: formats acceptés PDF, JPG, PNG, WEBP`,
          variant: "destructive",
        });
        continue;
      }
      validFiles.push({ file, name: file.name });
    }

    if (validFiles.length > 0) {
      setPendingFiles(prev => [...prev, ...validFiles]);
      setStatus('idle');
      setErrorMessage(null);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const startProcess = async () => {
    if (pendingFiles.length === 0) return;

    const normalizedEmail = (verifiedPartnerEmail ?? '').trim().toLowerCase();
    if (!normalizedEmail) {
      setStatus('error');
      setErrorMessage("Veuillez vérifier votre email collaborateur avant d'utiliser le scan.");
      toast({
        title: "Accès refusé",
        description: "Email collaborateur non vérifié",
        variant: "destructive",
      });
      return;
    }

    try {
      // Step 1: Upload files and create batch
      setStatus('uploading');
      setProgress(10);
      setCurrentStep('Création du dossier...');

      const files = pendingFiles.map(pf => pf.file);
      const batchId = await createBatch(files, normalizedEmail, verifiedPartnerId);

      if (!batchId) {
        throw new Error("Échec de création du dossier");
      }

      setProgress(40);
      
      // Step 2: Classify documents
      setStatus('classifying');
      setCurrentStep('Classification IA des documents...');
      setProgress(50);

      const classifySuccess = await classifyBatch(batchId);

      if (!classifySuccess) {
        throw new Error("Échec de classification");
      }

      setProgress(100);
      setStatus('done');
      setCurrentStep('');

      if (onBatchCreated) {
        onBatchCreated(batchId);
      }

    } catch (err: any) {
      console.error('Batch process error:', err);
      setStatus('error');
      setErrorMessage(err.message || 'Une erreur est survenue');
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const reset = () => {
    setPendingFiles([]);
    setStatus('idle');
    setProgress(0);
    setCurrentStep('');
    setErrorMessage(null);
  };

  const isProcessing = status === 'uploading' || status === 'classifying';

  const getStatusIcon = () => {
    switch (status) {
      case 'uploading':
      case 'classifying':
        return <Loader2 className="h-8 w-8 animate-spin" style={{ color: primaryColor || 'hsl(var(--primary))' }} />;
      case 'done':
        return <CheckCircle2 className="h-8 w-8 text-emerald-500" />;
      case 'error':
        return <AlertCircle className="h-8 w-8 text-destructive" />;
      default:
        return <FolderOpen className="h-8 w-8" style={{ color: primaryColor || 'hsl(var(--primary))' }} />;
    }
  };

  return (
    <Card className="border-2 border-dashed transition-all hover:border-primary/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <FolderOpen className="h-5 w-5" style={{ color: primaryColor }} />
          Dossier Multi-Documents
          <Badge variant="secondary" className="text-xs">NOUVEAU</Badge>
        </CardTitle>
        <CardDescription>
          Uploadez plusieurs documents, l'IA classifiera automatiquement chaque pièce
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          onChange={handleFileSelect}
          className="hidden"
          id="batch-upload"
          multiple
        />

        {/* File list */}
        {pendingFiles.length > 0 && (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {pendingFiles.map((pf, index) => (
              <div 
                key={index}
                className="flex items-center gap-2 text-sm bg-muted/50 px-3 py-2 rounded-md"
              >
                <FileText className="h-4 w-4 flex-shrink-0" />
                <span className="truncate flex-1">{pf.name}</span>
                {!isProcessing && status !== 'done' && (
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Progress */}
        {isProcessing && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">{currentStep}</p>
          </div>
        )}

        {/* Error message */}
        {status === 'error' && errorMessage && (
          <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
            {errorMessage}
          </div>
        )}

        {/* Status indicator */}
        {status === 'done' && (
          <div className="flex items-center justify-center gap-2 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-medium">Classification terminée !</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 justify-center">
          {status === 'idle' && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                style={primaryColor ? { borderColor: primaryColor, color: primaryColor } : undefined}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                {pendingFiles.length > 0 ? 'Ajouter des documents' : 'Sélectionner les documents'}
              </Button>

              {pendingFiles.length > 0 && (
                <Button
                  type="button"
                  onClick={startProcess}
                  style={primaryColor ? { backgroundColor: primaryColor } : undefined}
                  className="gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  Classifier {pendingFiles.length} document(s)
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </>
          )}

          {(status === 'done' || status === 'error') && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={reset}
            >
              Nouveau dossier
            </Button>
          )}
        </div>

        {/* Info */}
        <p className="text-xs text-muted-foreground text-center">
          Pièce d'identité, ancienne police, nouveau contrat, résiliation, art.45... 
          L'IA classifiera chaque document automatiquement.
        </p>
      </CardContent>
    </Card>
  );
}
