import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useUserTenant } from '@/hooks/useUserTenant';
import { translateError } from '@/lib/errorTranslations';
import { ClientNotifications } from '@/lib/clientNotifications';

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
};

export function useDocuments() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  const { tenantId } = useUserTenant();

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const { data, error} = await supabase
        .from('documents' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments((data as any) || []);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: translateError(error.message),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createDocument = async (documentData: any) => {
    try {
      if (!tenantId) {
        throw new Error("Aucun cabinet assigné à cet utilisateur");
      }

      const { data, error } = await supabase
        .from('documents' as any)
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

      await fetchDocuments();
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

  const deleteDocument = async (id: string) => {
    try {
      const { error } = await supabase
        .from('documents' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Document supprimé",
        description: "Le document a été supprimé avec succès"
      });

      await fetchDocuments();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
      throw error;
    }
  };

  useEffect(() => {
    if (user) {
      fetchDocuments();
    }
  }, [user]);

  return {
    documents,
    loading,
    fetchDocuments,
    createDocument,
    deleteDocument
  };
}
