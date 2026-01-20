import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Upload, X, FileText, Loader2 } from "lucide-react";

interface DocumentUploadProps {
  onUpload: (doc: { file_key: string; file_name: string; doc_kind: string; mime_type: string; size_bytes: number }) => void;
  onRemove?: (index: number) => void;
  documents?: Array<{ file_key: string; file_name: string; doc_kind: string }>;
  showList?: boolean;
}

const docKindOptions = [
  { value: "police_assurance", label: "Police d'assurance" },
  { value: "piece_identite", label: "Pièce d'identité" },
  { value: "resiliation", label: "Résiliation" },
  { value: "attestation", label: "Attestation" },
  { value: "facture", label: "Facture" },
  { value: "justificatif", label: "Justificatif" },
  { value: "contrat", label: "Contrat signé" },
  { value: "autre", label: "Autre" },
];

export default function DocumentUpload({ onUpload, onRemove, documents = [], showList = true }: DocumentUploadProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedKind, setSelectedKind] = useState("police_assurance");

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
        doc_kind: selectedKind,
        mime_type: file.type,
        size_bytes: file.size,
      });

      toast({
        title: "Document uploadé",
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

  const getDocKindLabel = (kind: string) => {
    return docKindOptions.find(o => o.value === kind)?.label || kind;
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center">
        <Select value={selectedKind} onValueChange={setSelectedKind}>
          <SelectTrigger className="w-32 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {docKindOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
          onChange={handleFileSelect}
          className="hidden"
          id="file-upload"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="h-9 px-3"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          <span className="ml-2 hidden sm:inline">{uploading ? "..." : "Ajouter"}</span>
        </Button>
      </div>

      {showList && documents.length > 0 && (
        <div className="space-y-1">
          {documents.map((doc, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate">{doc.file_name}</span>
              </div>
              {onRemove && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(index)}
                  className="h-6 w-6 p-0 text-destructive hover:text-destructive shrink-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export { docKindOptions };
