import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export type Policy = {
  id: string;
  client_id: string;
  partner_id?: string | null;
  product_id: string;
  policy_number?: string | null;
  status: string;
  start_date: string;
  end_date?: string | null;
  premium_monthly?: number | null;
  premium_yearly?: number | null;
  deductible?: number | null;
  currency: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  client?: any;
  product?: any;
  partner?: any;
};

export function usePolicies() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      console.log('Fetching policies...');
      const { data, error } = await supabase
        .from('policies' as any)
        .select(`
          *,
          client:clients!client_id (
            id,
            company_name,
            phone,
            profile:profiles!user_id (
              first_name,
              last_name,
              email
            )
          ),
          product:insurance_products!product_id (
            id,
            name,
            category,
            company:insurance_companies!company_id (
              name,
              logo_url
            )
          ),
          partner:partners!partner_id (
            id,
            code,
            phone
          )
        `)
        .order('created_at', { ascending: false });

      console.log('Policies fetched:', { data, error });
      if (error) throw error;
      setPolicies((data as any) || []);
    } catch (error: any) {
      console.error('Error fetching policies:', error);
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  };

  const createPolicy = async (policyData: any) => {
    try {
      // Get the current user's partner profile if they have one
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (currentUser) {
        const { data: partnerData } = await supabase
          .from('partners')
          .select('id')
          .eq('user_id', currentUser.id)
          .single();
        
        // Add partner_id if the user has a partner profile
        if (partnerData) {
          policyData.partner_id = partnerData.id;
        }
      }

      const { data, error } = await supabase
        .from('policies' as any)
        .insert([policyData])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Police créée",
        description: "La police d'assurance a été créée avec succès"
      });

      await fetchPolicies();
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

  const updatePolicy = async (id: string, updates: any) => {
    try {
      const { error } = await supabase
        .from('policies' as any)
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Police mise à jour",
        description: "Les modifications ont été enregistrées"
      });

      await fetchPolicies();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
      throw error;
    }
  };

  const deletePolicy = async (id: string) => {
    try {
      const { error } = await supabase
        .from('policies' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Police supprimée",
        description: "La police a été supprimée avec succès"
      });

      await fetchPolicies();
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
      fetchPolicies();
    }
  }, [user]);

  return {
    policies,
    loading,
    fetchPolicies,
    createPolicy,
    updatePolicy,
    deletePolicy
  };
}
