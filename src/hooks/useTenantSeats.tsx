import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserTenant } from '@/hooks/useUserTenant';

interface TenantSeatSummaryRow {
  seats_included: number | null;
  extra_users: number | null;
  total_seats: number | null;
  active_users: number | null;
  available_seats: number | null;
  seat_price: number | null;
}

interface TenantSeatsData {
  /** Number of seats included in the plan */
  seatsIncluded: number;
  /** Number of extra paid seats */
  extraUsers: number;
  /** Total available seats (included + extra) */
  totalSeats: number;
  /** Number of active users in the tenant */
  activeUsers: number;
  /** Number of available seats left */
  availableSeats: number;
  /** Whether the tenant can add a new user */
  canAddUser: boolean;
  /** Price per extra seat */
  seatPrice: number;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Refresh data */
  refresh: () => Promise<void>;
}

export function useTenantSeats(): TenantSeatsData {
  const { tenantId, loading: tenantLoading } = useUserTenant();
  const [seatsIncluded, setSeatsIncluded] = useState(1);
  const [extraUsers, setExtraUsers] = useState(0);
  const [seatPrice, setSeatPrice] = useState(20);
  const [activeUsers, setActiveUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: seatSummary, error: seatSummaryError } = await supabase
        .rpc('get_tenant_seat_summary', { p_tenant_id: tenantId });

      if (!seatSummaryError) {
        const summary = (Array.isArray(seatSummary) ? seatSummary[0] : null) as TenantSeatSummaryRow | null;

        if (summary) {
          setSeatsIncluded(summary.seats_included ?? 1);
          setExtraUsers(summary.extra_users ?? 0);
          setSeatPrice(summary.seat_price ?? 20);
          setActiveUsers(summary.active_users ?? 0);
          return;
        }
      } else {
        console.warn('Tenant seat summary RPC failed, using fallback:', seatSummaryError);
      }

      // Fallback for environments where the latest migration is not deployed yet.
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('seats_included, extra_users, seats_price')
        .eq('id', tenantId)
        .maybeSingle();

      if (tenantError) {
        throw new Error('Erreur lors du chargement des informations du tenant');
      }

      if (tenant) {
        setSeatsIncluded(tenant.seats_included || 1);
        setExtraUsers(tenant.extra_users || 0);
        setSeatPrice(tenant.seats_price || 20);
      }

      // Count collaborator accounts that consume seats.
      const { count, error: countError } = await supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('type_adresse', 'collaborateur')
        .not('user_id', 'is', null);

      if (countError) {
        throw new Error('Erreur lors du comptage des utilisateurs');
      }

      setActiveUsers(count || 0);
    } catch (err) {
      console.error('Error fetching tenant seats:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (!tenantLoading) {
      fetchData();
    }
  }, [tenantId, tenantLoading, fetchData]);

  useEffect(() => {
    if (!tenantId || tenantLoading) return;

    const channel = supabase
      .channel(`tenant-seats-${tenantId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tenants', filter: `id=eq.${tenantId}` },
        () => void fetchData(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tenant_limits', filter: `tenant_id=eq.${tenantId}` },
        () => void fetchData(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_tenant_assignments', filter: `tenant_id=eq.${tenantId}` },
        () => void fetchData(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tenantId, tenantLoading, fetchData]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleFocus = () => {
      void fetchData();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchData]);

  const totalSeats = seatsIncluded + extraUsers;
  const availableSeats = totalSeats - activeUsers;
  const canAddUser = availableSeats > 0;

  return {
    seatsIncluded,
    extraUsers,
    totalSeats,
    activeUsers,
    availableSeats,
    canAddUser,
    seatPrice,
    loading: loading || tenantLoading,
    error,
    refresh: fetchData,
  };
}
