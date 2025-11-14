import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  const [products, setProducts] = useState<InsuranceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchProducts = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('insurance_products' as any)
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

      const { data, error } = await query;

      if (error) throw error;
      setProducts((data as any) || []);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [companyId]);

  return {
    products,
    loading,
    fetchProducts
  };
}
