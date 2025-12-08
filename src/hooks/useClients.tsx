import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export type Client = {
  id: string;
  user_id?: string | null;
  assigned_agent_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  zip_code?: string | null;
  birthdate?: string | null;
  is_company?: boolean | null;
  country?: string | null;
  status?: string | null;
  tags?: string[] | null;
  type_adresse?: string | null;
  civil_status?: string | null;
  permit_type?: string | null;
  nationality?: string | null;
  profession?: string | null;
  employer?: string | null;
  iban?: string | null;
  bank_name?: string | null;
  created_at: string;
  updated_at: string;
  external_ref?: string | null;
  // Collaborateur fields
  commission_rate?: number | null;
  commission_rate_lca?: number | null;
  commission_rate_vie?: number | null;
  fixed_salary?: number | null;
  bonus_rate?: number | null;
  contract_type?: string | null;
  work_percentage?: number | null;
  hire_date?: string | null;
  manager_id?: string | null;
  manager_commission_rate_lca?: number | null;
  manager_commission_rate_vie?: number | null;
  reserve_rate?: number | null;
  assigned_agent?: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    email: string;
  } | null;
};

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchClients = async (typeFilter?: string) => {
    try {
      setLoading(true);
      let query = supabase
        .from('clients' as any)
        .select('*');
      
      if (typeFilter) {
        query = query.eq('type_adresse', typeFilter);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch assigned agents info separately (since they're in the same table)
      const clientsData = (data as any) || [];
      const agentIds = [...new Set(clientsData.filter((c: any) => c.assigned_agent_id).map((c: any) => c.assigned_agent_id))];
      
      let agentsMap: Record<string, any> = {};
      if (agentIds.length > 0) {
        const { data: agentsData } = await supabase
          .from('clients' as any)
          .select('id, first_name, last_name, email')
          .in('id', agentIds);
        
        if (agentsData) {
          agentsMap = (agentsData as any[]).reduce((acc, agent) => {
            acc[agent.id] = agent;
            return acc;
          }, {} as Record<string, any>);
        }
      }

      // Map assigned agents to clients
      const clientsWithAgents = clientsData.map((client: any) => ({
        ...client,
        assigned_agent: client.assigned_agent_id ? agentsMap[client.assigned_agent_id] || null : null
      }));

      setClients(clientsWithAgents);
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

  const createClient = async (clientData: any) => {
    try {
      const { data, error } = await supabase
        .from('clients' as any)
        .insert([clientData])
        .select('*')
        .single();

      if (error) throw error;

      toast({
        title: "Client créé",
        description: "Le client a été créé avec succès"
      });

      await fetchClients();
      return { data, error: null };
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
      return { data: null, error };
    }
  };

  const updateClient = async (id: string, updates: any) => {
    try {
      const { error } = await supabase
        .from('clients' as any)
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Client mis à jour",
        description: "Les modifications ont été enregistrées"
      });

      await fetchClients();
      return { error: null };
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
      return { error };
    }
  };

  const deleteClient = async (id: string) => {
    try {
      const { error } = await supabase
        .from('clients' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Client supprimé",
        description: "Le client a été supprimé avec succès"
      });

      await fetchClients();
      return { error: null };
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
      return { error };
    }
  };

  const getClientById = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('clients' as any)
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return { data, error: null };
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
      return { data: null, error };
    }
  };

  useEffect(() => {
    if (user) {
      fetchClients();
    }
  }, [user]);

  return {
    clients,
    loading,
    fetchClients,
    createClient,
    updateClient,
    deleteClient,
    getClientById
  };
}
