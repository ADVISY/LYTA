import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserTenant } from './useUserTenant';
import { useToast } from './use-toast';

export type TenantBranch = {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  is_system: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type TenantBranchInput = {
  code: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  sort_order?: number;
};

/**
 * Hook to manage tenant-scoped insurance branches.
 *
 * Branches are the top-level categorization of insurance products
 * (LAMAL, LCA, VIE, AUTO, …). Each tenant gets the Swiss standard
 * 12 branches seeded automatically and can:
 *   - Toggle is_active (hide branches they don't sell)
 *   - Rename / re-color / re-icon
 *   - Add custom branches
 *   - Delete custom (non-system) branches
 */
export function useTenantBranches(options?: { includeInactive?: boolean }) {
  const { tenantId: effectiveTenantId, loading: tenantLoading } = useUserTenant();
  const { toast } = useToast();

  const [branches, setBranches] = useState<TenantBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBranches = useCallback(async () => {
    if (!effectiveTenantId) {
      setBranches([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let query = supabase
      .from('tenant_branches')
      .select('*')
      .eq('tenant_id', effectiveTenantId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (!options?.includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error: fetchError } = await query;
    if (fetchError) {
      setError(fetchError.message);
      setBranches([]);
    } else {
      setError(null);
      setBranches((data ?? []) as TenantBranch[]);
    }
    setLoading(false);
  }, [effectiveTenantId, options?.includeInactive]);

  useEffect(() => {
    if (tenantLoading) return;
    fetchBranches();
  }, [tenantLoading, fetchBranches]);

  const createBranch = useCallback(async (input: TenantBranchInput) => {
    if (!effectiveTenantId) {
      throw new Error('Aucun cabinet assigné');
    }
    const payload = {
      tenant_id: effectiveTenantId,
      code: input.code.toUpperCase().trim().replace(/\s+/g, '_'),
      name: input.name.trim(),
      description: input.description ?? null,
      icon: input.icon ?? 'Shield',
      color: input.color ?? '#64748b',
      sort_order: input.sort_order ?? 200,
      is_system: false,
      is_active: true,
    };
    const { data, error: createError } = await supabase
      .from('tenant_branches')
      .insert(payload)
      .select()
      .single();

    if (createError) {
      toast({
        title: 'Erreur',
        description: createError.message,
        variant: 'destructive',
      });
      throw createError;
    }
    toast({ title: 'Branche créée', description: `${payload.name} a été ajoutée.` });
    await fetchBranches();
    return data as TenantBranch;
  }, [effectiveTenantId, fetchBranches, toast]);

  const updateBranch = useCallback(async (id: string, patch: Partial<TenantBranchInput & { is_active: boolean }>) => {
    const cleanPatch: any = { ...patch };
    if (typeof cleanPatch.code === 'string') {
      cleanPatch.code = cleanPatch.code.toUpperCase().trim().replace(/\s+/g, '_');
    }
    if (typeof cleanPatch.name === 'string') {
      cleanPatch.name = cleanPatch.name.trim();
    }
    const { error: updateError } = await supabase
      .from('tenant_branches')
      .update(cleanPatch)
      .eq('id', id);

    if (updateError) {
      toast({
        title: 'Erreur',
        description: updateError.message,
        variant: 'destructive',
      });
      throw updateError;
    }
    await fetchBranches();
  }, [fetchBranches, toast]);

  const toggleActive = useCallback(async (id: string, isActive: boolean) => {
    return updateBranch(id, { is_active: isActive });
  }, [updateBranch]);

  const deleteBranch = useCallback(async (id: string) => {
    const { error: deleteError } = await supabase
      .from('tenant_branches')
      .delete()
      .eq('id', id);
    if (deleteError) {
      toast({
        title: 'Impossible de supprimer',
        description: deleteError.message.includes('is_system')
          ? 'Les branches standard ne peuvent être que désactivées.'
          : deleteError.message,
        variant: 'destructive',
      });
      throw deleteError;
    }
    toast({ title: 'Branche supprimée' });
    await fetchBranches();
  }, [fetchBranches, toast]);

  return {
    branches,
    loading: loading || tenantLoading,
    error,
    refetch: fetchBranches,
    createBranch,
    updateBranch,
    toggleActive,
    deleteBranch,
  };
}
