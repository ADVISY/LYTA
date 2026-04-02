import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Upload, X, FileText, Loader2, CheckCircle2 } from "lucide-react";

interface SingleDocumentUploadProps {
  label: string;
  docKind: string;
  onUpload: (doc: { file_key: string; file_name: string; doc_kind: string; mime_type: string; size_bytes: number }) => void;
  onRemove: () => void;
  uploadedDocument?: { file_key: string; file_name: string; doc_kind: string } | null;
  required?: boolean;
  primaryColor?: string;
}

export default function SingleDocumentUpload({ 
  label, 
  docKind, 
  onUpload, 
  onRemove, 
  uploadedDocument,
  required = false,
  primaryColor
}: SingleDocumentUploadProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Fichier trop volumineux",
        description: "La taille maximale est de 10MB",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Generate unique file path - use public-deposits folder for public access
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `public-deposits/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Call onUpload with document info
      onUpload({
        file_key: filePath,
        file_name: file.name,
        doc_kind: docKind,
        mime_type: file.type,
        size_bytes: file.size,
      });

      toast({
        title: "Document ajouté",
        description: file.name,
      });

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      toast({
        title: "Erreur d'upload",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div 
      className={`p-4 rounded-lg border-2 transition-all ${
        uploadedDocument 
          ? 'border-emerald-500/50 bg-emerald-500/5' 
          : 'border-dashed border-muted-foreground/30 hover:border-muted-foreground/50'
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {uploadedDocument ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
          ) : (
            <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className={`font-medium text-sm ${uploadedDocument ? 'text-emerald-700 dark:text-emerald-400' : ''}`}>
              {label}
              {required && <span className="text-destructive ml-1">*</span>}
            </p>
            {uploadedDocument && (
              <p className="text-xs text-muted-foreground truncate">
                {uploadedDocument.file_name}
              </p>
            )}
          </div>
        </div>

        <div className="shrink-0">
          <Input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
            onChange={handleFileSelect}
            className="hidden"
            id={`file-upload-${docKind}`}
          />
          
          {uploadedDocument ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              style={primaryColor ? { borderColor: primaryColor, color: primaryColor } : undefined}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Ajouter
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
