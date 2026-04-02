import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UsePaginatedQueryOptions {
  queryKey: string[];
  buildQuery: (client: typeof supabase) => any;
  pageSize?: number;
  enabled?: boolean;
}

interface UsePaginatedQueryResult<T> {
  data: T[];
  page: number;
  totalCount: number;
  totalPages: number;
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function usePaginatedQuery<T = any>(
  options: UsePaginatedQueryOptions
): UsePaginatedQueryResult<T> {
  const { queryKey, buildQuery, pageSize = 50, enabled = true } = options;
  const [page, setPage] = useState(1);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Count query — uses a separate builder call with head:true to avoid double .select()
  const { data: countData } = useQuery({
    queryKey: [...queryKey, "count"],
    queryFn: async () => {
      const { count, error } = await buildQuery(supabase).select("*", {
        count: "exact",
        head: true,
      });
      if (error) throw error;
      return count ?? 0;
    },
    enabled,
  });

  const totalCount = countData ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Data query with pagination — fresh builder call so .range() is appended cleanly
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [...queryKey, "page", page, pageSize],
    queryFn: async () => {
      const { data: rows, error } = await buildQuery(supabase).range(from, to);
      if (error) throw error;
      return (rows ?? []) as T[];
    },
    enabled,
  });

  const goToPage = useCallback(
    (p: number) => setPage(Math.max(1, Math.min(p, totalPages))),
    [totalPages]
  );
  const nextPage = useCallback(() => goToPage(page + 1), [page, goToPage]);
  const prevPage = useCallback(() => goToPage(page - 1), [page, goToPage]);

  return {
    data: data ?? [],
    page,
    totalCount,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    isLoading,
    isError,
    refetch,
  };
}
