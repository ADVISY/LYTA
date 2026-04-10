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

function parseCountFromContentRange(contentRange: string | null): number {
  if (!contentRange) return 0;

  const total = contentRange.split("/")[1];
  const parsed = Number.parseInt(total ?? "", 10);

  return Number.isFinite(parsed) ? parsed : 0;
}

async function fetchQueryCount(builder: any): Promise<number> {
  const url = new URL(builder.url.toString());
  url.searchParams.set("select", "*");
  url.searchParams.delete("order");

  const headers = new Headers(builder.headers);
  headers.set("Prefer", "count=exact");

  const response = await builder.fetch(url.toString(), {
    method: "HEAD",
    headers,
  });

  if (!response.ok) {
    throw new Error(`Count query failed with status ${response.status}`);
  }

  return parseCountFromContentRange(response.headers.get("content-range"));
}

export function usePaginatedQuery<T = any>(
  options: UsePaginatedQueryOptions
): UsePaginatedQueryResult<T> {
  const { queryKey, buildQuery, pageSize = 50, enabled = true } = options;
  const [page, setPage] = useState(1);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: countData } = useQuery({
    queryKey: [...queryKey, "count"],
    queryFn: async () => fetchQueryCount(buildQuery(supabase)),
    enabled,
    refetchOnWindowFocus: false,
  });

  const totalCount = countData ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [...queryKey, "page", page, pageSize],
    queryFn: async () => {
      const { data: rows, error } = await buildQuery(supabase).range(from, to);
      if (error) throw error;
      return (rows ?? []) as T[];
    },
    enabled,
    refetchOnWindowFocus: false,
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
