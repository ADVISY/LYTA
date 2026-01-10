import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserTenant } from "@/hooks/useUserTenant";
import { translateError } from "@/lib/errorTranslations";

export type SuiviType = "activation" | "annulation" | "retour" | "resiliation" | "sinistre" | "autre";
export type SuiviStatus = "ouvert" | "en_cours" | "ferme";

export interface Suivi {
  id: string;
  client_id: string;
  assigned_agent_id: string | null;
  title: string;
  description: string | null;
  type: SuiviType | null;
  status: SuiviStatus;
  reminder_date: string | null;
  created_at: string;
  updated_at: string;
  client?: {
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
  };
  agent?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
}

export interface CreateSuiviData {
  client_id: string;
  title: string;
  description?: string;
  type?: SuiviType;
  status?: SuiviStatus;
  reminder_date?: string;
  assigned_agent_id?: string;
}

export interface UpdateSuiviData {
  title?: string;
  description?: string;
  type?: SuiviType;
  status?: SuiviStatus;
  reminder_date?: string;
  assigned_agent_id?: string;
}

// Note: These labels are kept as fallbacks. Use getSuiviTypeLabels(t) and getSuiviStatusLabels(t) in components
export const suiviTypeLabels: Record<SuiviType, string> = {
  activation: "Activation",
  annulation: "Annulation",
  retour: "Retour",
  resiliation: "Résiliation",
  sinistre: "Sinistre",
  autre: "Autre",
};

export const suiviStatusLabels: Record<SuiviStatus, string> = {
  ouvert: "Ouvert",
  en_cours: "En cours",
  ferme: "Fermé",
};

export const suiviStatusColors: Record<SuiviStatus, string> = {
  ouvert: "bg-blue-500",
  en_cours: "bg-amber-500",
  ferme: "bg-emerald-500",
};

// Translated label getters
export const getSuiviTypeLabels = (t: (key: string) => string): Record<SuiviType, string> => ({
  activation: t('followups.types.activation'),
  annulation: t('followups.types.cancellation'),
  retour: t('followups.types.return'),
  resiliation: t('followups.types.termination'),
  sinistre: t('followups.types.claim'),
  autre: t('followups.types.other'),
});

export const getSuiviStatusLabels = (t: (key: string) => string): Record<SuiviStatus, string> => ({
  ouvert: t('followups.open'),
  en_cours: t('followups.inProgress'),
  ferme: t('followups.closed'),
});

export function useSuivis(clientId?: string) {
  const [suivis, setSuivis] = useState<Suivi[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { tenantId } = useUserTenant();

  const fetchSuivis = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("suivis")
        .select(`
          *,
          client:clients(first_name, last_name, company_name),
          agent:profiles!suivis_assigned_agent_id_fkey(first_name, last_name, email)
        `)
        .order("created_at", { ascending: false });

      if (clientId) {
        query = query.eq("client_id", clientId);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching suivis:", error);
        toast({
          title: "Erreur",
          description: translateError(error.message),
          variant: "destructive",
        });
      } else {
        setSuivis((data as unknown as Suivi[]) || []);
      }
    } catch (error) {
      console.error("Error fetching suivis:", error);
    } finally {
      setLoading(false);
    }
  };

  const createSuivi = async (data: CreateSuiviData): Promise<{ data: Suivi | null; error: string | null }> => {
    try {
      if (!tenantId) {
        throw new Error("Aucun cabinet assigné à cet utilisateur");
      }

      const { data: newSuivi, error } = await supabase
        .from("suivis")
        .insert([{
          client_id: data.client_id,
          title: data.title,
          description: data.description || null,
          type: data.type || null,
          status: data.status || "ouvert",
          reminder_date: data.reminder_date || null,
          assigned_agent_id: data.assigned_agent_id || null,
          tenant_id: tenantId,
        }])
        .select()
        .single();

      if (error) {
        console.error("Error creating suivi:", error);
        toast({
          title: "Erreur",
          description: translateError(error.message),
          variant: "destructive",
        });
        return { data: null, error: error.message };
      }

      toast({
        title: "Succès",
        description: "Suivi créé avec succès",
      });
      
      await fetchSuivis();
      return { data: newSuivi as unknown as Suivi, error: null };
    } catch (error: any) {
      console.error("Error creating suivi:", error);
      toast({
        title: "Erreur",
        description: translateError(error.message),
        variant: "destructive",
      });
      return { data: null, error: error.message || "Erreur inattendue" };
    }
  };

  const updateSuivi = async (id: string, data: UpdateSuiviData): Promise<{ data: Suivi | null; error: string | null }> => {
    try {
      const { data: updatedSuivi, error } = await supabase
        .from("suivis")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Error updating suivi:", error);
        toast({
          title: "Erreur",
          description: "Impossible de mettre à jour le suivi",
          variant: "destructive",
        });
        return { data: null, error: error.message };
      }

      toast({
        title: "Succès",
        description: "Suivi mis à jour avec succès",
      });
      
      await fetchSuivis();
      return { data: updatedSuivi as unknown as Suivi, error: null };
    } catch (error) {
      console.error("Error updating suivi:", error);
      return { data: null, error: "Erreur inattendue" };
    }
  };

  const closeSuivi = async (id: string): Promise<{ error: string | null }> => {
    const result = await updateSuivi(id, { status: "ferme" });
    return { error: result.error };
  };

  const reopenSuivi = async (id: string): Promise<{ error: string | null }> => {
    const result = await updateSuivi(id, { status: "ouvert" });
    return { error: result.error };
  };

  const deleteSuivi = async (id: string): Promise<{ error: string | null }> => {
    try {
      const { error } = await supabase
        .from("suivis")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Error deleting suivi:", error);
        toast({
          title: "Erreur",
          description: "Impossible de supprimer le suivi",
          variant: "destructive",
        });
        return { error: error.message };
      }

      toast({
        title: "Succès",
        description: "Suivi supprimé avec succès",
      });
      
      await fetchSuivis();
      return { error: null };
    } catch (error) {
      console.error("Error deleting suivi:", error);
      return { error: "Erreur inattendue" };
    }
  };

  // Stats
  const stats = {
    total: suivis.length,
    ouverts: suivis.filter(s => s.status === "ouvert").length,
    en_cours: suivis.filter(s => s.status === "en_cours").length,
    fermes: suivis.filter(s => s.status === "ferme").length,
  };

  useEffect(() => {
    fetchSuivis();
  }, [clientId]);

  return {
    suivis,
    loading,
    stats,
    fetchSuivis,
    createSuivi,
    updateSuivi,
    closeSuivi,
    reopenSuivi,
    deleteSuivi,
  };
}
