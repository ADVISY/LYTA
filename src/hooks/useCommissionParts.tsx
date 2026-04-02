import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePaginatedQuery } from './usePaginatedQuery';

export type CommissionPart = {
  id: string;
  commission_id: string;
  agent_id: string;
  rate: number;
  amount: number;
  created_at: string | null;
  agent?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  };
};

export function useCommissionParts(commissionId?: string) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const {
    data: parts,
    page,
    totalCount,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    isLoading: partsLoading,
    refetch,
  } = usePaginatedQuery<CommissionPart>({
    queryKey: ['commission_parts', commissionId ?? ''],
    buildQuery: (client) => {
      const q = client
        .from('commission_part_agent')
        .select(`
          *,
          agent:clients!agent_id (
            id,
            first_name,
            last_name,
            email
          )
        `)
        .order('created_at', { ascending: true });
      return commissionId ? q.eq('commission_id', commissionId) : q;
    },
    pageSize: 50,
    enabled: !!commissionId,
  });

  // On-demand fetch for a specific commission (used by legacy callers)
  const fetchCommissionParts = async (cId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('commission_part_agent')
        .select(`
          *,
          agent:clients!agent_id (
            id,
            first_name,
            last_name,
            email
          )
        `)
        .eq('commission_id', cId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Fetch all commission parts (for dashboard)
  const fetchAllParts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('commission_part_agent')
        .select(`
          *,
          agent:clients!agent_id (
            id,
            first_name,
            last_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error("Error fetching all parts:", error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Fetch all commission parts for a specific agent
  const fetchPartsForAgent = async (agentId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('commission_part_agent')
        .select(`
          *,
          agent:clients!agent_id (
            id,
            first_name,
            last_name,
            email
          )
        `)
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error("Error fetching parts for agent:", error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const addCommissionPart = async (data: {
    commission_id: string;
    agent_id: string;
    rate: number;
    amount: number;
  }) => {
    try {
      const { error } = await supabase
        .from('commission_part_agent')
        .insert([data]);

      if (error) throw error;

      toast({
        title: "Part ajoutée",
        description: "La part de commission a été ajoutée"
      });

      refetch();
      return true;
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
      return false;
    }
  };

  const updateCommissionPart = async (id: string, updates: {
    rate?: number;
    amount?: number;
  }) => {
    try {
      const { error } = await supabase
        .from('commission_part_agent')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Part mise à jour",
        description: "La part de commission a été modifiée"
      });

      refetch();
      return true;
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
      return false;
    }
  };

  const deleteCommissionPart = async (id: string) => {
    try {
      const { error } = await supabase
        .from('commission_part_agent')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Part supprimée",
        description: "La part de commission a été supprimée"
      });

      refetch();
      return true;
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
      return false;
    }
  };

  const addMultipleParts = async (parts: {
    commission_id: string;
    agent_id: string;
    rate: number;
    amount: number;
  }[]) => {
    try {
      if (parts.length === 0) return true;

      const { error } = await supabase
        .from('commission_part_agent')
        .insert(parts);

      if (error) throw error;
      refetch();
      return true;
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
      return false;
    }
  };

  return {
    parts,
    loading: loading || partsLoading,
    page,
    totalCount,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    fetchCommissionParts,
    fetchAllParts,
    fetchPartsForAgent,
    addCommissionPart,
    updateCommissionPart,
    deleteCommissionPart,
    addMultipleParts
  };
}

export function useAgentCommissionParts(agentId?: string) {
  const {
    data: parts,
    page,
    totalCount,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    isLoading: loading,
    refetch,
  } = usePaginatedQuery<CommissionPart>({
    queryKey: ['agent_commission_parts', agentId ?? ''],
    buildQuery: (client) =>
      client
        .from('commission_part_agent')
        .select(`
          *,
          agent:clients!agent_id (
            id,
            first_name,
            last_name,
            email
          )
        `)
        .eq('agent_id', agentId ?? '')
        .order('created_at', { ascending: false }),
    pageSize: 50,
    enabled: !!agentId,
  });

  return {
    parts,
    loading,
    page,
    totalCount,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    refetch,
  };
}
