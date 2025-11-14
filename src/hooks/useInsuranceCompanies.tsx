import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type InsuranceCompany = {
  id: string;
  name: string;
  logo_url?: string | null;
  created_at: string;
};

export function useInsuranceCompanies() {
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('insurance_companies' as any)
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setCompanies((data as any) || []);
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
    fetchCompanies();
  }, []);

  return {
    companies,
    loading,
    fetchCompanies
  };
}
