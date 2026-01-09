import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserTenant } from '@/hooks/useUserTenant';

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

      // Get tenant seat info
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

      // Count active users in the tenant
      const { count, error: countError } = await supabase
        .from('user_tenant_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

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
