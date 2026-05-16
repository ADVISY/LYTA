import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePaginatedQuery } from './usePaginatedQuery';

export type ProductMainCategory = 'VIE' | 'LCA' | 'NON_VIE' | 'HYPO';

export interface ProductAlias {
  id: string;
  product_id: string;
  alias: string;
  language: string;
  created_at: string;
}

export type BranchCode =
  | 'AUTO' | 'LAMAL' | 'LCA' | 'PGM' | 'ACCIDENT'
  | 'VIE' | 'LPP' | 'HYPO_CREDIT'
  | 'MENAGE_RC' | 'JURIDIQUE' | 'VOYAGE' | 'ENTREPRISE';

export const BRANCH_CODES: BranchCode[] = [
  'AUTO','LAMAL','LCA','PGM','ACCIDENT',
  'VIE','LPP','HYPO_CREDIT',
  'MENAGE_RC','JURIDIQUE','VOYAGE','ENTREPRISE',
];

export const BRANCH_LABELS: Record<BranchCode, string> = {
  AUTO: 'Auto / Moto',
  LAMAL: 'LAMal',
  LCA: 'Complémentaire',
  PGM: 'Perte de gain',
  ACCIDENT: 'Accident',
  VIE: 'Vie / Prévoyance',
  LPP: '2e pilier (LPP)',
  HYPO_CREDIT: 'Hypothèque / Crédit',
  MENAGE_RC: 'Ménage / RC',
  JURIDIQUE: 'Juridique',
  VOYAGE: 'Voyage',
  ENTREPRISE: 'Entreprise',
};

export interface InsuranceProductExtended {
  id: string;
  name: string;
  category: string;
  main_category: ProductMainCategory;
  subcategory: string | null;
  branch_code: BranchCode | null;
  company_id: string;
  description: string | null;
  is_active: boolean;
  status: string;          // 'active' | 'pending'
  tenant_id: string | null; // NULL = système / verrouillé pour les tenants
  created_at: string;
  company?: {
    id: string;
    name: string;
    logo_url: string | null;
    tenant_id: string | null;
  };
  aliases?: ProductAlias[];
}

export interface ProductCatalogFilters {
  statusFilter?: 'active' | 'pending' | 'all';
}

export function useProductCatalog(companyId?: string, filters?: ProductCatalogFilters) {
  const { toast } = useToast();
  const statusFilter = filters?.statusFilter ?? 'active';

  const { data: products, page, totalCount, totalPages, goToPage, nextPage, prevPage, isLoading: loading, isError, refetch } = usePaginatedQuery<InsuranceProductExtended>({
    queryKey: ['product_catalog', companyId ?? '', statusFilter],
    buildQuery: (client) => {
      let query = client.from('insurance_products')
        .select(`
          *,
          company:insurance_companies!company_id (
            id,
            name,
            logo_url,
            tenant_id
          ),
          aliases:product_aliases (
            id,
            alias,
            language,
            created_at
          )
        `)
        .order('name', { ascending: true });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      return query;
    },
    pageSize: 100,
  });

  const error: string | null = isError ? 'Erreur lors du chargement du catalogue' : null;

  const createProduct = async (product: {
    name: string;
    company_id: string;
    category: string;
    main_category: ProductMainCategory;
    subcategory?: string;
    description?: string;
    aliases?: string[];
    branch_code?: BranchCode | null;
  }): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('insurance_products')
        .insert({
          name: product.name,
          company_id: product.company_id,
          category: product.category,
          main_category: product.main_category,
          subcategory: product.subcategory || null,
          description: product.description || null,
          branch_code: product.branch_code ?? null,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      const productId = (data as { id: string }).id;

      // Add aliases if provided
      if (product.aliases && product.aliases.length > 0) {
        const aliasRecords = product.aliases.map(alias => ({
          product_id: productId,
          alias: alias.trim(),
          language: 'fr',
        }));

        await supabase
          .from('product_aliases')
          .insert(aliasRecords);
      }

      toast({
        title: "Produit créé",
        description: `${product.name} a été ajouté au catalogue`,
      });

      refetch();
      return productId;
    } catch (err: unknown) {
      console.error('Error creating product:', err);
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : String(err),
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
      branch_code: BranchCode | null;
      status: 'active' | 'pending';
      company_id: string;
    }>
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('insurance_products')
        .update(updates)
        .eq('id', productId);

      if (error) throw error;

      toast({
        title: "Produit modifié",
      });

      refetch();
      return true;
    } catch (err: unknown) {
      console.error('Error updating product:', err);
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive"
      });
      return false;
    }
  };

  const deleteProduct = async (productId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('insurance_products')
        .delete()
        .eq('id', productId);

      if (error) throw error;

      toast({
        title: "Produit supprimé",
      });

      refetch();
      return true;
    } catch (err: unknown) {
      console.error('Error deleting product:', err);
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive"
      });
      return false;
    }
  };

  const addAlias = async (productId: string, alias: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('product_aliases')
        .insert({
          product_id: productId,
          alias: alias.trim(),
          language: 'fr',
        });

      if (error) throw error;

      toast({
        title: "Alias ajouté",
      });

      refetch();
      return true;
    } catch (err: unknown) {
      console.error('Error adding alias:', err);
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive"
      });
      return false;
    }
  };

  const removeAlias = async (aliasId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('product_aliases')
        .delete()
        .eq('id', aliasId);

      if (error) throw error;

      refetch();
      return true;
    } catch (err: unknown) {
      console.error('Error removing alias:', err);
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive"
      });
      return false;
    }
  };

  return {
    products,
    loading,
    error,
    page,
    totalCount,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    fetchProducts: refetch,
    createProduct,
    updateProduct,
    deleteProduct,
    addAlias,
    removeAlias,
  };
}
