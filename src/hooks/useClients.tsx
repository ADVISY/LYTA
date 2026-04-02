import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useUserTenant } from '@/hooks/useUserTenant';
import { translateError } from '@/lib/errorTranslations';
import { usePaginatedQuery } from './usePaginatedQuery';
import type { Tables } from '@/integrations/supabase/types';

type ClientRow = Tables<'clients'>;

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
  gender?: string | null;
  photo_url?: string | null;
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

export function useClients(typeFilter?: string) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { tenantId, loading: tenantLoading } = useUserTenant();

  const { data: rawClients, page, totalCount, totalPages, goToPage, nextPage, prevPage, isLoading: loading, isError, refetch } = usePaginatedQuery<Client>({
    queryKey: ['clients', tenantId ?? '', typeFilter ?? ''],
    buildQuery: (client) => {
      let query = client
        .from('clients')
        .select('*')
        .eq('tenant_id', tenantId ?? '')
        .order('created_at', { ascending: false });

      if (typeFilter) {
        query = query.eq('type_adresse', typeFilter);
      }

      return query;
    },
    pageSize: 50,
    enabled: !tenantLoading && !!tenantId && !!user,
  });

  // Clients are returned as-is (assigned_agent enrichment done inline below)
  const clients = rawClients;

  const createClient = async (clientData: any) => {
    try {
      if (!tenantId) {
        throw new Error("Aucun cabinet assigné à cet utilisateur");
      }

      const { data, error } = await supabase
        .from('clients')
        .insert([{ ...clientData, tenant_id: tenantId }])
        .select('*')
        .single();

      if (error) throw error;

      toast({
        title: "Client créé",
        description: "Le client a été créé avec succès"
      });

      refetch();
      return { data, error: null };
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: translateError(error.message),
        variant: "destructive"
      });
      return { data: null, error };
    }
  };

  const updateClient = async (id: string, updates: any) => {
    try {
      const { error } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Client mis à jour",
        description: "Les modifications ont été enregistrées"
      });

      refetch();
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
        .from('clients')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Client supprimé",
        description: "Le client a été supprimé avec succès"
      });

      refetch();
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
        .from('clients')
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

  return {
    clients,
    loading,
    page,
    totalCount,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    fetchClients: refetch,
    createClient,
    updateClient,
    deleteClient,
    getClientById
  };
}
