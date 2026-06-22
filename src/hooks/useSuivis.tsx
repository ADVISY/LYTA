import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserTenant } from "@/hooks/useUserTenant";
import { translateError } from "@/lib/errorTranslations";
import { recordAuditLog } from "@/lib/audit";
import { usePaginatedQuery } from "./usePaginatedQuery";

// ═══════════════════════════════════════════════════════════════════════════
// Module Inbox + Pipeline (juin 2026)
//
// Ce hook utilise la table `suivis` étendue pour gérer :
//   - kind='task'           : tâches actionnables (comportement historique)
//   - kind='notification'   : notifs passives
//   - kind='reminder'       : rappels d'échéance
//   - kind='pipeline_card'  : opportunités commerciales par produit
//   - kind='message'        : messages clients portail
//
// Les anciens suivis sont conservés (kind défaut = 'task'). Rétrocompat totale.
// ═══════════════════════════════════════════════════════════════════════════

export type SuiviType = "activation" | "annulation" | "retour" | "resiliation" | "sinistre" | "autre";
export type SuiviStatus = "ouvert" | "en_cours" | "ferme" | "open" | "in_progress" | "done" | "archived" | "snoozed";

// Nouveaux types Inbox/Pipeline
export type ItemKind = "task" | "notification" | "reminder" | "pipeline_card" | "message";
export type ItemPriority = "urgent" | "high" | "normal" | "low";

export type PipelineStage =
  | "prospect"
  | "rdv_fixe"
  | "rdv_passe"
  | "signe"
  | "attente_contrat"
  | "contrat_recu"
  | "contrat_police"
  | "commission_recue"
  | "perdu";

// Colonnes affichées dans le Kanban (6 au lieu des 9 stages DB).
// Simplification UX du 22 juin 2026 :
//   - 'attente_contrat' est fusionné dans 'signe' (= colonne "Signé · En attente")
//   - 'commission_recue' n'a pas sa propre colonne (= action depuis 'contrat_police')
// Les 9 valeurs restent en DB (CHECK constraint) pour ne pas casser les opps
// existantes et préserver la traçabilité fine.
export const PIPELINE_STAGES: PipelineStage[] = [
  "prospect",
  "rdv_fixe",
  "rdv_passe",
  "signe",            // ← regroupe aussi attente_contrat à l'affichage
  "contrat_recu",
  "contrat_police",   // ← la saisie commission archive directement depuis cette colonne
];

// Labels FR par défaut (le composant peut utiliser i18n par-dessus)
export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  prospect: "Prospect",
  rdv_fixe: "RDV fixé",
  rdv_passe: "RDV passé",
  signe: "Signé · En attente",
  attente_contrat: "Signé · En attente",  // même label visuel
  contrat_recu: "Contrat reçu",
  contrat_police: "Contrat policé",
  commission_recue: "Commission reçue",
  perdu: "Perdu",
};

// Couleurs Tailwind pour les colonnes Kanban
export const PIPELINE_STAGE_COLORS: Record<PipelineStage, string> = {
  prospect: "bg-slate-100 border-slate-300 text-slate-700",
  rdv_fixe: "bg-blue-100 border-blue-300 text-blue-700",
  rdv_passe: "bg-indigo-100 border-indigo-300 text-indigo-700",
  signe: "bg-violet-100 border-violet-300 text-violet-700",
  attente_contrat: "bg-amber-100 border-amber-300 text-amber-700",
  contrat_recu: "bg-orange-100 border-orange-300 text-orange-700",
  contrat_police: "bg-emerald-100 border-emerald-300 text-emerald-700",
  commission_recue: "bg-green-100 border-green-300 text-green-700",
  perdu: "bg-red-100 border-red-300 text-red-700",
};

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

  // Nouveaux champs Inbox/Pipeline (tous optionnels pour rétrocompat)
  tenant_id?: string | null;
  kind?: ItemKind | null;
  priority?: ItemPriority | null;
  pipeline_stage?: PipelineStage | null;
  expected_product?: string | null;
  expected_company?: string | null;
  assigned_team_role_id?: string | null;
  related_kind?: string | null;
  related_id?: string | null;
  linked_policy_id?: string | null;
  parent_suivi_id?: string | null;
  action_url?: string | null;
  action_label?: string | null;
  snoozed_until?: string | null;
  completed_at?: string | null;
  completed_by?: string | null;
  source?: string | null;
  loss_reason?: string | null;

  client?: {
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    // Étendu pour enrichir les events Google Calendar (location + détails)
    email?: string | null;
    phone?: string | null;
    mobile?: string | null;
    address?: string | null;
    postal_code?: string | null;
    city?: string | null;
    country?: string | null;
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

  // Nouveaux champs optionnels
  kind?: ItemKind;
  priority?: ItemPriority;
  pipeline_stage?: PipelineStage;
  expected_product?: string;
  expected_company?: string;
  assigned_team_role_id?: string;
  related_kind?: string;
  related_id?: string;
  linked_policy_id?: string;
  parent_suivi_id?: string;
  action_url?: string;
  action_label?: string;
  source?: string;
}

export interface UpdateSuiviData {
  title?: string;
  description?: string;
  type?: SuiviType;
  status?: SuiviStatus;
  reminder_date?: string;
  assigned_agent_id?: string;

  // Nouveaux champs optionnels
  kind?: ItemKind;
  priority?: ItemPriority;
  pipeline_stage?: PipelineStage;
  expected_product?: string;
  expected_company?: string;
  assigned_team_role_id?: string | null;
  linked_policy_id?: string | null;
  parent_suivi_id?: string | null;
  action_url?: string | null;
  action_label?: string | null;
  snoozed_until?: string | null;
  completed_at?: string | null;
  completed_by?: string | null;
  loss_reason?: string | null;
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

// Partial : les nouveaux statuts (open/in_progress/done/archived/snoozed) n'ont pas
// forcément de label legacy. Les composants Inbox/Pipeline ont leurs propres labels.
export const suiviStatusLabels: Partial<Record<SuiviStatus, string>> = {
  ouvert: "Ouvert",
  en_cours: "En cours",
  ferme: "Fermé",
  open: "Ouvert",
  in_progress: "En cours",
  done: "Fait",
  archived: "Archivé",
  snoozed: "Reporté",
};

export const suiviStatusColors: Partial<Record<SuiviStatus, string>> = {
  ouvert: "bg-blue-500",
  en_cours: "bg-amber-500",
  ferme: "bg-emerald-500",
  open: "bg-blue-500",
  in_progress: "bg-amber-500",
  done: "bg-emerald-500",
  archived: "bg-slate-400",
  snoozed: "bg-violet-400",
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

export const getSuiviStatusLabels = (t: (key: string) => string): Partial<Record<SuiviStatus, string>> => ({
  ouvert: t('followups.open'),
  en_cours: t('followups.inProgress'),
  ferme: t('followups.closed'),
  open: t('followups.open'),
  in_progress: t('followups.inProgress'),
  done: t('followups.closed'),
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
          client:clients(first_name, last_name, company_name, email, phone, mobile, address, postal_code, city, country),
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
          // Nouveaux champs Inbox/Pipeline (tous optionnels)
          kind: data.kind ?? "task",
          priority: data.priority ?? "normal",
          pipeline_stage: data.pipeline_stage ?? null,
          expected_product: data.expected_product ?? null,
          expected_company: data.expected_company ?? null,
          assigned_team_role_id: data.assigned_team_role_id ?? null,
          related_kind: data.related_kind ?? null,
          related_id: data.related_id ?? null,
          linked_policy_id: data.linked_policy_id ?? null,
          parent_suivi_id: data.parent_suivi_id ?? null,
          action_url: data.action_url ?? null,
          action_label: data.action_label ?? null,
          source: data.source ?? "manual",
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
        title: "Succès",
        description: "Suivi créé avec succès",
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

      // Nouveaux champs Inbox/Pipeline (undefined = pas de modif, null = effacer)
      if (data.kind !== undefined) updateData.kind = data.kind;
      if (data.priority !== undefined) updateData.priority = data.priority;
      if (data.pipeline_stage !== undefined) updateData.pipeline_stage = data.pipeline_stage;
      if (data.expected_product !== undefined) updateData.expected_product = data.expected_product;
      if (data.expected_company !== undefined) updateData.expected_company = data.expected_company;
      if (data.assigned_team_role_id !== undefined) updateData.assigned_team_role_id = data.assigned_team_role_id;
      if (data.linked_policy_id !== undefined) updateData.linked_policy_id = data.linked_policy_id;
      if (data.parent_suivi_id !== undefined) updateData.parent_suivi_id = data.parent_suivi_id;
      if (data.action_url !== undefined) updateData.action_url = data.action_url;
      if (data.action_label !== undefined) updateData.action_label = data.action_label;
      if (data.snoozed_until !== undefined) updateData.snoozed_until = data.snoozed_until;
      if (data.completed_at !== undefined) updateData.completed_at = data.completed_at;
      if (data.completed_by !== undefined) updateData.completed_by = data.completed_by;
      if (data.loss_reason !== undefined) updateData.loss_reason = data.loss_reason;

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
        title: "Succès",
        description: "Suivi mis à jour avec succès",
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
        title: "Succès",
        description: "Suivi supprimé avec succès",
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

// ═══════════════════════════════════════════════════════════════════════════
// usePipeline() — Vue Kanban des opportunités commerciales
//
// Retourne les pipeline_card actifs (status != archived/done/ferme) groupés
// par stage. Optionnellement filtrés par agent, équipe, compagnie, produit.
//
// Usage :
//   const { stages, totalCount, loading } = usePipeline({ agentId: 'xxx' });
//   stages.prospect, stages.rdv_fixe, ...
// ═══════════════════════════════════════════════════════════════════════════

export interface PipelineFilters {
  agentId?: string;          // assigné à cet agent
  teamRoleId?: string;       // assigné à cette équipe
  expectedCompany?: string;
  expectedProduct?: string;
  clientId?: string;         // pour vue "pipeline d'un client"
}

export interface PipelineResult {
  stages: Record<PipelineStage, Suivi[]>;
  totalCount: number;
  loading: boolean;
  refetch: () => void;
}

export function usePipeline(filters: PipelineFilters = {}): PipelineResult {
  const { tenantId } = useUserTenant();

  const {
    data: items = [],
    isLoading: loading,
    refetch,
  } = useQuery({
    queryKey: ["pipeline_cards", tenantId, filters],
    enabled: !!tenantId,
    queryFn: async () => {
      // Cast en `any` au plus tôt pour éviter "Type instantiation excessively
      // deep" causé par les enchaînements .eq() conditionnels sur le query
      // builder Supabase typé.
      const base: any = supabase.from("suivis");
      let query: any = base
        .select(`
          *,
          client:clients(first_name, last_name, company_name, email, phone, mobile, address, postal_code, city, country),
          agent:profiles!suivis_assigned_agent_id_fkey(first_name, last_name, email)
        `)
        .eq("tenant_id", tenantId!)
        .eq("kind", "pipeline_card")
        .not("status", "in", "(archived,done,ferme)")
        .order("created_at", { ascending: false });

      if (filters.agentId) query = query.eq("assigned_agent_id", filters.agentId);
      if (filters.teamRoleId) query = query.eq("assigned_team_role_id", filters.teamRoleId);
      if (filters.expectedCompany) query = query.eq("expected_company", filters.expectedCompany);
      if (filters.expectedProduct) query = query.eq("expected_product", filters.expectedProduct);
      if (filters.clientId) query = query.eq("client_id", filters.clientId);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as Suivi[];
    },
  });

  const stages = useMemo<Record<PipelineStage, Suivi[]>>(() => {
    const empty = PIPELINE_STAGES.reduce(
      (acc, s) => ({ ...acc, [s]: [] }),
      { perdu: [] as Suivi[] } as Record<PipelineStage, Suivi[]>
    );
    for (const item of items) {
      let stage = (item.pipeline_stage as PipelineStage) || "prospect";
      // Simplification UI : 'attente_contrat' s'affiche dans la colonne 'signe'
      if (stage === "attente_contrat") stage = "signe";
      // 'commission_recue' : pas de colonne dédiée, on filtre comme 'contrat_police'
      // (les opps en commission_recue qui ne sont pas encore archivées restent
      // visibles dans 'contrat_police' jusqu'à archivage manuel)
      if (stage === "commission_recue") stage = "contrat_police";
      empty[stage] = [...(empty[stage] ?? []), item];
    }
    return empty;
  }, [items]);

  return {
    stages,
    totalCount: items.length,
    loading,
    refetch,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// useArchivedPipeline() — Historique (admin only en pratique via RLS)
// ═══════════════════════════════════════════════════════════════════════════

export function useArchivedPipeline(filters: PipelineFilters = {}) {
  const { tenantId } = useUserTenant();

  return useQuery({
    queryKey: ["pipeline_archived", tenantId, filters],
    enabled: !!tenantId,
    queryFn: async () => {
      const base: any = supabase.from("suivis");
      let query: any = base
        .select(`
          *,
          client:clients(first_name, last_name, company_name, email, phone, mobile, address, postal_code, city, country),
          agent:profiles!suivis_assigned_agent_id_fkey(first_name, last_name, email)
        `)
        .eq("tenant_id", tenantId!)
        .eq("kind", "pipeline_card")
        .eq("status", "archived")
        .order("completed_at", { ascending: false, nullsFirst: false });

      if (filters.agentId) query = query.eq("assigned_agent_id", filters.agentId);
      if (filters.expectedCompany) query = query.eq("expected_company", filters.expectedCompany);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as Suivi[];
    },
  });
}
