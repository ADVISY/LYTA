import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useUserTenant } from "./useUserTenant";
import { useToast } from "./use-toast";

export interface QRInvoice {
  id: string;
  tenant_id: string;
  invoice_number: string;
  client_id: string | null;
  client_name: string;
  client_address: string | null;
  client_postal_code: string | null;
  client_city: string | null;
  client_country: string;
  client_email: string | null;
  service_type: string;
  service_description: string | null;
  amount_ht: number;
  vat_rate: number;
  vat_amount: number;
  amount_ttc: number;
  is_vat_included: boolean;
  invoice_date: string;
  due_date: string;
  location: string | null;
  object: string | null;
  notes: string | null;
  status: 'draft' | 'generated' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  pdf_path: string | null;
  pdf_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  generated_at: string | null;
  sent_at: string | null;
  paid_at: string | null;
  // Joined fields
  client?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    email: string | null;
  };
}

export interface CreateInvoiceData {
  client_id?: string | null;
  client_name: string;
  client_address?: string;
  client_postal_code?: string;
  client_city?: string;
  client_country?: string;
  client_email?: string;
  service_type: string;
  service_description?: string;
  amount_ht: number;
  vat_rate?: number;
  vat_amount?: number;
  amount_ttc: number;
  is_vat_included?: boolean;
  invoice_date?: string;
  due_date: string;
  location?: string;
  object?: string;
  notes?: string;
}

export function useQRInvoices() {
  const [invoices, setInvoices] = useState<QRInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { tenantId } = useUserTenant();
  const { toast } = useToast();

  const fetchInvoices = useCallback(async () => {
    if (!user || !tenantId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('qr_invoices')
        .select(`
          *,
          client:clients(id, first_name, last_name, company_name, email)
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices(data as QRInvoice[]);
    } catch (error: any) {
      console.error('Error fetching invoices:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les factures"
      });
    } finally {
      setLoading(false);
    }
  }, [user, tenantId, toast]);

  const getNextInvoiceNumber = useCallback(async (): Promise<string | null> => {
    if (!tenantId) return null;
    
    try {
      const { data, error } = await supabase.rpc('get_next_invoice_number', {
        p_tenant_id: tenantId
      });
      
      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error getting invoice number:', error);
      return null;
    }
  }, [tenantId]);

  const createInvoice = useCallback(async (invoiceData: CreateInvoiceData): Promise<QRInvoice | null> => {
    if (!user || !tenantId) return null;
    
    try {
      const invoiceNumber = await getNextInvoiceNumber();
      if (!invoiceNumber) throw new Error('Could not generate invoice number');

      const { data, error } = await supabase
        .from('qr_invoices')
        .insert({
          tenant_id: tenantId,
          invoice_number: invoiceNumber,
          created_by: user.id,
          ...invoiceData
        })
        .select()
        .single();

      if (error) throw error;

      // Log the action
      await supabase.from('qr_invoice_logs').insert({
        invoice_id: data.id,
        action: 'created',
        performed_by: user.id,
        details: { invoice_number: invoiceNumber }
      });

      await fetchInvoices();
      return data as QRInvoice;
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de créer la facture"
      });
      return null;
    }
  }, [user, tenantId, getNextInvoiceNumber, fetchInvoices, toast]);

  const updateInvoice = useCallback(async (id: string, updates: Partial<QRInvoice>): Promise<boolean> => {
    if (!user) return false;
    
    try {
      const { error } = await supabase
        .from('qr_invoices')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      // Log the action
      await supabase.from('qr_invoice_logs').insert({
        invoice_id: id,
        action: 'updated',
        performed_by: user.id,
        details: { updated_fields: Object.keys(updates) }
      });

      await fetchInvoices();
      return true;
    } catch (error: any) {
      console.error('Error updating invoice:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de mettre à jour la facture"
      });
      return false;
    }
  }, [user, fetchInvoices, toast]);

  const updateInvoiceStatus = useCallback(async (
    id: string, 
    status: QRInvoice['status']
  ): Promise<boolean> => {
    const updates: Partial<QRInvoice> = { status };
    
    if (status === 'generated') {
      updates.generated_at = new Date().toISOString();
    } else if (status === 'sent') {
      updates.sent_at = new Date().toISOString();
    } else if (status === 'paid') {
      updates.paid_at = new Date().toISOString();
    }
    
    return updateInvoice(id, updates);
  }, [updateInvoice]);

  const deleteInvoice = useCallback(async (id: string): Promise<boolean> => {
    if (!user) return false;
    
    try {
      const { error } = await supabase
        .from('qr_invoices')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchInvoices();
      return true;
    } catch (error: any) {
      console.error('Error deleting invoice:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de supprimer la facture"
      });
      return false;
    }
  }, [user, fetchInvoices, toast]);

  useEffect(() => {
    if (user && tenantId) {
      fetchInvoices();
    }
  }, [user, tenantId, fetchInvoices]);

  return {
    invoices,
    loading,
    fetchInvoices,
    createInvoice,
    updateInvoice,
    updateInvoiceStatus,
    deleteInvoice,
    getNextInvoiceNumber
  };
}