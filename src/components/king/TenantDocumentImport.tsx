import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Upload,
  FolderArchive,
  CheckCircle2,
  XCircle,
  Loader2,
  RotateCcw,
  FileText,
  FileImage,
  File,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface TenantDocumentImportProps {
  tenantId: string;
  tenantName: string;
  onComplete?: () => void;
}

interface FileInfo {
  name: string;
  size: number;
  type: string;
  file: File;
}

interface UploadResult {
  success: number;
  failed: number;
  errors: string[];
}

export function TenantDocumentImport({ tenantId, tenantName, onComplete }: TenantDocumentImportProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const getFileIcon = (type: string) => {
    if (type.includes("image")) return FileImage;
    if (type.includes("pdf")) return FileText;
    return File;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    const newFiles: FileInfo[] = [];
    
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      
      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "Fichier trop volumineux",
          description: `${file.name} dépasse 10MB et sera ignoré.`,
          variant: "destructive",
        });
        continue;
      }
      
      // Validate file type
      const allowedTypes = [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];
      
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Type non supporté",
          description: `${file.name} n'est pas un format supporté.`,
          variant: "destructive",
        });
        continue;
      }
      
      newFiles.push({
        name: file.name,
        size: file.size,
        type: file.type,
        file,
      });
    }
    
    setFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const executeUpload = async () => {
    setUploading(true);
    setUploadProgress(0);
    setConfirmDialogOpen(false);
    
    let success = 0;
    let failed = 0;
    const errors: string[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const fileInfo = files[i];
      
      try {
        // Generate unique file path
        const fileExt = fileInfo.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${tenantId}/${fileName}`;
        
        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(filePath, fileInfo.file);
        
        if (uploadError) throw uploadError;
        
        // Create document record
        const { error: dbError } = await supabase
          .from("documents")
          .insert({
            tenant_id: tenantId,
            owner_id: tenantId, // Owner is tenant itself for bulk imports
            owner_type: "import",
            file_key: filePath,
            file_name: fileInfo.name,
            mime_type: fileInfo.type,
            size_bytes: fileInfo.size,
            doc_kind: "autre",
          });
        
        if (dbError) throw dbError;
        
        success++;
      } catch (error: any) {
        failed++;
        errors.push(`${fileInfo.name}: ${error.message}`);
      }
      
      setUploadProgress(Math.round(((i + 1) / files.length) * 100));
    }
    
    setUploadResult({ success, failed, errors });
    setUploading(false);
  };

  const reset = () => {
    setFiles([]);
    setUploadResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  if (uploadResult) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center mb-6">
            {uploadResult.failed === 0 ? (
              <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-emerald-500" />
            ) : (
              <XCircle className="h-16 w-16 mx-auto mb-4 text-amber-500" />
            )}
            <h3 className="text-xl font-bold mb-2">Upload terminé</h3>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 max-w-md mx-auto mb-6">
            <div className="p-4 bg-emerald-500/10 rounded-lg text-center">
              <p className="text-2xl font-bold text-emerald-600">{uploadResult.success}</p>
              <p className="text-sm text-muted-foreground">Uploadés</p>
            </div>
            <div className="p-4 bg-destructive/10 rounded-lg text-center">
              <p className="text-2xl font-bold text-destructive">{uploadResult.failed}</p>
              <p className="text-sm text-muted-foreground">Échoués</p>
            </div>
          </div>
          
          {uploadResult.errors.length > 0 && (
            <div className="max-w-lg mx-auto mb-6">
              <p className="text-sm font-medium mb-2">Erreurs:</p>
              <ScrollArea className="h-32 border rounded-lg p-3">
                <ul className="text-sm space-y-1">
                  {uploadResult.errors.map((err, i) => (
                    <li key={i} className="text-destructive">{err}</li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
          )}
          
          <div className="flex justify-center gap-4">
            <Button variant="outline" onClick={reset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Nouvel upload
            </Button>
            {onComplete && (
              <Button onClick={onComplete}>
                Terminer
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (uploading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
          <h3 className="text-lg font-medium mb-2">Upload en cours...</h3>
          <p className="text-muted-foreground mb-4">
            Veuillez patienter, ne fermez pas cette fenêtre.
          </p>
          <Progress value={uploadProgress} className="max-w-md mx-auto" />
          <p className="text-sm text-muted-foreground mt-2">
            {uploadProgress}%
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderArchive className="h-5 w-5" />
            Importer des documents
          </CardTitle>
          <CardDescription>
            Uploadez plusieurs documents à la fois pour {tenantName}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload zone */}
          <div 
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="font-medium">Cliquez ou glissez vos fichiers ici</p>
            <p className="text-sm text-muted-foreground mt-1">
              PDF, Images (JPG, PNG, WEBP), Documents Word • Max 10MB par fichier
            </p>
          </div>
          
          {/* Files list */}
          {files.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{files.length} fichier(s) sélectionné(s)</p>
              <ScrollArea className="h-48 border rounded-lg">
                <div className="p-2 space-y-2">
                  {files.map((file, index) => {
                    const Icon = getFileIcon(file.type);
                    return (
                      <div key={index} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                        <Icon className="h-5 w-5 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => removeFile(index)}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}
          
          {/* Actions */}
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={reset} disabled={files.length === 0}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Réinitialiser
            </Button>
            <Button 
              onClick={() => setConfirmDialogOpen(true)} 
              disabled={files.length === 0}
            >
              <Upload className="h-4 w-4 mr-2" />
              Uploader {files.length} fichier(s)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer l'upload</AlertDialogTitle>
            <AlertDialogDescription>
              Vous êtes sur le point d'uploader {files.length} document(s) 
              pour le tenant <strong>{tenantName}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={executeUpload}>
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
