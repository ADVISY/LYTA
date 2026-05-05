import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useUserTenant } from '@/hooks/useUserTenant';
import { translateError } from '@/lib/errorTranslations';
import { ClientNotifications } from '@/lib/clientNotifications';
import { savePolicy } from '@/lib/policiesApi';
import { usePaginatedQuery } from './usePaginatedQuery';

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

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export function usePolicies() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { tenantId, loading: tenantLoading } = useUserTenant();

  const {
    data: policies,
    page,
    totalCount,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    isLoading: loading,
    isError,
    refetch,
  } = usePaginatedQuery<Policy>({
    queryKey: ['policies', tenantId ?? ''],
    buildQuery: (client) =>
      client
        .from('policies')
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
        .eq('tenant_id', tenantId ?? '')
        .order('created_at', { ascending: false }),
    pageSize: 50,
    enabled: !tenantLoading && !!tenantId && !!user,
  });

  const createPolicy = async (policyData: any) => {
    if (!tenantId) {
      throw new Error('Aucun cabinet assigné à cet utilisateur');
    }

    const data = await savePolicy({
      action: 'create',
      tenantId,
      policyData,
    });

    if (data.id && policyData.client_id) {
      ClientNotifications.newContract(policyData.client_id, data.id, policyData.product_name);
    }

    refetch();
    return data as { id: string };
  };

  const updatePolicy = async (id: string, updates: any) => {
    if (!tenantId) {
      throw new Error('Aucun cabinet assigné à cet utilisateur');
    }

    await savePolicy({
      action: 'update',
      tenantId,
      policyId: id,
      policyData: updates,
    });

    refetch();
  };

  const deletePolicy = async (id: string) => {
    try {
      const { error } = await supabase
        .from('policies')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Police supprimée',
        description: "La police d'assurance a été supprimée avec succès",
      });

      refetch();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: translateError(getErrorMessage(error, 'Impossible de supprimer le contrat')),
        variant: 'destructive',
      });
      throw error;
    }
  };

  return {
    policies,
    loading,
    isError,
    page,
    totalCount,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    fetchPolicies: refetch,
    createPolicy,
    updatePolicy,
    deletePolicy,
  };
}
