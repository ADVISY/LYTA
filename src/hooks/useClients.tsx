import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUserTenant } from "@/hooks/useUserTenant";
import { translateError } from "@/lib/errorTranslations";

const CLIENTS_PAGE_SIZE = 50;
// Bumpé de 12s → 45s : avec 1000+ clients + RLS lourdes (3 EXISTS croisés),
// le count + select peuvent dépasser 12s. 45s laisse de la marge sans bloquer
// l'UI éternellement.
const CLIENTS_QUERY_TIMEOUT_MS = 45_000;

type AssignedAgent = {
  id: string;
  user_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
};

export type Client = {
  id: string;
  tenant_id?: string | null;
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
  assigned_agent?: AssignedAgent | null;
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    promise
      .then((value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      });
  });
}

function addAssignedAgentsToMap(agentsByRef: Map<string, AssignedAgent>, agents: AssignedAgent[]) {
  for (const agent of agents) {
    agentsByRef.set(agent.id, agent);
    if (agent.user_id) {
      agentsByRef.set(agent.user_id, agent);
    }
  }
}

async function fetchCollaboratorAgentsBy(
  column: "id" | "user_id",
  ids: string[],
  tenantId?: string | null
): Promise<AssignedAgent[]> {
  if (ids.length === 0) return [];

  let query = supabase
    .from("clients")
    .select("id, user_id, first_name, last_name, email")
    .eq("type_adresse", "collaborateur")
    .in(column, ids);

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const { data, error } = await query;

  if (error) {
    console.warn("Unable to resolve assigned agents from collaborator addresses", error);
    return [];
  }

  return (data ?? []) as AssignedAgent[];
}

async function fetchProfileAgents(ids: string[]): Promise<AssignedAgent[]> {
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email")
    .in("id", ids);

  if (error) {
    console.warn("Unable to resolve assigned agents from profiles", error);
    return [];
  }

  return (data ?? []).map((profile) => ({
    id: profile.id,
    user_id: profile.id,
    first_name: profile.first_name,
    last_name: profile.last_name,
    email: profile.email,
  }));
}

async function fetchCollaboratorAgentsByEither(
  ids: string[],
  tenantId?: string | null
): Promise<AssignedAgent[]> {
  if (ids.length === 0) return [];

  // OR query : on cherche les collaborateurs où soit l'id soit le user_id matche
  // (assigned_agent_id peut référencer l'un ou l'autre selon le legacy code).
  // Évite une 2e round-trip — on fait UN SEUL SELECT au lieu de 2.
  let query = supabase
    .from("clients")
    .select("id, user_id, first_name, last_name, email")
    .eq("type_adresse", "collaborateur");

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const idList = ids.map((id) => `"${id}"`).join(",");
  query = query.or(`id.in.(${idList}),user_id.in.(${idList})`);

  const { data, error } = await query;
  if (error) {
    console.warn("Unable to resolve assigned agents from collaborator addresses", error);
    return [];
  }
  return (data ?? []) as AssignedAgent[];
}

async function withAssignedAgents(rows: Client[], tenantId?: string | null): Promise<Client[]> {
  const assignedAgentIds = Array.from(
    new Set(
      rows
        .map((client) => client.assigned_agent_id)
        .filter((id): id is string => Boolean(id))
    )
  );

  if (assignedAgentIds.length === 0) {
    return rows;
  }

  // Avant : 3 requêtes séquentielles (collab by id → collab by user_id →
  // profiles). ~600 ms même quand tout est dans la 1ère.
  // Maintenant : 1 SEUL select avec OR pour les collaborateurs + 1 SELECT
  // profiles, exécutés EN PARALLÈLE. ~200 ms tous cas confondus.
  const agentsByRef = new Map<string, AssignedAgent>();

  const [collabAgents, profileAgents] = await Promise.all([
    fetchCollaboratorAgentsByEither(assignedAgentIds, tenantId),
    fetchProfileAgents(assignedAgentIds),
  ]);
  addAssignedAgentsToMap(agentsByRef, collabAgents);
  addAssignedAgentsToMap(agentsByRef, profileAgents);

  return rows.map((client) => ({
    ...client,
    assigned_agent: client.assigned_agent_id
      ? agentsByRef.get(client.assigned_agent_id) ?? null
      : null,
  }));
}

export interface ClientsFilters {
  city?: string | null;
  canton?: string | null;
  status?: string | null;
  postalCode?: string | null;
  /**
   * Filtre Pro / Privé :
   *   - true  : uniquement les fiches où is_company = true (B2B / société)
   *   - false : uniquement les fiches où is_company = false OU IS NULL (B2C / particulier)
   *   - null/undefined : pas de filtre, on prend les deux
   */
  isCompany?: boolean | null;
  /**
   * Filtre par agent assigné :
   *   - 'unassigned' : fiches sans agent (assigned_agent_id IS NULL) → à répartir
   *   - UUID         : assignées à cet agent spécifique
   *   - null/undefined : pas de filtre
   */
  assignedAgent?: string | null;
}

export function useClients(typeFilter?: string, searchTerm?: string, filters?: ClientsFilters) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { tenantId, loading: tenantLoading } = useUserTenant();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const cityFilter = (filters?.city ?? "").trim();
  const cantonFilter = (filters?.canton ?? "").trim();
  const statusFilter = (filters?.status ?? "").trim();
  const postalCodeFilter = (filters?.postalCode ?? "").trim();
  const isCompanyFilter = filters?.isCompany ?? null;
  const assignedAgentFilter = filters?.assignedAgent ?? null;

  // Reset page quand filtre type, recherche ou filtres géographiques changent
  useEffect(() => {
    setPage(1);
  }, [tenantId, typeFilter, searchTerm, cityFilter, cantonFilter, statusFilter, postalCodeFilter, isCompanyFilter, assignedAgentFilter]);

  const trimmedSearch = (searchTerm ?? "").trim();

  const from = (page - 1) * CLIENTS_PAGE_SIZE;
  const to = from + CLIENTS_PAGE_SIZE - 1;
  const baseQueryKey = useMemo(
    () => [
      "clients",
      tenantId ?? "",
      typeFilter ?? "",
      trimmedSearch,
      cityFilter,
      cantonFilter,
      statusFilter,
      postalCodeFilter,
      isCompanyFilter,
      assignedAgentFilter,
    ],
    [tenantId, typeFilter, trimmedSearch, cityFilter, cantonFilter, statusFilter, postalCodeFilter, isCompanyFilter, assignedAgentFilter]
  );

  const fetchClientsPage = useCallback(async () => {
    if (!tenantId) {
      return { rows: [] as Client[], count: 0 };
    }

    // SELECT data + recherche côté serveur (sans la recherche serveur, la
    // barre de recherche front ne filtrait que la page courante de 50 = JCG
    // perdait ses 928 contacts dès la page 2).
    let query = supabase
      .from("clients")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (typeFilter) {
      query = query.eq("type_adresse", typeFilter);
    }
    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }
    if (cantonFilter) {
      query = query.ilike("canton", cantonFilter);
    }
    if (cityFilter) {
      query = query.ilike("city", `%${cityFilter}%`);
    }
    if (postalCodeFilter) {
      query = query.ilike("postal_code", `${postalCodeFilter}%`);
    }
    if (isCompanyFilter === true) {
      // Filtre Pro : uniquement les fiches B2B (raison sociale)
      query = query.eq("is_company", true);
    } else if (isCompanyFilter === false) {
      // Filtre Privé : on inclut aussi les fiches legacy où is_company est NULL
      // (avant l'ajout de la colonne, toutes les fiches étaient des particuliers).
      query = query.or("is_company.eq.false,is_company.is.null");
    }
    if (assignedAgentFilter === "unassigned") {
      query = query.is("assigned_agent_id", null);
    } else if (assignedAgentFilter) {
      query = query.eq("assigned_agent_id", assignedAgentFilter);
    }

    if (trimmedSearch) {
      // Échappe les caractères PostgREST spéciaux (% , ()) dans la valeur user
      const safe = trimmedSearch.replace(/[%,()]/g, " ");
      const pattern = `%${safe}%`;
      query = query.or(
        `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},company_name.ilike.${pattern},phone.ilike.${pattern}`
      );
    }

    const [dataResult, countResult] = await Promise.all([
      withTimeout(
        query.range(from, to),
        CLIENTS_QUERY_TIMEOUT_MS,
        "Le chargement des adresses a expiré."
      ),
      supabase.rpc("count_clients_for_tenant", {
        p_tenant_id: tenantId,
        p_type_adresse: typeFilter ?? null,
        p_search: trimmedSearch || null,
        p_city: cityFilter || null,
        p_canton: cantonFilter || null,
        p_status: statusFilter || null,
        p_postal_code: postalCodeFilter || null,
        p_is_company: isCompanyFilter,
        p_assigned_agent: assignedAgentFilter,
      }),
    ]);

    if (dataResult.error) {
      throw dataResult.error;
    }

    const rows = await withAssignedAgents((dataResult.data ?? []) as Client[], tenantId);

    // Si la RPC count échoue (très rare), on tombe sur rows.length comme fallback
    const totalCount = (typeof countResult?.data === "number")
      ? countResult.data
      : (rows.length === CLIENTS_PAGE_SIZE ? from + rows.length + 1 : from + rows.length);

    return {
      rows,
      count: totalCount,
    };
  }, [from, tenantId, to, typeFilter, trimmedSearch, cityFilter, cantonFilter, statusFilter, postalCodeFilter, isCompanyFilter, assignedAgentFilter]);

  const {
    data,
    error,
    isError,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [...baseQueryKey, page, CLIENTS_PAGE_SIZE],
    queryFn: fetchClientsPage,
    enabled: !tenantLoading && !!tenantId && !!user,
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const totalCount = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / CLIENTS_PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const goToPage = useCallback(
    (nextPage: number) => {
      setPage((currentPage) => {
        if (Number.isNaN(nextPage)) return currentPage;
        return Math.max(1, Math.min(nextPage, totalPages));
      });
    },
    [totalPages]
  );

  const nextPage = useCallback(() => {
    goToPage(page + 1);
  }, [goToPage, page]);

  const prevPage = useCallback(() => {
    goToPage(page - 1);
  }, [goToPage, page]);

  const refreshClients = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: baseQueryKey });
    return refetch();
  }, [baseQueryKey, queryClient, refetch]);

  const createClient = async (clientData: any) => {
    try {
      if (!tenantId) {
        throw new Error("Aucun cabinet assigné à cet utilisateur");
      }

      const payload = { ...clientData, tenant_id: tenantId };
      // Log explicite avant l'envoi pour pouvoir diagnostiquer en console
      // les erreurs RLS / 403 sans lire la trace Supabase brute.
      console.info("[createClient] payload →", {
        tenant_id: payload.tenant_id,
        type_adresse: payload.type_adresse,
        status: payload.status,
        is_company: payload.is_company,
        has_email: !!payload.email,
        has_assigned_agent: !!payload.assigned_agent_id,
      });

      const { data: createdClient, error: createError } = await supabase
        .from("clients")
        .insert([payload])
        .select("*")
        .single();

      if (createError) {
        // Log structuré pour comprendre l'origine exacte du rejet RLS.
        console.error("[createClient] Supabase rejected the INSERT", {
          code: createError.code,
          message: createError.message,
          details: (createError as any).details,
          hint: (createError as any).hint,
          tenant_id_envoyé: payload.tenant_id,
        });
        throw createError;
      }

      toast({
        title: "Client créé",
        description: "Le client a été créé avec succès",
      });

      void queryClient.invalidateQueries({ queryKey: baseQueryKey });
      return { data: createdClient, error: null };
    } catch (caughtError: any) {
      // Toast plus parlant si erreur RLS : on inclut le tenant_id pour
      // que l'utilisateur (et nous) puissions voir si le tenant est bon.
      const isRlsError = caughtError?.code === "42501"
        || /row-level security/i.test(caughtError?.message ?? "");
      toast({
        title: "Erreur",
        description: isRlsError
          ? `Accès refusé (tenant ${String(tenantId).slice(0, 8)}…). Code ${caughtError?.code ?? "?"} — ouvre la console pour les détails.`
          : translateError(caughtError.message),
        variant: "destructive",
      });
      return { data: null, error: caughtError };
    }
  };

  const updateClient = async (id: string, updates: any) => {
    try {
      const { error: updateError } = await supabase
        .from("clients")
        .update(updates)
        .eq("id", id);

      if (updateError) {
        throw updateError;
      }

      toast({
        title: "Client mis à jour",
        description: "Les modifications ont été enregistrées",
      });

      // Invalidation NON-bloquante : sur les gros tenants (3000+ fiches),
      // l'await refreshClients re-SELECT * + repasse can_access_client(id)
      // pour chaque ligne → 2-3 secondes perçues comme un freeze. On laisse
      // le refetch tourner en arrière-plan, l'UI se met à jour quand prêt.
      void queryClient.invalidateQueries({ queryKey: baseQueryKey });
      return { error: null };
    } catch (caughtError: any) {
      toast({
        title: "Erreur",
        description: caughtError.message,
        variant: "destructive",
      });
      return { error: caughtError };
    }
  };

  /**
   * Bulk-assigne ou libère N fiches en un seul UPDATE.
   * @param ids        IDs des fiches clients à modifier
   * @param agentId    ID du collaborateur (fiche clients) à assigner, ou null pour libérer
   * @returns          { error: null | Error, count: number }
   */
  const bulkAssignClients = async (
    ids: string[],
    agentId: string | null
  ): Promise<{ error: Error | null; count: number }> => {
    if (ids.length === 0) return { error: null, count: 0 };
    try {
      const { error: updateError, count } = await supabase
        .from("clients")
        .update({ assigned_agent_id: agentId }, { count: "exact" })
        .in("id", ids);

      if (updateError) throw updateError;

      toast({
        title: agentId ? "Fiches assignées" : "Fiches libérées",
        description:
          agentId
            ? `${count ?? ids.length} fiche(s) assignée(s) avec succès.`
            : `${count ?? ids.length} fiche(s) libérée(s) (sans agent).`,
      });

      void queryClient.invalidateQueries({ queryKey: baseQueryKey });
      return { error: null, count: count ?? ids.length };
    } catch (caughtError: any) {
      toast({
        title: "Erreur",
        description: caughtError.message,
        variant: "destructive",
      });
      return { error: caughtError, count: 0 };
    }
  };

  const deleteClient = async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from("clients")
        .delete()
        .eq("id", id);

      if (deleteError) {
        throw deleteError;
      }

      toast({
        title: "Client supprimé",
        description: "Le client a été supprimé avec succès",
      });

      await refreshClients();
      return { error: null };
    } catch (caughtError: any) {
      toast({
        title: "Erreur",
        description: caughtError.message,
        variant: "destructive",
      });
      return { error: caughtError };
    }
  };

  const getClientById = useCallback(async (id: string) => {
    try {
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (clientError) {
        throw clientError;
      }

      const [clientWithAssignedAgent] = await withAssignedAgents(
        client ? [client as Client] : [],
        (client as Client | null)?.tenant_id ?? tenantId
      );

      return { data: clientWithAssignedAgent ?? null, error: null };
    } catch (caughtError: any) {
      toast({
        title: "Erreur",
        description: caughtError.message,
        variant: "destructive",
      });
      return { data: null, error: caughtError };
    }
  }, [toast]);

  return {
    clients: data?.rows ?? [],
    loading: isLoading,
    isError,
    error: isError
      ? translateError((error as Error | null)?.message || "Erreur lors du chargement des adresses")
      : null,
    page,
    totalCount,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    fetchClients: refreshClients,
    createClient,
    updateClient,
    bulkAssignClients,
    deleteClient,
    getClientById,
  };
}
