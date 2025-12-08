import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";

export interface Collaborateur {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  profession: string | null;
  commission_rate: number | null;
  commission_rate_lca: number | null;
  commission_rate_vie: number | null;
  manager_id: string | null;
  manager_commission_rate_lca: number | null;
  manager_commission_rate_vie: number | null;
  reserve_rate: number | null;
  fixed_salary: number | null;
  bonus_rate: number | null;
  work_percentage: number | null;
  contract_type: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
}

export function useCollaborateursCommission() {
  const { toast } = useToast();
  const [collaborateurs, setCollaborateurs] = useState<Collaborateur[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCollaborateurs() {
      try {
        setLoading(true);
        
        // Récupérer les collaborateurs depuis la table clients (type_adresse = 'collaborateur')
        const { data, error } = await supabase
          .from('clients')
          .select('id, first_name, last_name, email, profession, commission_rate, commission_rate_lca, commission_rate_vie, manager_id, manager_commission_rate_lca, manager_commission_rate_vie, reserve_rate, fixed_salary, bonus_rate, work_percentage, contract_type, address, city, postal_code')
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
    }

    fetchCollaborateurs();
  }, []);

  // Helper to get manager for a collaborateur
  const getManagerForCollaborateur = (collaborateurId: string): Collaborateur | null => {
    const collab = collaborateurs.find(c => c.id === collaborateurId);
    if (!collab || !collab.manager_id) return null;
    return collaborateurs.find(c => c.id === collab.manager_id) || null;
  };

  return { collaborateurs, loading, getManagerForCollaborateur };
}
