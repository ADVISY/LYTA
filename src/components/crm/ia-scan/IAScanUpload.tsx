import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  Upload, 
  Loader2, 
  Sparkles, 
  FileText, 
  CheckCircle2,
  AlertCircle,
  Wand2
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface IAScanUploadProps {
  formType: 'sana' | 'vita' | 'medio' | 'business';
  tenantId?: string;
  onScanComplete: (results: ScanResults) => void;
  primaryColor?: string;
}

export interface ScanResults {
  scanId: string;
  documentType: string;
  documentTypeConfidence: number;
  qualityScore: number;
  overallConfidence: number;
  fields: ExtractedField[];
}

export interface ExtractedField {
  id: string;
  category: string;
  name: string;
  value: string | null;
  confidence: 'high' | 'medium' | 'low';
  confidenceScore: number;
  notes?: string;
}

type ScanStatus = 'idle' | 'uploading' | 'scanning' | 'completed' | 'error';

export default function IAScanUpload({ 
  formType, 
  tenantId,
  onScanComplete,
  primaryColor 
}: IAScanUploadProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (20MB max)
    if (file.size > 20 * 1024 * 1024) {
      toast({
        title: "Fichier trop volumineux",
        description: "La taille maximale est de 20MB",
        variant: "destructive",
      });
      return;
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Type de fichier non supporté",
        description: "Formats acceptés: PDF, JPG, PNG, WEBP",
        variant: "destructive",
      });
      return;
    }

    setFileName(file.name);
    setStatus('uploading');
    setProgress(10);
    setErrorMessage(null);

    try {
      // 1. Upload file to storage
      const fileExt = file.name.split('.').pop();
      const storagePath = `ia-scans/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, file);

      if (uploadError) throw uploadError;
      setProgress(30);

      // 2. Create scan record
      const { data: scanRecord, error: scanError } = await supabase
        .from('document_scans' as any)
        .insert({
          tenant_id: tenantId,
          source_type: 'deposit',
          source_form_type: formType,
          original_file_key: storagePath,
          original_file_name: file.name,
          mime_type: file.type,
          status: 'pending',
        })
        .select()
        .single();

      if (scanError) throw scanError;
      setProgress(50);
      setStatus('scanning');

      // 3. Call scan-document edge function
      const { data: scanResult, error: functionError } = await supabase.functions.invoke('scan-document', {
        body: {
          scanId: (scanRecord as any).id,
          fileKey: storagePath,
          fileName: file.name,
          mimeType: file.type,
          formType,
          tenantId,
        }
      });

      if (functionError) throw functionError;
      if (!scanResult.success) throw new Error(scanResult.error || 'Scan failed');
      
      setProgress(80);

      // 4. Fetch extracted fields
      const { data: extractedFields, error: fieldsError } = await supabase
        .from('document_scan_results' as any)
        .select('*')
        .eq('scan_id', (scanRecord as any).id);

      if (fieldsError) throw fieldsError;

      setProgress(100);
      setStatus('completed');

      // 5. Build results
      const results: ScanResults = {
        scanId: (scanRecord as any).id,
        documentType: scanResult.documentType,
        documentTypeConfidence: scanResult.documentTypeConfidence,
        qualityScore: scanResult.qualityScore,
        overallConfidence: scanResult.overallConfidence,
        fields: (extractedFields as any[]).map(f => ({
          id: f.id,
          category: f.field_category,
          name: f.field_name,
          value: f.extracted_value,
          confidence: f.confidence,
          confidenceScore: f.confidence_score,
          notes: f.extraction_notes,
        })),
      };

      onScanComplete(results);

      toast({
        title: "Document analysé",
        description: `${results.fields.length} champs extraits avec succès`,
      });

    } catch (error: any) {
      console.error('IA Scan error:', error);
      setStatus('error');
      setErrorMessage(error.message || 'Une erreur est survenue');
      toast({
        title: "Erreur d'analyse",
        description: error.message || 'Impossible d\'analyser le document',
        variant: "destructive",
      });
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const resetScan = () => {
    setStatus('idle');
    setProgress(0);
    setFileName(null);
    setErrorMessage(null);
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'uploading':
      case 'scanning':
        return <Loader2 className="h-8 w-8 animate-spin" style={{ color: primaryColor || 'hsl(var(--primary))' }} />;
      case 'completed':
        return <CheckCircle2 className="h-8 w-8 text-emerald-500" />;
      case 'error':
        return <AlertCircle className="h-8 w-8 text-destructive" />;
      default:
        return <Wand2 className="h-8 w-8" style={{ color: primaryColor || 'hsl(var(--primary))' }} />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'uploading':
        return 'Upload en cours...';
      case 'scanning':
        return 'Analyse IA en cours...';
      case 'completed':
        return 'Analyse terminée !';
      case 'error':
        return errorMessage || 'Erreur d\'analyse';
      default:
        return 'Scannez un document pour pré-remplir automatiquement';
    }
  };

  return (
    <Card className="border-2 border-dashed transition-all hover:border-primary/50" 
          style={{ borderColor: status === 'completed' ? '#10b981' : undefined }}>
      <CardContent className="p-6">
        <Input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          onChange={handleFileSelect}
          className="hidden"
          id="ia-scan-upload"
        />

        <div className="flex flex-col items-center gap-4 text-center">
          {/* Icon */}
          <div className="relative">
            {getStatusIcon()}
            {status === 'idle' && (
              <Sparkles className="h-4 w-4 absolute -top-1 -right-1 text-amber-500" />
            )}
          </div>

          {/* Title */}
          <div>
            <h3 className="font-semibold flex items-center justify-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              IA SCAN
              <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">
                BETA
              </span>
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {getStatusText()}
            </p>
          </div>

          {/* File name */}
          {fileName && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-md">
              <FileText className="h-4 w-4" />
              <span className="truncate max-w-[200px]">{fileName}</span>
            </div>
          )}

          {/* Progress bar */}
          {(status === 'uploading' || status === 'scanning') && (
            <div className="w-full max-w-xs">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {status === 'uploading' ? 'Upload du document...' : 'Extraction des données...'}
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            {status === 'idle' && (
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                style={primaryColor ? { borderColor: primaryColor, color: primaryColor } : undefined}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                Scanner un document
              </Button>
            )}

            {(status === 'completed' || status === 'error') && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetScan}
              >
                Scanner un autre document
              </Button>
            )}
          </div>

          {/* Disclaimer */}
          <p className="text-xs text-muted-foreground max-w-sm">
            Les données extraites sont des propositions de l'IA. Vérifiez avant validation.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
