import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";
import { useUserTenant } from "@/hooks/useUserTenant";
import { translateError } from "@/lib/errorTranslations";

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
  const [collaborateurs, setCollaborateurs] = useState<Collaborateur[]>([]);
  const [loading, setLoading] = useState(true);
  const { tenantId } = useUserTenant();

  const fetchCollaborateurs = useCallback(async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('clients')
        .select('id, first_name, last_name, email, mobile, status, profession, photo_url, created_at, commission_rate, commission_rate_lca, commission_rate_vie, fixed_salary, bonus_rate, contract_type, work_percentage, hire_date, manager_id, manager_commission_rate_lca, manager_commission_rate_vie, reserve_rate')
        .eq('type_adresse', 'collaborateur')
        .order('first_name', { ascending: true });

      if (error) throw error;
      
      // Fetch manager info for each collaborator that has one
      const collaborateursWithManager = (data || []).map(collab => {
        const manager = collab.manager_id 
          ? data?.find(c => c.id === collab.manager_id) || null
          : null;
        return { ...collab, manager };
      });
      
      setCollaborateurs(collaborateursWithManager);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: translateError(error.message),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCollaborateurs();
  }, [fetchCollaborateurs]);

  const addCollaborateur = async (data: CollaborateurFormData) => {
    try {
      if (!tenantId) {
        throw new Error("Aucun cabinet assigné à cet utilisateur");
      }

      const { error } = await supabase
        .from('clients')
        .insert([{
          ...data,
          type_adresse: 'collaborateur',
          status: data.status || 'actif',
          tenant_id: tenantId
        }]);

      if (error) throw error;

      toast({
        title: "Collaborateur ajouté",
        description: `${data.first_name} ${data.last_name} a été ajouté avec succès`
      });

      await fetchCollaborateurs();
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

      await fetchCollaborateurs();
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

      await fetchCollaborateurs();
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
    total: collaborateurs.length,
    actifs: collaborateurs.filter(c => c.status === 'actif').length,
    inactifs: collaborateurs.filter(c => c.status !== 'actif').length,
  };

  return {
    collaborateurs,
    loading,
    stats,
    fetchCollaborateurs,
    addCollaborateur,
    updateCollaborateur,
    deleteCollaborateur
  };
}
