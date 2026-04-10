import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUserTenant } from "@/hooks/useUserTenant";
import { translateError } from "@/lib/errorTranslations";

const CLIENTS_PAGE_SIZE = 50;
const CLIENTS_QUERY_TIMEOUT_MS = 12_000;

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

    let query = supabase
      .from("clients")
      .select("*", { count: "exact" })
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (typeFilter) {
      query = query.eq("type_adresse", typeFilter);
    }

    const result = await withTimeout(
      query.range(from, to),
      CLIENTS_QUERY_TIMEOUT_MS,
      "Le chargement des adresses a expire."
    );

    if (result.error) {
      throw result.error;
    }

    return {
      rows: (result.data ?? []) as Client[],
      count: result.count ?? 0,
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
        throw new Error("Aucun cabinet assigne a cet utilisateur");
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
        title: "Client cree",
        description: "Le client a ete cree avec succes",
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
        title: "Client mis a jour",
        description: "Les modifications ont ete enregistrees",
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
        title: "Client supprime",
        description: "Le client a ete supprime avec succes",
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

      return { data: client, error: null };
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
