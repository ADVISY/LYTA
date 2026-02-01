import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type ProductMainCategory = 'VIE' | 'LCA' | 'NON_VIE' | 'HYPO';

export interface ProductAlias {
  id: string;
  product_id: string;
  alias: string;
  language: string;
  created_at: string;
}

export interface InsuranceProductExtended {
  id: string;
  name: string;
  category: string;
  main_category: ProductMainCategory;
  subcategory: string | null;
  company_id: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  company?: {
    id: string;
    name: string;
    logo_url: string | null;
  };
  aliases?: ProductAlias[];
}

export function useProductCatalog(companyId?: string) {
  const [products, setProducts] = useState<InsuranceProductExtended[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('insurance_products' as any)
        .select(`
          *,
          company:insurance_companies!company_id (
            id,
            name,
            logo_url
          ),
          aliases:product_aliases (
            id,
            alias,
            language,
            created_at
          )
        `)
        .eq('status', 'active') // Only show active products in catalog
        .order('name', { ascending: true });

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setProducts((data as any) || []);
    } catch (err: any) {
      console.error('Error fetching products:', err);
      setError(err.message);
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [companyId, toast]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const createProduct = async (product: {
    name: string;
    company_id: string;
    category: string;
    main_category: ProductMainCategory;
    subcategory?: string;
    description?: string;
    aliases?: string[];
  }): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('insurance_products' as any)
        .insert({
          name: product.name,
          company_id: product.company_id,
          category: product.category,
          main_category: product.main_category,
          subcategory: product.subcategory || null,
          description: product.description || null,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      const productId = (data as any).id;

      // Add aliases if provided
      if (product.aliases && product.aliases.length > 0) {
        const aliasRecords = product.aliases.map(alias => ({
          product_id: productId,
          alias: alias.trim(),
          language: 'fr',
        }));

        await supabase
          .from('product_aliases' as any)
          .insert(aliasRecords);
      }

      toast({
        title: "Produit créé",
        description: `${product.name} a été ajouté au catalogue`,
      });

      await fetchProducts();
      return productId;
    } catch (err: any) {
      console.error('Error creating product:', err);
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive"
      });
      return null;
    }
  };

  const updateProduct = async (
    productId: string,
    updates: Partial<{
      name: string;
      category: string;
      main_category: ProductMainCategory;
      subcategory: string;
      description: string;
      is_active: boolean;
    }>
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('insurance_products' as any)
        .update(updates)
        .eq('id', productId);

      if (error) throw error;

      toast({
        title: "Produit modifié",
      });

      await fetchProducts();
      return true;
    } catch (err: any) {
      console.error('Error updating product:', err);
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive"
      });
      return false;
    }
  };

  const deleteProduct = async (productId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('insurance_products' as any)
        .delete()
        .eq('id', productId);

      if (error) throw error;

      toast({
        title: "Produit supprimé",
      });

      await fetchProducts();
      return true;
    } catch (err: any) {
      console.error('Error deleting product:', err);
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive"
      });
      return false;
    }
  };

  const addAlias = async (productId: string, alias: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('product_aliases' as any)
        .insert({
          product_id: productId,
          alias: alias.trim(),
          language: 'fr',
        });

      if (error) throw error;

      toast({
        title: "Alias ajouté",
      });

      await fetchProducts();
      return true;
    } catch (err: any) {
      console.error('Error adding alias:', err);
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive"
      });
      return false;
    }
  };

  const removeAlias = async (aliasId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('product_aliases' as any)
        .delete()
        .eq('id', aliasId);

      if (error) throw error;

      await fetchProducts();
      return true;
    } catch (err: any) {
      console.error('Error removing alias:', err);
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive"
      });
      return false;
    }
  };

  return {
    products,
    loading,
    error,
    fetchProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    addAlias,
    removeAlias,
  };
}
