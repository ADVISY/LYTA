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

  const agentsByRef = new Map<string, AssignedAgent>();

  addAssignedAgentsToMap(
    agentsByRef,
    await fetchCollaboratorAgentsBy("id", assignedAgentIds, tenantId)
  );

  const missingCollaboratorIds = assignedAgentIds.filter((id) => !agentsByRef.has(id));
  addAssignedAgentsToMap(
    agentsByRef,
    await fetchCollaboratorAgentsBy("user_id", missingCollaboratorIds, tenantId)
  );

  const missingProfileIds = assignedAgentIds.filter((id) => !agentsByRef.has(id));
  addAssignedAgentsToMap(agentsByRef, await fetchProfileAgents(missingProfileIds));

  return rows.map((client) => ({
    ...client,
    assigned_agent: client.assigned_agent_id
      ? agentsByRef.get(client.assigned_agent_id) ?? null
      : null,
  }));
}

export function useClients(typeFilter?: string) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { tenantId, loading: tenantLoading } = useUserTenant();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [tenantId, typeFilter]);

  const from = (page - 1) * CLIENTS_PAGE_SIZE;
  const to = from + CLIENTS_PAGE_SIZE - 1;
  const baseQueryKey = useMemo(
    () => ["clients", tenantId ?? "", typeFilter ?? ""],
    [tenantId, typeFilter]
  );

  const fetchClientsPage = useCallback(async () => {
    if (!tenantId) {
      return { rows: [] as Client[], count: 0 };
    }

    // SELECT data (sans count — le count exact RLS dépasse le statement_timeout
    // Postgres 8s sur gros tenants 1000+ rows). On fait le count en parallèle
    // via la RPC count_clients_for_tenant (SECURITY DEFINER → bypass RLS, count
    // instantané).
    let query = supabase
      .from("clients")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (typeFilter) {
      query = query.eq("type_adresse", typeFilter);
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
  }, [from, tenantId, to, typeFilter]);

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

      const { data: createdClient, error: createError } = await supabase
        .from("clients")
        .insert([{ ...clientData, tenant_id: tenantId }])
        .select("*")
        .single();

      if (createError) {
        throw createError;
      }

      toast({
        title: "Client créé",
        description: "Le client a été créé avec succès",
      });

      await refreshClients();
      return { data: createdClient, error: null };
    } catch (caughtError: any) {
      toast({
        title: "Erreur",
        description: translateError(caughtError.message),
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
    deleteClient,
    getClientById,
  };
}
