import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useUserTenant } from '@/hooks/useUserTenant';
import { translateError } from '@/lib/errorTranslations';
import { ClientNotifications } from '@/lib/clientNotifications';

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
  company_name?: string | null;
  product_type?: string | null;
  products_data?: Array<{
    productId: string;
    name: string;
    category: string;
    premium: number;
    deductible?: number | null;
    durationYears?: number | null;
  }> | null;
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
  const { tenantId } = useUserTenant();

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      
      // Must have tenantId to fetch policies
      if (!tenantId) {
        setPolicies([]);
        setLoading(false);
        return;
      }
      
      const { data, error } = await supabase
        .from('policies' as any)
        .select(`
          *,
          client:clients!policies_client_id_fkey (
            id,
            first_name,
            last_name,
            email,
            phone,
            company_name
          ),
          product:insurance_products!policies_product_id_fkey (
            id,
            name,
            category,
            company:insurance_companies!insurance_products_company_id_fkey (
              name,
              logo_url
            )
          ),
          partner:partners!policies_partner_id_fkey (
            id,
            code
          )
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPolicies((data as any) || []);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: translateError(error.message),
        variant: "destructive"
      });
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  };

  const createPolicy = async (policyData: any) => {
    try {
      if (!tenantId) {
        throw new Error("Aucun cabinet assigné à cet utilisateur");
      }

      // Get the current user's partner profile if they have one
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (currentUser) {
        const { data: partnerData } = await supabase
          .from('partners')
          .select('id')
          .eq('user_id', currentUser.id)
          .maybeSingle();
        
        // Add partner_id if the user has a partner profile
        if (partnerData) {
          policyData.partner_id = partnerData.id;
        }
      }

      const { data, error } = await supabase
        .from('policies')
        .insert([{ ...policyData, tenant_id: tenantId }])
        .select('id')
        .maybeSingle();

      if (error) throw error;

      // Notifier le client si le contrat est créé
      if (data?.id && policyData.client_id) {
        ClientNotifications.newContract(policyData.client_id, data.id, policyData.product_name);
      }

      toast({
        title: "Police créée",
        description: "La police d'assurance a été créée avec succès"
      });

      await fetchPolicies();
      return data as { id: string };
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: translateError(error.message),
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
    if (user && tenantId) {
      fetchPolicies();
    }
  }, [user, tenantId]);

  return {
    policies,
    loading,
    fetchPolicies,
    createPolicy,
    updatePolicy,
    deletePolicy
  };
}
