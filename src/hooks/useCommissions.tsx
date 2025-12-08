import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type Commission = {
  id: string;
  policy_id: string;
  partner_id?: string | null;
  amount: number;
  status: string;
  type?: string | null;
  date?: string | null;
  total_amount?: number | null;
  period_month?: number | null;
  period_year?: number | null;
  paid_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  policy?: any;
};

export function useCommissions() {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchCommissions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('commissions')
        .select(`
          *,
          policy:policies!policy_id (
            id,
            policy_number,
            client_id,
            product:insurance_products!product_id (
              name,
              category
            ),
            client:clients!client_id (
              id,
              first_name,
              last_name,
              company_name
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCommissions((data as any) || []);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createCommission = async (commissionData: any) => {
    try {
      const { data, error } = await supabase
        .from('commissions')
        .insert([commissionData])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Commission créée",
        description: "La commission a été créée avec succès"
      });

      await fetchCommissions();
      return data;
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
      throw error;
    }
  };

  const updateCommission = async (id: string, updates: any) => {
    try {
      const { error } = await supabase
        .from('commissions')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Commission mise à jour",
        description: "Les modifications ont été enregistrées"
      });

      await fetchCommissions();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
      throw error;
    }
  };

  const markAsPaid = async (id: string) => {
    try {
      const { error } = await supabase
        .from('commissions')
        .update({ 
          status: 'paid',
          paid_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Commission marquée comme payée",
        description: "Le statut a été mis à jour"
      });

      await fetchCommissions();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
      throw error;
    }
  };

  const deleteCommission = async (id: string) => {
    try {
      const { error } = await supabase
        .from('commissions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Commission supprimée",
        description: "La commission a été supprimée avec succès"
      });

      await fetchCommissions();
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
    fetchCommissions();
  }, []);

  return {
    commissions,
    loading,
    fetchCommissions,
    createCommission,
    updateCommission,
    markAsPaid,
    deleteCommission
  };
}
