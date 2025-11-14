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
  created_at: string;
  updated_at: string;
  external_ref?: string | null;
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
        .select(`
          *,
          assigned_agent:profiles!clients_assigned_agent_id_fkey(id, first_name, last_name, email)
        `);
      
      if (typeFilter) {
        query = query.eq('type_adresse', typeFilter);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      setClients((data as any) || []);
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
        .select(`
          *,
          assigned_agent:profiles!clients_assigned_agent_id_fkey(id, first_name, last_name, email)
        `)
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
        .select(`
          *,
          assigned_agent:profiles!clients_assigned_agent_id_fkey(id, first_name, last_name, email)
        `)
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
