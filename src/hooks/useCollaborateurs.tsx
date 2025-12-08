import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";

export interface Collaborateur {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  mobile: string | null;
  status: string | null;
  profession: string | null;
  created_at: string;
  // Financial fields
  commission_rate: number | null;
  fixed_salary: number | null;
  bonus_rate: number | null;
  contract_type: string | null;
  work_percentage: number | null;
  hire_date: string | null;
}

export type CollaborateurFormData = {
  first_name: string;
  last_name: string;
  email: string;
  mobile?: string;
  profession?: string;
  status?: string;
  // Financial fields
  commission_rate?: number;
  fixed_salary?: number;
  bonus_rate?: number;
  contract_type?: string;
  work_percentage?: number;
  hire_date?: string;
};

export function useCollaborateurs() {
  const { toast } = useToast();
  const [collaborateurs, setCollaborateurs] = useState<Collaborateur[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCollaborateurs = useCallback(async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('clients')
        .select('id, first_name, last_name, email, mobile, status, profession, created_at, commission_rate, fixed_salary, bonus_rate, contract_type, work_percentage, hire_date')
        .eq('type_adresse', 'collaborateur')
        .order('first_name', { ascending: true });

      if (error) throw error;
      setCollaborateurs(data || []);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
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
      const { error } = await supabase
        .from('clients')
        .insert([{
          ...data,
          type_adresse: 'collaborateur',
          status: data.status || 'actif'
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
        description: error.message,
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
