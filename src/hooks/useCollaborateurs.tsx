import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";
import { useUserTenant } from "@/hooks/useUserTenant";
import { translateError } from "@/lib/errorTranslations";
import { usePaginatedQuery } from "./usePaginatedQuery";
import { invokeSupabaseFunction } from "@/lib/edgeFunctions";

export interface Collaborateur {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  mobile: string | null;
  status: string | null;
  profession: string | null;
  photo_url: string | null;
  created_at: string;
  // Manager
  manager_id: string | null;
  manager?: Collaborateur | null;
  // Financial fields
  commission_rate: number | null;
  commission_rate_lca: number | null;
  commission_rate_vie: number | null;
  fixed_salary: number | null;
  bonus_rate: number | null;
  contract_type: string | null;
  work_percentage: number | null;
  hire_date: string | null;
  // Manager commission rates (what the manager earns from team)
  manager_commission_rate_lca: number | null;
  manager_commission_rate_vie: number | null;
  // Reserve account
  reserve_rate: number | null;
}

export type CollaborateurFormData = {
  first_name: string;
  last_name: string;
  email: string;
  mobile?: string;
  profession?: string;
  status?: string;
  manager_id?: string | null;
  // Financial fields
  commission_rate?: number;
  commission_rate_lca?: number;
  commission_rate_vie?: number;
  fixed_salary?: number;
  bonus_rate?: number;
  contract_type?: string;
  work_percentage?: number;
  hire_date?: string;
  // Manager commission rates
  manager_commission_rate_lca?: number;
  manager_commission_rate_vie?: number;
  // Reserve account
  reserve_rate?: number;
};

export function useCollaborateurs() {
  const { toast } = useToast();
  const { tenantId } = useUserTenant();

  const {
    data: collaborateursRaw,
    page,
    totalCount,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    isLoading: loading,
    refetch,
  } = usePaginatedQuery<Collaborateur>({
    queryKey: ['collaborateurs', tenantId ?? ''],
    buildQuery: (client) =>
      client
        .from('clients')
        .select('id, first_name, last_name, email, mobile, status, profession, photo_url, created_at, commission_rate, commission_rate_lca, commission_rate_vie, fixed_salary, bonus_rate, contract_type, work_percentage, hire_date, manager_id, manager_commission_rate_lca, manager_commission_rate_vie, reserve_rate')
        .eq('type_adresse', 'collaborateur')
        .eq('tenant_id', tenantId ?? '')
        .order('first_name', { ascending: true }),
    pageSize: 50,
    enabled: !!tenantId,
  });

  // Resolve manager references within current page data
  const collaborateurs = collaborateursRaw.map(collab => {
    const manager = collab.manager_id
      ? collaborateursRaw.find(c => c.id === collab.manager_id) || null
      : null;
    return { ...collab, manager };
  });

  const fetchCollaborateurs = useCallback(() => {
    refetch();
  }, [refetch]);

  const addCollaborateur = async (data: CollaborateurFormData) => {
    try {
      if (!tenantId) {
        throw new Error("Aucun cabinet assigné à cet utilisateur");
      }

      const { data: newCollaborateur, error } = await supabase
        .from('clients')
        .insert([{
          ...data,
          type_adresse: 'collaborateur',
          status: data.status || 'actif',
          tenant_id: tenantId
        }])
        .select('id')
        .single();

      if (error) throw error;

      const profession = data.profession?.toLowerCase();
      if (newCollaborateur?.id && data.email && profession === 'partner') {
        try {
          await invokeSupabaseFunction('create-user-account', {
            body: {
              email: data.email,
              role: 'partner',
              collaborateurId: newCollaborateur.id,
              firstName: data.first_name,
              lastName: data.last_name,
              tenantId,
            },
          });
        } catch (accountError) {
          toast({
            title: "Partenaire ajouté, invitation non envoyée",
            description: accountError instanceof Error
              ? accountError.message
              : "Impossible de créer le compte partenaire.",
            variant: "destructive",
          });
          refetch();
          return true;
        }
      }

      toast({
        title: profession === 'partner' ? "Partenaire ajouté" : "Collaborateur ajouté",
        description: profession === 'partner'
          ? `${data.first_name} ${data.last_name} a été ajouté et invité par email`
          : `${data.first_name} ${data.last_name} a été ajouté avec succès`
      });

      refetch();
      return true;
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: translateError(error.message),
        variant: "destructive"
      });
      return false;
    }
  };

  const updateCollaborateur = async (id: string, data: Partial<CollaborateurFormData>) => {
    try {
      const { error } = await supabase
        .from('clients')
        .update(data)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Collaborateur modifié",
        description: "Les informations ont été mises à jour"
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

  const deleteCollaborateur = async (id: string) => {
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Collaborateur supprimé",
        description: "Le collaborateur a été supprimé"
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

  // Statistics
  const stats = {
    total: totalCount,
    actifs: collaborateurs.filter(c => c.status === 'actif').length,
    inactifs: collaborateurs.filter(c => c.status !== 'actif').length,
  };

  return {
    collaborateurs,
    loading,
    stats,
    page,
    totalCount,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    fetchCollaborateurs,
    addCollaborateur,
    updateCollaborateur,
    deleteCollaborateur
  };
}
