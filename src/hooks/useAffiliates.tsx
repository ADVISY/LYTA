import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePaginatedQuery } from './usePaginatedQuery';

export type Affiliate = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  commission_rate: number;
  ref_code: string | null;
  default_eligibility_months: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type AffiliateCommission = {
  id: string;
  affiliate_id: string;
  tenant_id: string;
  payment_id: string;
  payment_amount: number;
  commission_rate: number;
  commission_amount: number;
  payment_date: string;
  status: string;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  tenant?: {
    id: string;
    name: string;
    slug: string;
    status: string;
    activated_at: string | null;
  };
  affiliate?: Affiliate;
};

export type AffiliateWithStats = Affiliate & {
  tenants_count: number;
  total_commissions: number;
  total_due: number;
  total_paid: number;
};

export function useAffiliates() {
  const { toast } = useToast();

  const {
    data: affiliates,
    page,
    totalCount,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    isLoading: loading,
    refetch,
  } = usePaginatedQuery<Affiliate>({
    queryKey: ['affiliates'],
    buildQuery: (client) =>
      client.from('affiliates').select('*').order('created_at', { ascending: false }),
    pageSize: 50,
  });

  const createAffiliate = async (data: Omit<Affiliate, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data: newAffiliate, error } = await supabase
        .from('affiliates')
        .insert([data])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Affilié créé",
        description: `${data.first_name} ${data.last_name} a été ajouté avec succès`
      });

      refetch();
      return newAffiliate;
    } catch (error: any) {
      console.error('Error creating affiliate:', error);
      toast({
        title: "Erreur",
        description: error.message?.includes('unique')
          ? "Cet email est déjà utilisé par un autre affilié"
          : "Impossible de créer l'affilié",
        variant: "destructive"
      });
      throw error;
    }
  };

  const updateAffiliate = async (id: string, updates: Partial<Affiliate>) => {
    try {
      const { error } = await supabase
        .from('affiliates')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Affilié mis à jour",
        description: "Les modifications ont été enregistrées"
      });

      refetch();
    } catch (error: any) {
      console.error('Error updating affiliate:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour l'affilié",
        variant: "destructive"
      });
      throw error;
    }
  };

  const deleteAffiliate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('affiliates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Affilié supprimé",
        description: "L'affilié a été supprimé avec succès"
      });

      refetch();
    } catch (error: any) {
      console.error('Error deleting affiliate:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer l'affilié",
        variant: "destructive"
      });
      throw error;
    }
  };

  const getActiveAffiliates = useCallback(() => {
    return affiliates.filter(a => a.status === 'active');
  }, [affiliates]);

  return {
    affiliates,
    loading,
    page,
    totalCount,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    fetchAffiliates: refetch,
    createAffiliate,
    updateAffiliate,
    deleteAffiliate,
    getActiveAffiliates
  };
}

export function useAffiliateCommissions(affiliateId?: string) {
  const { toast } = useToast();

  const {
    data: commissions,
    page,
    totalCount,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    isLoading: loading,
    refetch,
  } = usePaginatedQuery<AffiliateCommission>({
    queryKey: ['affiliate_commissions', affiliateId ?? ''],
    buildQuery: (client) => {
      let query = client
        .from('affiliate_commissions')
        .select(`
          *,
          tenant:tenants!tenant_id (
            id,
            name,
            slug,
            status,
            activated_at
          ),
          affiliate:affiliates!affiliate_id (*)
        `)
        .order('payment_date', { ascending: false });

      if (affiliateId) {
        query = query.eq('affiliate_id', affiliateId);
      }

      return query;
    },
    pageSize: 50,
  });

  const markAsPaid = async (ids: string[], paidAt?: Date) => {
    try {
      const { error } = await supabase
        .from('affiliate_commissions')
        .update({
          status: 'paid',
          paid_at: (paidAt || new Date()).toISOString()
        })
        .in('id', ids);

      if (error) throw error;

      toast({
        title: "Commissions payées",
        description: `${ids.length} commission(s) marquée(s) comme payée(s)`
      });

      refetch();
    } catch (error: any) {
      console.error('Error marking commissions as paid:', error);
      toast({
        title: "Erreur",
        description: "Impossible de marquer les commissions comme payées",
        variant: "destructive"
      });
      throw error;
    }
  };

  const cancelCommission = async (id: string, reason?: string) => {
    try {
      const { error } = await supabase
        .from('affiliate_commissions')
        .update({
          status: 'cancelled',
          notes: reason || 'Annulée'
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Commission annulée",
        description: "La commission a été annulée"
      });

      refetch();
    } catch (error: any) {
      console.error('Error cancelling commission:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'annuler la commission",
        variant: "destructive"
      });
      throw error;
    }
  };

  return {
    commissions,
    loading,
    page,
    totalCount,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    fetchCommissions: refetch,
    markAsPaid,
    cancelCommission
  };
}

export function useAffiliateStats() {
  const { data, isLoading: loading } = useQuery({
    queryKey: ['affiliate_stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_affiliate_stats');
      if (error) throw error;
      return data;
    },
  });

  const stats = {
    totalAffiliates: data?.total_affiliates ?? 0,
    activeAffiliates: data?.active_affiliates ?? 0,
    totalTenants: data?.total_tenants ?? 0,
    totalCommissionsGenerated: data?.total_commissions_generated ?? 0,
    totalDue: data?.total_due ?? 0,
    totalPaid: data?.total_paid ?? 0,
    activeCommissions: data?.active_commissions ?? 0,
    completedCommissions: data?.completed_commissions ?? 0,
  };

  const affiliatesWithStats: AffiliateWithStats[] = data?.affiliates_with_stats ?? [];

  return {
    stats,
    affiliatesWithStats,
    loading,
    refetch: () => {},
  };
}
