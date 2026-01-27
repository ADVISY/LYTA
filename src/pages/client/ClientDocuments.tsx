import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Download, 
  Eye, 
  Search,
  File,
  FileImage,
  Upload,
  FolderOpen
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  const docKindLabels = getDocKindLabels(t);

  useEffect(() => {
    if (clientData?.id) {
      fetchDocuments();
    }
  }, [clientData]);

  const fetchDocuments = async () => {
    setLoading(true);
    
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('owner_id', clientData.id)
      .eq('owner_type', 'client')
      .order('created_at', { ascending: false });
    
    if (data) setDocuments(data);
    setLoading(false);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('clientDocuments.title')}</h1>
          <p className="text-muted-foreground">{t('clientDocuments.subtitle')}</p>
        </div>
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
    </div>
  );
}
