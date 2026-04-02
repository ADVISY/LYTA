import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePaginatedQuery } from './usePaginatedQuery';

export type InsuranceProduct = {
  id: string;
  name: string;
  category: string;
  company_id: string;
  description?: string | null;
  created_at: string;
  company?: {
    id: string;
    name: string;
    logo_url?: string | null;
  };
};

export function useInsuranceProducts(companyId?: string) {
  const { toast } = useToast();

  const { data: products, page, totalCount, totalPages, goToPage, nextPage, prevPage, isLoading: loading, isError, refetch } = usePaginatedQuery<InsuranceProduct>({
    queryKey: ['insurance_products', companyId ?? ''],
    buildQuery: (client) => {
      let query = client.from('insurance_products')
        .select(`
          *,
          company:insurance_companies!company_id (
            id,
            name,
            logo_url
          )
        `)
        .order('name', { ascending: true });

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      return query;
    },
    pageSize: 100,
  });

  return {
    products,
    loading,
    page,
    totalCount,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    fetchProducts: refetch
  };
}
