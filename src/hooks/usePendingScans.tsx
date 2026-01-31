import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserTenant } from './useUserTenant';

export interface WorkflowAction {
  action_type: string;
  priority: 'high' | 'normal' | 'low';
  description: string;
  deadline?: string;
  details?: Record<string, any>;
}

export interface DocumentDetected {
  file_name: string;
  doc_type: string;
  doc_type_confidence: number;
  description: string;
}

export interface ProductDetected {
  product_name: string;
  product_category: string;
  company: string;
  premium_monthly?: number;
  premium_yearly?: number;
  franchise?: number;
  start_date?: string;
  end_date?: string;
  policy_number?: string;
  notes?: string;
}

export interface FamilyMemberDetected {
  last_name: string;
  first_name: string;
  birthdate?: string;
  relationship?: string;
  gender?: string;
  has_own_policy?: boolean;
}

export interface EngagementAnalysis {
  old_policy_end_date?: string;
  new_policy_start_date?: string;
  termination_deadline?: string;
  is_termination_on_time?: boolean;
  days_until_deadline?: number;
  warnings?: string[];
}

export interface PendingScan {
  id: string;
  created_at: string;
  source_form_type: string | null;
  original_file_name: string;
  original_file_key: string;
  detected_doc_type: string | null;
  doc_type_confidence: number | null;
  quality_score: number | null;
  overall_confidence: number | null;
  status: string;
  verified_partner_email: string | null;
  error_message: string | null;
  fields: ScanField[];
  // Enhanced back-office data from AI analysis
  dossier_summary?: string;
  documents_detected?: DocumentDetected[];
  // Multi-product support
  products_detected?: ProductDetected[];
  old_products_detected?: ProductDetected[];
  new_products_detected?: ProductDetected[];
  // Family members support
  family_members_detected?: FamilyMemberDetected[];
  primary_holder?: {
    last_name: string;
    first_name: string;
    birthdate?: string;
  };
  has_old_policy?: boolean;
  has_new_policy?: boolean;
  has_termination?: boolean;
  has_identity_doc?: boolean;
  has_multiple_products?: boolean;
  has_family_members?: boolean;
  engagement_analysis?: EngagementAnalysis;
  workflow_actions?: WorkflowAction[];
  inconsistencies?: string[];
  missing_documents?: string[];
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
      let auditData: any[] = [];
      
      if (scanIds.length > 0) {
        // Fetch fields and audit logs in parallel
        const [fieldsResult, auditResult] = await Promise.all([
          supabase
            .from('document_scan_results')
            .select('*')
            .in('scan_id', scanIds),
          supabase
            .from('document_scan_audit')
            .select('*')
            .in('scan_id', scanIds)
            .eq('action', 'extracted')
            .order('performed_at', { ascending: false })
        ]);

        if (fieldsResult.error) throw fieldsResult.error;
        fieldsData = fieldsResult.data || [];
        auditData = auditResult.data || [];
      }

      // Map fields to scans with enriched audit data
      const scansWithFields: PendingScan[] = (scanData || []).map(scan => {
        // Find the audit log for this scan to get workflow info
        const scanAudit = auditData.find(a => a.scan_id === scan.id);
        const aiSnapshot = scanAudit?.ai_response_snapshot as any || {};

        return {
          id: scan.id,
          created_at: scan.created_at,
          source_form_type: scan.source_form_type,
          original_file_name: scan.original_file_name,
          original_file_key: scan.original_file_key,
          detected_doc_type: scan.detected_doc_type,
          doc_type_confidence: scan.doc_type_confidence,
          quality_score: scan.quality_score,
          overall_confidence: scan.overall_confidence,
          status: scan.status,
          verified_partner_email: scan.verified_partner_email,
          error_message: scan.error_message,
          // Enhanced back-office data from AI analysis
          dossier_summary: aiSnapshot.dossier_summary,
          documents_detected: aiSnapshot.documents_detected,
          // Multi-product support
          products_detected: aiSnapshot.products_detected,
          old_products_detected: aiSnapshot.old_products_detected,
          new_products_detected: aiSnapshot.new_products_detected,
          // Family members support
          family_members_detected: aiSnapshot.family_members_detected,
          primary_holder: aiSnapshot.primary_holder,
          has_old_policy: aiSnapshot.has_old_policy,
          has_new_policy: aiSnapshot.has_new_policy,
          has_termination: aiSnapshot.has_termination,
          has_identity_doc: aiSnapshot.has_identity_doc,
          has_multiple_products: aiSnapshot.has_multiple_products,
          has_family_members: aiSnapshot.has_family_members,
          engagement_analysis: aiSnapshot.engagement_analysis,
          workflow_actions: aiSnapshot.workflow_actions,
          inconsistencies: aiSnapshot.inconsistencies,
          missing_documents: aiSnapshot.missing_documents,
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
        };
      });

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
