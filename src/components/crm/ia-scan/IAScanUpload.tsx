import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  Upload, 
  Loader2, 
  Sparkles, 
  FileText, 
  CheckCircle2,
  AlertCircle,
  Wand2,
  X,
  Crown,
  Lock
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TenantPlan, isModuleEnabled, PLAN_CONFIGS } from "@/config/plans";
import lytaSmartFlowLogo from "@/assets/lyta-smartflow-logo.png";

interface IAScanUploadProps {
  formType: 'sana' | 'vita' | 'medio' | 'business';
  tenantId?: string;
  tenantPlan?: TenantPlan;
  onScanComplete: (results: ScanResults) => void;
  primaryColor?: string;
  verifiedPartnerEmail?: string;
  verifiedPartnerId?: string;
}

export interface ScanResults {
  scanId: string;
  documentType: string;
  documentTypeConfidence: number;
  qualityScore: number;
  overallConfidence: number;
  fields: ExtractedField[];
  documentsProcessed?: number;
}

export interface ExtractedField {
  id: string;
  category: string;
  name: string;
  value: string | null;
  confidence: 'high' | 'medium' | 'low';
  confidenceScore: number;
  notes?: string;
  sourceDocument?: string;
}

type ScanStatus = 'idle' | 'uploading' | 'scanning' | 'completed' | 'error';

interface UploadedFile {
  file: File;
  name: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  storagePath?: string;
}

export default function IAScanUpload({ 
  formType, 
  tenantId,
  tenantPlan = 'start',
  onScanComplete,
  primaryColor,
  verifiedPartnerEmail,
  verifiedPartnerId,
}: IAScanUploadProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<string>('');

  // Check if module is enabled for this tenant's plan
  const isIaScanEnabled = isModuleEnabled(tenantPlan, 'ia_scan');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate files
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 20 * 1024 * 1024; // 20MB

    const validFiles: UploadedFile[] = [];
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
      validFiles.push({ file, name: file.name, status: 'pending' });
    }

    if (validFiles.length === 0) return;

    setUploadedFiles(prev => [...prev, ...validFiles]);
    setStatus('idle');
    setErrorMessage(null);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const startScan = async () => {
    if (uploadedFiles.length === 0) return;

    const normalizedVerifiedEmail = (verifiedPartnerEmail ?? '').trim().toLowerCase();
    if (!normalizedVerifiedEmail) {
      setStatus('error');
      setProgress(0);
      setCurrentStep('');
      setErrorMessage("Veuillez vérifier votre email collaborateur avant d'utiliser l'IA Scan.");
      toast({
        title: "Accès refusé",
        description: "Veuillez vérifier votre email collaborateur avant d'utiliser l'IA Scan.",
        variant: "destructive",
      });
      return;
    }

    setStatus('uploading');
    setProgress(5);
    setErrorMessage(null);

    try {
      // 1. Upload all files to storage
      setCurrentStep('Upload des documents...');
      const uploadedPaths: { path: string; fileName: string; mimeType: string }[] = [];
      
      for (let i = 0; i < uploadedFiles.length; i++) {
        const uploadFile = uploadedFiles[i];
        setUploadedFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'uploading' } : f
        ));

        const fileExt = uploadFile.file.name.split('.').pop();
        const storagePath = `ia-scans/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(storagePath, uploadFile.file);

        if (uploadError) {
          setUploadedFiles(prev => prev.map((f, idx) => 
            idx === i ? { ...f, status: 'error' } : f
          ));
          throw new Error(`Erreur upload ${uploadFile.name}: ${uploadError.message}`);
        }

        uploadedPaths.push({
          path: storagePath,
          fileName: uploadFile.file.name,
          mimeType: uploadFile.file.type
        });

        setUploadedFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'uploaded', storagePath } : f
        ));

        setProgress(5 + Math.round((i + 1) / uploadedFiles.length * 25));
      }

      setProgress(35);
      setStatus('scanning');
      setCurrentStep('Création du dossier de scan...');

      // 2. Create scan record for the batch (requires verified partner email for security)
      const { data: scanRecord, error: scanError } = await supabase
        .from('document_scans' as any)
        .insert({
          tenant_id: tenantId,
          source_type: 'deposit',
          source_form_type: formType,
          original_file_key: uploadedPaths[0].path, // Primary file
          original_file_name: `Dossier (${uploadedFiles.length} documents)`,
          mime_type: 'batch',
          status: 'pending',
          verified_partner_email: normalizedVerifiedEmail,
          verified_partner_id: verifiedPartnerId ?? null,
        })
        .select()
        .single();

      if (scanError) throw scanError;
      setProgress(45);
      setCurrentStep('Analyse IA en cours...');

      // 3. Call scan-document edge function with all files
      const { data: scanResult, error: functionError } = await supabase.functions.invoke('scan-document', {
        body: {
          scanId: (scanRecord as any).id,
          files: uploadedPaths,
          formType,
          tenantId,
          batchMode: true,
        }
      });

      if (functionError) throw functionError;
      if (!scanResult.success) throw new Error(scanResult.error || 'Scan failed');
      
      setProgress(80);
      setCurrentStep('Récupération des données extraites...');

      // 4. Fetch extracted fields
      const { data: extractedFields, error: fieldsError } = await supabase
        .from('document_scan_results' as any)
        .select('*')
        .eq('scan_id', (scanRecord as any).id);

      if (fieldsError) throw fieldsError;

      setProgress(100);
      setStatus('completed');
      setCurrentStep('');

      // 5. Build results
      const results: ScanResults = {
        scanId: (scanRecord as any).id,
        documentType: scanResult.documentType,
        documentTypeConfidence: scanResult.documentTypeConfidence,
        qualityScore: scanResult.qualityScore,
        overallConfidence: scanResult.overallConfidence,
        documentsProcessed: uploadedFiles.length,
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
        title: "Dossier analysé",
        description: `${uploadedFiles.length} documents traités, ${results.fields.length} champs extraits`,
      });

    } catch (error: any) {
      console.error('IA Scan error:', error);
      setStatus('error');
      setCurrentStep('');
      setErrorMessage(error.message || 'Une erreur est survenue');
      toast({
        title: "Erreur d'analyse",
        description: error.message || 'Impossible d\'analyser les documents',
        variant: "destructive",
      });
    }
  };

  const resetScan = () => {
    setStatus('idle');
    setProgress(0);
    setUploadedFiles([]);
    setErrorMessage(null);
    setCurrentStep('');
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
        return currentStep || 'Upload en cours...';
      case 'scanning':
        return currentStep || 'Analyse IA en cours...';
      case 'completed':
        return 'Analyse terminée !';
      case 'error':
        return errorMessage || 'Erreur d\'analyse';
      default:
        return uploadedFiles.length > 0 
          ? `${uploadedFiles.length} document(s) prêt(s) à scanner`
          : 'Déposez votre dossier complet (plusieurs documents)';
    }
  };

  const isProcessing = status === 'uploading' || status === 'scanning';

  // If module not enabled, show upgrade prompt
  if (!isIaScanEnabled) {
    return (
      <Card className="border-dashed border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex items-center justify-center">
            <img src={lytaSmartFlowLogo} alt="LYTA Smart Flow" className="h-10 w-auto" />
          </div>
          <CardDescription className="space-y-1">
            <span className="font-medium text-foreground">{t('iaScan.intelligentScanner', 'Scanner intelligent de documents')}</span>
            <br />
            {t('iaScan.availableWith', 'Disponible avec les offres')}{' '}
            <Badge variant="secondary" className="ml-1">Prime</Badge>{' '}
            <Badge variant="secondary" className="ml-1">Prime Founder</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center pt-2">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Crown className="h-4 w-4 text-amber-500" />
            Contactez votre administrateur pour activer cette fonctionnalité
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-dashed transition-all hover:border-primary/50" 
          style={{ borderColor: status === 'completed' ? 'hsl(var(--success))' : undefined }}>
      <CardContent className="p-6">
        <Input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          onChange={handleFileSelect}
          className="hidden"
          id="ia-scan-upload"
          multiple
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
            <div className="flex items-center justify-center gap-2 mb-1">
              <img src={lytaSmartFlowLogo} alt="LYTA Smart Flow" className="h-8 w-auto" />
              <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">
                BETA
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {getStatusText()}
            </p>
          </div>

          {/* Files list */}
          {uploadedFiles.length > 0 && (
            <div className="w-full max-w-md space-y-2">
              {uploadedFiles.map((uf, index) => (
                <div 
                  key={index}
                  className="flex items-center gap-2 text-sm bg-muted/50 px-3 py-2 rounded-md"
                >
                  <FileText className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate flex-1 text-left">{uf.name}</span>
                  {uf.status === 'uploading' && (
                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                  )}
                  {uf.status === 'uploaded' && (
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  )}
                  {uf.status === 'error' && (
                    <AlertCircle className="h-3 w-3 text-destructive" />
                  )}
                  {!isProcessing && status !== 'completed' && (
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

          {/* Progress bar */}
          {isProcessing && (
            <div className="w-full max-w-xs">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {currentStep}
              </p>
            </div>
          )}

          {/* Action buttons */}
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
                  {uploadedFiles.length > 0 ? 'Ajouter des documents' : 'Sélectionner les documents'}
                </Button>

                {uploadedFiles.length > 0 && (
                  <Button
                    type="button"
                    onClick={startScan}
                    style={primaryColor ? { backgroundColor: primaryColor } : undefined}
                    className="gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    Scanner {uploadedFiles.length} document(s)
                  </Button>
                )}
              </>
            )}

            {(status === 'completed' || status === 'error') && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetScan}
              >
                Scanner un autre dossier
              </Button>
            )}
          </div>

          {/* Badge documents count */}
          {status === 'completed' && (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {uploadedFiles.length} documents analysés
            </Badge>
          )}

          {/* Disclaimer */}
          <p className="text-xs text-muted-foreground max-w-sm">
            Déposez tous les documents du dossier (police, offre, attestation...). L'IA consolidera les informations automatiquement.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
