import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export type Client = {
  id: string;
  user_id?: string | null;
  company_name?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  birthdate?: string | null;
  is_company?: boolean | null;
  country?: string | null;
  created_at: string;
  updated_at: string;
  external_ref?: string | null;
  profiles?: {
    first_name?: string;
    last_name?: string;
    email: string;
  } | null;
  profile?: {
    first_name?: string;
    last_name?: string;
    email: string;
  } | null;
};

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchClients = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('clients' as any)
        .select(`
          *,
          profile:profiles!user_id (
            first_name,
            last_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

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
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Client créé",
        description: "Le client a été créé avec succès"
      });

      await fetchClients();
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
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
      throw error;
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
      fetchClients();
    }
  }, [user]);

  return {
    clients,
    loading,
    fetchClients,
    createClient,
    updateClient,
    deleteClient
  };
}
