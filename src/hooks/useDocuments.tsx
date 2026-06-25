import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useUserTenant } from '@/hooks/useUserTenant';
import { translateError } from '@/lib/errorTranslations';
import { ClientNotifications } from '@/lib/clientNotifications';
import { usePaginatedQuery } from './usePaginatedQuery';

export type Document = {
  id: string;
  owner_id: string;
  owner_type: string;
  file_name: string;
  file_key: string;
  mime_type?: string | null;
  size_bytes?: number | null;
  doc_kind?: string | null;
  created_by?: string | null;
  created_at: string;
  // Migration 20260625160000 : dossier libre par client. NULL = "racine".
  folder_id?: string | null;
};

export function useDocuments() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { tenantId, loading: tenantLoading } = useUserTenant();

  const { data: documents, page, totalCount, totalPages, goToPage, nextPage, prevPage, isLoading: loading, isError, refetch } = usePaginatedQuery<Document>({
    queryKey: ['documents', tenantId ?? ''],
    buildQuery: (client) =>
      client
        .from('documents')
        .select('*')
        .eq('tenant_id', tenantId ?? '')
        .order('created_at', { ascending: false }),
    pageSize: 50,
    enabled: !tenantLoading && !!tenantId && !!user,
  });

  const createDocument = async (documentData: any) => {
    try {
      if (!tenantId) {
        throw new Error("Aucun cabinet assigné à cet utilisateur");
      }

      const { data, error } = await supabase
        .from('documents')
        .insert([{
          ...documentData,
          created_by: user?.id,
          tenant_id: tenantId
        }])
        .select()
        .single();

      if (error) throw error;

      // Notifier le client si c'est un document client
      if (data && documentData.owner_type === 'client' && documentData.owner_id) {
        ClientNotifications.newDocument(documentData.owner_id, documentData.file_name, documentData.doc_kind);
      }

      toast({
        title: "Document créé",
        description: "Le document a été enregistré avec succès"
      });

      refetch();
      return data;
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: translateError(error.message),
        variant: "destructive"
      });
      throw error;
    }
  };

  const updateDocument = async (id: string, updates: Partial<Pick<Document, 'doc_kind' | 'file_name'>>) => {
    try {
      const { error } = await supabase
        .from('documents')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Document mis à jour",
        description: "Les modifications ont été enregistrées"
      });

      refetch();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: translateError(error.message),
        variant: "destructive"
      });
      throw error;
    }
  };

  const deleteDocument = async (id: string) => {
    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Document supprimé",
        description: "Le document a été supprimé avec succès"
      });

      refetch();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
      throw error;
    }
  };

  return {
    documents,
    loading,
    page,
    totalCount,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    fetchDocuments: refetch,
    createDocument,
    updateDocument,
    deleteDocument
  };
}
