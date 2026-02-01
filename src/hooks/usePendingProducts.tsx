import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export type ProductStatus = 'active' | 'pending' | 'rejected' | 'merged';
export type ProductSource = 'manual' | 'ia' | 'import';

export interface PendingProduct {
  id: string;
  name: string;
  detected_name: string | null;
  category: string;
  main_category: string;
  subcategory: string | null;
  company_id: string;
  status: ProductStatus;
  source: ProductSource;
  source_scan_id: string | null;
  created_at: string;
  company?: {
    id: string;
    name: string;
    logo_url: string | null;
  };
}

export interface ActiveProduct {
  id: string;
  name: string;
  company_id: string;
  company?: {
    id: string;
    name: string;
  };
}

export function usePendingProducts() {
  const [pendingProducts, setPendingProducts] = useState<PendingProduct[]>([]);
  const [activeProducts, setActiveProducts] = useState<ActiveProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchPendingProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('insurance_products' as any)
        .select(`
          id,
          name,
          detected_name,
          category,
          main_category,
          subcategory,
          company_id,
          status,
          source,
          source_scan_id,
          created_at,
          company:insurance_companies!company_id (
            id,
            name,
            logo_url
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setPendingProducts((data as any) || []);
    } catch (err: any) {
      console.error('Error fetching pending products:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchActiveProducts = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('insurance_products' as any)
        .select(`
          id,
          name,
          company_id,
          company:insurance_companies!company_id (
            id,
            name
          )
        `)
        .eq('status', 'active')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (fetchError) throw fetchError;
      setActiveProducts((data as any) || []);
    } catch (err: any) {
      console.error('Error fetching active products:', err);
    }
  }, []);

  useEffect(() => {
    fetchPendingProducts();
    fetchActiveProducts();
  }, [fetchPendingProducts, fetchActiveProducts]);

  const validateProduct = async (productId: string, newName?: string): Promise<boolean> => {
    try {
      const { error } = await supabase.rpc('validate_candidate_product', {
        p_product_id: productId,
        p_new_name: newName || null,
        p_user_id: user?.id || null,
        p_add_alias: true
      });

      if (error) throw error;

      toast({
        title: "Produit validé",
        description: "Le produit a été ajouté au catalogue officiel",
      });

      await fetchPendingProducts();
      await fetchActiveProducts();
      return true;
    } catch (err: any) {
      console.error('Error validating product:', err);
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive"
      });
      return false;
    }
  };

  const mergeProduct = async (candidateId: string, targetProductId: string): Promise<boolean> => {
    try {
      const { error } = await supabase.rpc('merge_candidate_product', {
        p_candidate_id: candidateId,
        p_target_product_id: targetProductId,
        p_user_id: user?.id || null
      });

      if (error) throw error;

      toast({
        title: "Produit fusionné",
        description: "Le nom détecté a été ajouté comme alias du produit existant",
      });

      await fetchPendingProducts();
      return true;
    } catch (err: any) {
      console.error('Error merging product:', err);
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive"
      });
      return false;
    }
  };

  const rejectProduct = async (productId: string): Promise<boolean> => {
    try {
      const { error } = await supabase.rpc('reject_candidate_product', {
        p_product_id: productId,
        p_user_id: user?.id || null
      });

      if (error) throw error;

      toast({
        title: "Produit rejeté",
        description: "Le produit candidat a été rejeté",
      });

      await fetchPendingProducts();
      return true;
    } catch (err: any) {
      console.error('Error rejecting product:', err);
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive"
      });
      return false;
    }
  };

  return {
    pendingProducts,
    activeProducts,
    loading,
    error,
    fetchPendingProducts,
    validateProduct,
    mergeProduct,
    rejectProduct,
  };
}
