import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserTenant } from "@/hooks/useUserTenant";
import { translateError } from "@/lib/errorTranslations";
import { recordAuditLog } from "@/lib/audit";
import { usePaginatedQuery } from "./usePaginatedQuery";

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
  resiliation: "RÃ©siliation",
  sinistre: "Sinistre",
  autre: "Autre",
};

export const suiviStatusLabels: Record<SuiviStatus, string> = {
  ouvert: "Ouvert",
  en_cours: "En cours",
  ferme: "FermÃ©",
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
  const { toast } = useToast();
  const { tenantId } = useUserTenant();

  const {
    data: suivis,
    page,
    totalCount,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    isLoading: loading,
    refetch,
  } = usePaginatedQuery<Suivi>({
    queryKey: ['suivis', clientId ?? 'all'],
    buildQuery: (client) => {
      const q = client
        .from("suivis")
        .select(`
          *,
          client:clients(first_name, last_name, company_name),
          agent:profiles!suivis_assigned_agent_id_fkey(first_name, last_name, email)
        `)
        .order("created_at", { ascending: false });
      return clientId ? q.eq("client_id", clientId) : q;
    },
    pageSize: 50,
  });

  const fetchSuivis = () => refetch();

  const createSuivi = async (data: CreateSuiviData): Promise<{ data: Suivi | null; error: string | null }> => {
    try {
      if (!tenantId) {
        throw new Error("Aucun cabinet assignÃ© Ã  cet utilisateur");
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

      await recordAuditLog({
        action: "create",
        entity: "suivi",
        entityId: newSuivi.id,
        tenantId,
        metadata: {
          client_id: newSuivi.client_id,
          title: newSuivi.title,
          type: newSuivi.type,
          status: newSuivi.status,
        },
      });

      toast({
        title: "SuccÃ¨s",
        description: "Suivi crÃ©Ã© avec succÃ¨s",
      });

      refetch();
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
      const updateData: Record<string, any> = {};
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.type !== undefined) updateData.type = data.type;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.reminder_date !== undefined) updateData.reminder_date = data.reminder_date;
      if (data.assigned_agent_id !== undefined) updateData.assigned_agent_id = data.assigned_agent_id;

      updateData.updated_at = new Date().toISOString();

      const { data: updatedSuivi, error } = await supabase
        .from("suivis")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Error updating suivi:", error, "Data:", updateData);
        toast({
          title: "Erreur",
          description: translateError(error.message),
          variant: "destructive",
        });
        return { data: null, error: error.message };
      }

      await recordAuditLog({
        action: "update",
        entity: "suivi",
        entityId: updatedSuivi.id,
        tenantId,
        metadata: {
          client_id: updatedSuivi.client_id,
          changes: updateData,
        },
      });

      toast({
        title: "SuccÃ¨s",
        description: "Suivi mis Ã  jour avec succÃ¨s",
      });

      refetch();
      return { data: updatedSuivi as unknown as Suivi, error: null };
    } catch (error: any) {
      console.error("Error updating suivi:", error);
      toast({
        title: "Erreur",
        description: translateError(error.message),
        variant: "destructive",
      });
      return { data: null, error: error.message || "Erreur inattendue" };
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
      const existingSuivi = suivis.find((suivi) => suivi.id === id);

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

      await recordAuditLog({
        action: "delete",
        entity: "suivi",
        entityId: id,
        tenantId,
        metadata: {
          client_id: existingSuivi?.client_id ?? null,
          title: existingSuivi?.title ?? null,
          status: existingSuivi?.status ?? null,
        },
      });

      toast({
        title: "SuccÃ¨s",
        description: "Suivi supprimÃ© avec succÃ¨s",
      });

      refetch();
      return { error: null };
    } catch (error) {
      console.error("Error deleting suivi:", error);
      return { error: "Erreur inattendue" };
    }
  };

  const stats = {
    total: totalCount,
    ouverts: suivis.filter(s => s.status === "ouvert").length,
    en_cours: suivis.filter(s => s.status === "en_cours").length,
    fermes: suivis.filter(s => s.status === "ferme").length,
  };

  return {
    suivis,
    loading,
    stats,
    page,
    totalCount,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    fetchSuivis,
    createSuivi,
    updateSuivi,
    closeSuivi,
    reopenSuivi,
    deleteSuivi,
  };
}
