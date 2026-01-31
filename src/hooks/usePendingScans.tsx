import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserTenant } from './useUserTenant';

export interface PendingScan {
  id: string;
  created_at: string;
  source_form_type: string | null;
  original_file_name: string;
  detected_doc_type: string | null;
  doc_type_confidence: number | null;
  quality_score: number | null;
  overall_confidence: number | null;
  status: string;
  verified_partner_email: string | null;
  error_message: string | null;
  fields: ScanField[];
}

export interface ScanField {
  id: string;
  field_category: string;
  field_name: string;
  extracted_value: string | null;
  confidence: 'high' | 'medium' | 'low';
  confidence_score: number | null;
  extraction_notes: string | null;
  validated_value: string | null;
}

export function usePendingScans() {
  const { tenantId } = useUserTenant();
  const [scans, setScans] = useState<PendingScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScans = async () => {
    if (!tenantId) {
      setScans([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Fetch pending and completed scans that haven't been validated yet
      const { data: scanData, error: scanError } = await supabase
        .from('document_scans')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('status', ['completed', 'pending', 'processing'])
        .is('validated_at', null)
        .order('created_at', { ascending: false });

      if (scanError) throw scanError;

      // Fetch fields for all scans
      const scanIds = (scanData || []).map(s => s.id);
      
      let fieldsData: any[] = [];
      if (scanIds.length > 0) {
        const { data: fields, error: fieldsError } = await supabase
          .from('document_scan_results')
          .select('*')
          .in('scan_id', scanIds);

        if (fieldsError) throw fieldsError;
        fieldsData = fields || [];
      }

      // Map fields to scans
      const scansWithFields: PendingScan[] = (scanData || []).map(scan => ({
        id: scan.id,
        created_at: scan.created_at,
        source_form_type: scan.source_form_type,
        original_file_name: scan.original_file_name,
        detected_doc_type: scan.detected_doc_type,
        doc_type_confidence: scan.doc_type_confidence,
        quality_score: scan.quality_score,
        overall_confidence: scan.overall_confidence,
        status: scan.status,
        verified_partner_email: scan.verified_partner_email,
        error_message: scan.error_message,
        fields: fieldsData
          .filter(f => f.scan_id === scan.id)
          .map(f => ({
            id: f.id,
            field_category: f.field_category,
            field_name: f.field_name,
            extracted_value: f.extracted_value,
            confidence: f.confidence as 'high' | 'medium' | 'low',
            confidence_score: f.confidence_score,
            extraction_notes: f.extraction_notes,
            validated_value: f.validated_value,
          })),
      }));

      setScans(scansWithFields);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching pending scans:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScans();
  }, [tenantId]);

  const markAsValidated = async (scanId: string, validatedBy: string) => {
    const { error } = await supabase
      .from('document_scans')
      .update({
        validated_at: new Date().toISOString(),
        validated_by: validatedBy,
        status: 'validated',
      })
      .eq('id', scanId);

    if (!error) {
      // Remove from local state
      setScans(prev => prev.filter(s => s.id !== scanId));
    }

    return { error };
  };

  const rejectScan = async (scanId: string) => {
    const { error } = await supabase
      .from('document_scans')
      .update({
        status: 'rejected',
      })
      .eq('id', scanId);

    if (!error) {
      setScans(prev => prev.filter(s => s.id !== scanId));
    }

    return { error };
  };

  return {
    scans,
    loading,
    error,
    refresh: fetchScans,
    markAsValidated,
    rejectScan,
  };
}
