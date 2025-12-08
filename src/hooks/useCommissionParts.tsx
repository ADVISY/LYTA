import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

export function useCommissionParts() {
  const [parts, setParts] = useState<CommissionPart[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchCommissionParts = async (commissionId: string) => {
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
        .eq('commission_id', commissionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setParts((data as any) || []);
      return (data as any) || [];
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
      return (data as any) || [];
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
    loading,
    fetchCommissionParts,
    fetchPartsForAgent,
    addCommissionPart,
    updateCommissionPart,
    deleteCommissionPart,
    addMultipleParts
  };
}
