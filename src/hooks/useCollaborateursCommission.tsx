import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";
import { useUserTenant } from "@/hooks/useUserTenant";
import { usePaginatedQuery } from "./usePaginatedQuery";

export interface Collaborateur {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  profession: string | null;
  commission_rate: number | null;
  commission_rate_lca: number | null;
  commission_rate_vie: number | null;
  manager_id: string | null;
  manager_commission_rate_lca: number | null;
  manager_commission_rate_vie: number | null;
  reserve_rate: number | null;
  fixed_salary: number | null;
  bonus_rate: number | null;
  work_percentage: number | null;
  contract_type: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  canton: string | null;
  civil_status: string | null;
  nationality: string | null;
  permit_type: string | null;
}

export function useCollaborateursCommission() {
  const { tenantId } = useUserTenant();

  const {
    data: collaborateurs,
    page,
    totalCount,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    isLoading: loading,
    refetch,
  } = usePaginatedQuery<Collaborateur>({
    queryKey: ['collaborateurs_commission', tenantId ?? ''],
    buildQuery: (client) =>
      client
        .from('clients')
        .select('id, first_name, last_name, email, profession, commission_rate, commission_rate_lca, commission_rate_vie, manager_id, manager_commission_rate_lca, manager_commission_rate_vie, reserve_rate, fixed_salary, bonus_rate, work_percentage, contract_type, address, city, postal_code, canton, civil_status, nationality, permit_type')
        .eq('type_adresse', 'collaborateur')
        .eq('tenant_id', tenantId ?? '')
        .order('first_name', { ascending: true }),
    pageSize: 50,
    enabled: !!tenantId,
  });

  // Helper to get manager for a collaborateur
  const getManagerForCollaborateur = (collaborateurId: string): Collaborateur | null => {
    const collab = collaborateurs.find(c => c.id === collaborateurId);
    if (!collab || !collab.manager_id) return null;
    return collaborateurs.find(c => c.id === collab.manager_id) || null;
  };

  return {
    collaborateurs,
    loading,
    page,
    totalCount,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    fetchCollaborateurs: refetch,
    getManagerForCollaborateur,
  };
}
