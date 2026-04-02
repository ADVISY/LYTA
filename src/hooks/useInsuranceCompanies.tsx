import { supabase } from '@/integrations/supabase/client';
import { usePaginatedQuery } from './usePaginatedQuery';

export type InsuranceCompany = {
  id: string;
  name: string;
  logo_url?: string | null;
  created_at: string;
};

export function useInsuranceCompanies() {
  const {
    data: companies,
    page,
    totalCount,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    isLoading: loading,
    refetch,
  } = usePaginatedQuery<InsuranceCompany>({
    queryKey: ['insurance_companies'],
    buildQuery: (client) =>
      client.from('insurance_companies')
        .select('*')
        .order('name', { ascending: true }),
    pageSize: 100,
  });

  return {
    companies,
    loading,
    page,
    totalCount,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    fetchCompanies: refetch,
  };
}
