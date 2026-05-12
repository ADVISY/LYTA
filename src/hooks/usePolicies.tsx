import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useUserTenant } from '@/hooks/useUserTenant';
import { translateError } from '@/lib/errorTranslations';
import { ClientNotifications } from '@/lib/clientNotifications';
import { savePolicy } from '@/lib/policiesApi';
import { usePaginatedQuery } from './usePaginatedQuery';
import { useQueryClient } from '@tanstack/react-query';

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
  const queryClient = useQueryClient();

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
            tenant_branch_id,
            company:insurance_companies!insurance_products_company_id_fkey (
              name,
              logo_url
            ),
            tenant_branch:tenant_branches!insurance_products_tenant_branch_id_fkey (
              id,
              code,
              name,
              icon,
              color
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
      // Use .select() to detect silent RLS blocks: a DELETE with no matching
      // permitted row returns 0 rows WITHOUT raising an error.
      const { data, error } = await supabase
        .from('policies')
        .delete()
        .eq('id', id)
        .select('id');

      if (error) {
        // eslint-disable-next-line no-console
        console.error('[deletePolicy] postgres error:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        // Silent block — usually RLS denying the operation
        // eslint-disable-next-line no-console
        console.error('[deletePolicy] no rows deleted (likely RLS). policyId=', id);
        throw new Error('RLS_SILENT_BLOCK');
      }

      toast({
        title: 'Police supprimée',
        description: "La police d'assurance a été supprimée avec succès",
      });

      // Optimistic local removal: strip the deleted row from any cached page
      // BEFORE refetching. This guarantees the UI updates immediately even
      // if the server takes a moment to propagate.
      queryClient.setQueriesData<Policy[]>(
        { queryKey: ['policies'] },
        (old) => (Array.isArray(old) ? old.filter((p) => p.id !== id) : old),
      );

      // Hard refetch on top — replaces optimistic state with real server data.
      await queryClient.invalidateQueries({ queryKey: ['policies'] });
      await refetch();
    } catch (error) {
      const raw = getErrorMessage(error, '');
      let userMsg = translateError(raw) || raw;
      if (raw === 'RLS_SILENT_BLOCK') {
        userMsg = "La suppression a été bloquée par les permissions de sécurité (RLS). Ton compte n'a pas les droits pour supprimer ce contrat. Contacte un administrateur ou vérifie que tu as bien le rôle 'admin' sur ce cabinet.";
      } else if (/foreign key|violates|constraint/i.test(raw)) {
        // Try to extract the constraint name to help diagnose
        const match = raw.match(/constraint "([^"]+)"/i);
        const constraintName = match ? match[1] : 'inconnue';
        userMsg = `Ce contrat est lié à d'autres éléments qui empêchent sa suppression (contrainte: ${constraintName}). Cause probable: commission(s) non encore réglée(s), décompte, ou suivi. Passe plutôt le statut à 'résilié' ou contacte le support.`;
      } else if (/row-level security|permission denied|rls/i.test(raw)) {
        userMsg = "Tu n'as pas les droits pour supprimer ce contrat (RLS). Vérifie ton rôle.";
      }
      toast({
        title: 'Erreur de suppression',
        description: userMsg || 'Impossible de supprimer le contrat',
        variant: 'destructive',
      });
      // eslint-disable-next-line no-console
      console.error('[deletePolicy] failed:', error);
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
