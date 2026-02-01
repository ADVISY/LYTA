import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';

export type DocClassification = 
  | 'identity_doc'
  | 'old_policy'
  | 'new_contract'
  | 'termination'
  | 'article_45'
  | 'other'
  | 'unknown';

export interface ScanBatchDocument {
  id: string;
  batch_id: string;
  scan_id: string | null;
  file_key: string;
  file_name: string;
  mime_type: string | null;
  document_classification: DocClassification | null;
  classification_confidence: number | null;
  classification_corrected: boolean;
  extracted_data: {
    description?: string;
    summary?: string;
    [key: string]: any;
  } | null;
  status: 'pending' | 'analyzing' | 'classified' | 'error';
  sort_order: number;
  created_at: string;
}

export interface ScanBatch {
  id: string;
  tenant_id: string | null;
  created_by: string | null;
  status: 'pending' | 'processing' | 'classified' | 'validated' | 'error';
  total_documents: number;
  documents_classified: number;
  consolidation_summary: {
    primary_holder_found?: boolean;
    old_policy_count?: number;
    new_contract_count?: number;
    termination_found?: boolean;
    recommended_action?: string;
  } | null;
  verified_partner_email: string | null;
  verified_partner_id: string | null;
  created_at: string;
  updated_at: string;
  documents?: ScanBatchDocument[];
}

export function useScanBatches() {
  const [batches, setBatches] = useState<ScanBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { tenantId } = useTenant();

  const fetchBatches = useCallback(async () => {
    if (!tenantId) {
      setBatches([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('scan_batches' as any)
        .select(`
          *,
          documents:scan_batch_documents(*)
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setBatches((data as any) || []);
    } catch (err: any) {
      console.error('Error fetching scan batches:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  const createBatch = async (
    files: File[],
    verifiedPartnerEmail?: string,
    verifiedPartnerId?: string
  ): Promise<string | null> => {
    if (!tenantId) {
      toast({
        title: "Erreur",
        description: "Tenant non trouvé",
        variant: "destructive"
      });
      return null;
    }

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Create batch record
      const { data: batch, error: batchError } = await supabase
        .from('scan_batches' as any)
        .insert({
          tenant_id: tenantId,
          created_by: user?.id,
          status: 'pending',
          total_documents: files.length,
          verified_partner_email: verifiedPartnerEmail,
          verified_partner_id: verifiedPartnerId,
        })
        .select()
        .single();

      if (batchError) throw batchError;

      const batchId = (batch as any).id;

      // Upload files and create document records
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const storagePath = `scan-batches/${batchId}/${Date.now()}-${i}.${fileExt}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(storagePath, file);

        if (uploadError) {
          console.error(`Failed to upload ${file.name}:`, uploadError);
          continue;
        }

        // Create document record
        const { error: docError } = await supabase
          .from('scan_batch_documents' as any)
          .insert({
            batch_id: batchId,
            file_key: storagePath,
            file_name: file.name,
            mime_type: file.type,
            status: 'pending',
            sort_order: i,
          });

        if (docError) {
          console.error(`Failed to create doc record for ${file.name}:`, docError);
        }
      }

      toast({
        title: "Dossier créé",
        description: `${files.length} documents prêts pour classification`,
      });

      await fetchBatches();
      return batchId;
    } catch (err: any) {
      console.error('Error creating batch:', err);
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive"
      });
      return null;
    }
  };

  const classifyBatch = async (batchId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('classify-batch-documents', {
        body: { batchId, tenantId }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Classification failed');

      toast({
        title: "Classification terminée",
        description: `${data.documentsClassified}/${data.documentsProcessed} documents classifiés`,
      });

      await fetchBatches();
      return true;
    } catch (err: any) {
      console.error('Error classifying batch:', err);
      toast({
        title: "Erreur de classification",
        description: err.message,
        variant: "destructive"
      });
      return false;
    }
  };

  const updateDocumentClassification = async (
    docId: string,
    classification: DocClassification
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('scan_batch_documents' as any)
        .update({
          document_classification: classification,
          classification_corrected: true,
        })
        .eq('id', docId);

      if (error) throw error;

      toast({
        title: "Classification modifiée",
        description: "Le document a été reclassifié manuellement",
      });

      await fetchBatches();
      return true;
    } catch (err: any) {
      console.error('Error updating classification:', err);
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive"
      });
      return false;
    }
  };

  const deleteBatch = async (batchId: string): Promise<boolean> => {
    try {
      // Get documents to delete from storage
      const { data: docs } = await supabase
        .from('scan_batch_documents' as any)
        .select('file_key')
        .eq('batch_id', batchId);

      if (docs && docs.length > 0) {
        const filePaths = docs.map((d: any) => d.file_key);
        await supabase.storage.from('documents').remove(filePaths);
      }

      // Delete batch (cascade deletes documents)
      const { error } = await supabase
        .from('scan_batches' as any)
        .delete()
        .eq('id', batchId);

      if (error) throw error;

      toast({
        title: "Dossier supprimé",
      });

      await fetchBatches();
      return true;
    } catch (err: any) {
      console.error('Error deleting batch:', err);
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive"
      });
      return false;
    }
  };

  // Mapping classification -> document name
  const getDocumentName = (
    classification: DocClassification | null,
    originalName: string,
    index: number
  ): string => {
    const baseName: Record<DocClassification, string> = {
      identity_doc: 'Pièce d\'identité',
      old_policy: 'Ancienne police',
      new_contract: 'Nouveau contrat',
      termination: 'Lettre de résiliation',
      article_45: 'Art. 45 - Libre passage',
      other: 'Document annexe',
      unknown: 'Document',
    };
    
    const ext = originalName.split('.').pop()?.toLowerCase() || 'pdf';
    const name = baseName[classification || 'unknown'];
    
    // Add index if multiple docs of same type
    return `${name}${index > 0 ? ` (${index + 1})` : ''}.${ext}`;
  };

  const validateBatchAndImportDocuments = async (
    batchId: string,
    clientId: string
  ): Promise<boolean> => {
    try {
      // Get batch with documents
      const batch = batches.find(b => b.id === batchId);
      if (!batch || !batch.documents) {
        throw new Error("Dossier non trouvé");
      }

      const { data: { user } } = await supabase.auth.getUser();

      // Group documents by classification to handle naming
      const classificationCounts: Record<string, number> = {};
      
      // Import each document
      for (const doc of batch.documents) {
        const classification = doc.document_classification || 'unknown';
        
        // Track count for naming
        const count = classificationCounts[classification] || 0;
        classificationCounts[classification] = count + 1;
        
        // Generate smart name
        const smartName = getDocumentName(classification, doc.file_name, count);
        
        // Map classification to doc_kind for document table
        const docKindMap: Record<DocClassification, string> = {
          identity_doc: 'identity',
          old_policy: 'policy',
          new_contract: 'contract',
          termination: 'termination',
          article_45: 'article_45',
          other: 'other',
          unknown: 'other',
        };

        // Create document entry linked to client
        const { error: docError } = await supabase
          .from('documents')
          .insert({
            tenant_id: tenantId,
            owner_type: 'client',
            owner_id: clientId,
            file_key: doc.file_key,
            file_name: smartName,
            mime_type: doc.mime_type,
            doc_kind: docKindMap[classification],
            category: classification,
            created_by: user?.id,
            metadata: {
              original_name: doc.file_name,
              source_batch_id: batchId,
              classification,
              classification_confidence: doc.classification_confidence,
              extracted_data: doc.extracted_data,
            }
          });

        if (docError) {
          console.error(`Failed to import document ${doc.file_name}:`, docError);
        }

        // Link scan_batch_document to a document_scan if it exists
        if (doc.scan_id) {
          await supabase
            .from('document_scans')
            .update({ validated_at: new Date().toISOString(), validated_by: user?.id })
            .eq('id', doc.scan_id);
        }
      }

      // Mark batch as validated
      const { error: updateError } = await supabase
        .from('scan_batches' as any)
        .update({ status: 'validated' })
        .eq('id', batchId);

      if (updateError) throw updateError;

      toast({
        title: "Documents importés",
        description: `${batch.documents.length} documents ajoutés au dossier client`,
      });

      await fetchBatches();
      return true;
    } catch (err: any) {
      console.error('Error validating batch:', err);
      toast({
        title: "Erreur d'import",
        description: err.message,
        variant: "destructive"
      });
      return false;
    }
  };

  return {
    batches,
    loading,
    error,
    fetchBatches,
    createBatch,
    classifyBatch,
    updateDocumentClassification,
    deleteBatch,
    validateBatchAndImportDocuments,
  };
}
