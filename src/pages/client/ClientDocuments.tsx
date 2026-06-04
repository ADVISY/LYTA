import { useState, useEffect, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText,
  Download,
  Eye,
  Search,
  File,
  FileImage,
  Upload,
  FolderOpen,
  AlertCircle,
  Plus,
  Loader2,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { invokeSupabaseFunction } from "@/lib/edgeFunctions";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const getDocKindLabels = (t: (key: string) => string): Record<string, string> => ({
  mandat_gestion: t('clientDocuments.kinds.managementMandate'),
  police: t('clientDocuments.kinds.policy'),
  attestation: t('clientDocuments.kinds.certificate'),
  facture: t('clientDocuments.kinds.invoice'),
  decompte: t('clientDocuments.kinds.statement'),
  carte_assurance: t('clientDocuments.kinds.insuranceCard'),
  other: t('clientDocuments.kinds.other'),
});

const getFileIcon = (mimeType: string | null) => {
  if (!mimeType) return File;
  if (mimeType.includes('image')) return FileImage;
  if (mimeType.includes('pdf')) return FileText;
  return File;
};

export default function ClientDocuments() {
  const { t } = useTranslation();
  const { clientData } = useOutletContext<{ user: any; clientData: any }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // ─── Upload dialog state ─────────────────────────────────────────────
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docKind, setDocKind] = useState<string>("other");
  const [docDescription, setDocDescription] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const docKindLabels = getDocKindLabels(t);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast({
        title: "Fichier trop volumineux",
        description: `La taille max est de 25 Mo. Ton fichier fait ${(file.size / 1024 / 1024).toFixed(1)} Mo.`,
        variant: "destructive",
      });
      return;
    }
    if (file.type && !ACCEPTED_MIME_TYPES.includes(file.type)) {
      toast({
        title: "Format non supporté",
        description: "Formats acceptés : PDF, image (JPG/PNG/WebP), Word.",
        variant: "destructive",
      });
      return;
    }
    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (fileInputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInputRef.current.files = dt.files;
    }
    handleFileChange({ target: { files: e.dataTransfer.files } } as any);
  };

  const resetUploadForm = () => {
    setSelectedFile(null);
    setDocKind("other");
    setDocDescription("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = async () => {
    if (!selectedFile || !clientData?.id || !clientData?.tenant_id) return;
    setUploading(true);
    try {
      // 1. Upload fichier vers storage bucket 'documents'
      // Path : <tenant_id>/client_uploads/<client_id>/<uuid>_<filename>
      const safeFileName = selectedFile.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const fileKey = `${clientData.tenant_id}/client_uploads/${clientData.id}/${crypto.randomUUID()}_${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(fileKey, selectedFile, {
          contentType: selectedFile.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) {
        console.error("[upload] storage error", uploadError);
        toast({
          title: "Échec de l'envoi du fichier",
          description: uploadError.message,
          variant: "destructive",
        });
        setUploading(false);
        return;
      }

      // 2. INSERT row documents via edge function bypass-insert (RLS-safe)
      const payload = {
        tenant_id: clientData.tenant_id,
        owner_type: "client",
        owner_id: clientData.id,
        file_key: fileKey,
        file_name: selectedFile.name,
        mime_type: selectedFile.type || "application/octet-stream",
        size_bytes: selectedFile.size,
        doc_kind: docKind,
        category: "Espace client",
        description: docDescription.trim() || null,
        created_by: user?.id ?? null,
        metadata: {
          source: "client_portal_upload",
          uploaded_at: new Date().toISOString(),
        },
      };

      const result = await invokeSupabaseFunction<{ success: boolean; id: string }>(
        "bypass-insert",
        { body: { table: "documents", payload } },
      );

      if (!result?.success) {
        throw new Error("La fiche document n'a pas pu être créée");
      }

      toast({
        title: "Document ajouté",
        description: `${selectedFile.name} est maintenant disponible dans ton espace.`,
      });

      resetUploadForm();
      setUploadOpen(false);
      await fetchDocuments();
    } catch (err: any) {
      console.error("[upload] error", err);
      toast({
        title: "Erreur",
        description: err?.message || "Une erreur est survenue lors de l'envoi.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (!clientData?.id) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    fetchDocuments();
  }, [clientData?.id]);

  const fetchDocuments = async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('owner_id', clientData.id)
        .eq('owner_type', 'client')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching documents:', error);
        toast({
          title: t('common.error'),
          description: t('clientDocuments.fetchError') || 'Erreur lors du chargement des documents',
          variant: "destructive"
        });
        return;
      }

      if (data) setDocuments(data);
    } catch (error) {
      console.error('Unexpected error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (doc: any) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(doc.file_key);
      
      if (error) throw error;
      
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: t('common.error'),
        description: t('clientDocuments.downloadError'),
        variant: "destructive"
      });
    }
  };

  const handleView = async (doc: any) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(doc.file_key, 3600);
      
      if (error) throw error;
      
      window.open(data.signedUrl, '_blank');
    } catch (error) {
      console.error('View error:', error);
      toast({
        title: t('common.error'),
        description: t('clientDocuments.viewError'),
        variant: "destructive"
      });
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filteredDocuments = documents.filter(doc => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return doc.file_name?.toLowerCase().includes(query) || 
           docKindLabels[doc.doc_kind]?.toLowerCase().includes(query);
  });

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!clientData?.id) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t('clientDocuments.title')}</h1>
          <p className="text-muted-foreground">{t('clientDocuments.subtitle')}</p>
        </div>

        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 lg:h-16 lg:w-16 mx-auto mb-4 text-amber-500" />
            <h3 className="text-base lg:text-lg font-medium mb-2">
              {t('clientSpace.clientProfileUnavailable')}
            </h3>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto">
              {t('clientSpace.clientProfileUnavailableDescription')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('clientDocuments.title')}</h1>
          <p className="text-muted-foreground">{t('clientDocuments.subtitle')}</p>
        </div>
        <Button
          onClick={() => setUploadOpen(true)}
          className="gap-2 self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Ajouter un document
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('clientDocuments.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Documents Grid */}
      {filteredDocuments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">{t('clientDocuments.noDocuments')}</h3>
            <p className="text-muted-foreground">
              {searchQuery ? t('clientDocuments.noSearchResults') : t('clientDocuments.noDocumentsDescription')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocuments.map((doc) => {
            const FileIcon = getFileIcon(doc.mime_type);
            
            return (
              <Card key={doc.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <FileIcon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate" title={doc.file_name}>
                        {doc.file_name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {docKindLabels[doc.doc_kind] || doc.doc_kind || 'Document'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <span>{format(new Date(doc.created_at), 'dd MMM yyyy', { locale: fr })}</span>
                        <span>•</span>
                        <span>{formatFileSize(doc.size_bytes)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mt-4 pt-3 border-t">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 gap-1.5"
                      onClick={() => handleView(doc)}
                    >
                      <Eye className="h-4 w-4" />
                      {t('clientDocuments.view')}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 gap-1.5"
                      onClick={() => handleDownload(doc)}
                    >
                      <Download className="h-4 w-4" />
                      {t('clientDocuments.download')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog : Ajouter un document */}
      <Dialog open={uploadOpen} onOpenChange={(open) => {
        if (uploading) return;
        setUploadOpen(open);
        if (!open) resetUploadForm();
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Ajouter un document
            </DialogTitle>
            <DialogDescription>
              Le document sera ajouté à ton dossier et visible par ton courtier.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Zone de dépôt */}
            {!selectedFile ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
              >
                <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="font-medium text-sm">Clique ou dépose un fichier ici</p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, image (JPG/PNG/WebP), Word — max 25 Mo
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_MIME_TYPES.join(",")}
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border">
                <FileText className="h-8 w-8 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} Mo
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={resetUploadForm}
                  disabled={uploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Type de document */}
            <div className="space-y-2">
              <Label>Type de document</Label>
              <Select value={docKind} onValueChange={setDocKind} disabled={uploading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(docKindLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description (optionnelle) */}
            <div className="space-y-2">
              <Label htmlFor="doc-desc">Note pour ton courtier <span className="text-xs text-muted-foreground">(optionnel)</span></Label>
              <Textarea
                id="doc-desc"
                value={docDescription}
                onChange={(e) => setDocDescription(e.target.value)}
                placeholder="Ex : Nouveau permis de conduire, suite à ton message du..."
                rows={3}
                disabled={uploading}
                maxLength={500}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setUploadOpen(false); resetUploadForm(); }}
              disabled={uploading}
            >
              Annuler
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Envoi…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Envoyer le document
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
