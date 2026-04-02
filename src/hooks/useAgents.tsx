import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";
import { useUserTenant } from "./useUserTenant";
import { usePaginatedQuery } from "./usePaginatedQuery";

export interface Agent {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  profession: string | null;
  manager_id: string | null;
}

export function useAgents() {
  const { tenantId } = useUserTenant();

  const {
    data: agents,
    page,
    totalCount,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    isLoading: loading,
    refetch,
  } = usePaginatedQuery<Agent>({
    queryKey: ['agents', tenantId ?? ''],
    buildQuery: (client) =>
      client
        .from('clients')
        .select('id, first_name, last_name, email, profession, manager_id')
        .eq('type_adresse', 'collaborateur')
        .eq('tenant_id', tenantId ?? '')
        .order('first_name', { ascending: true }),
    pageSize: 50,
    enabled: !!tenantId,
  });

  // Helper to get manager for an agent
  const getManagerForAgent = (agentId: string): Agent | null => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent || !agent.manager_id) return null;
    return agents.find(a => a.id === agent.manager_id) || null;
  };

  return {
    agents,
    loading,
    page,
    totalCount,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    fetchAgents: refetch,
    getManagerForAgent,
  };
}
