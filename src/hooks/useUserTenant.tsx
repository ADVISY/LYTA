import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/hooks/useAuth';

/**
 * Hook centralisé pour récupérer le tenant_id effectif de l'utilisateur.
 * Combine le tenant du contexte (sous-domaine) avec l'assignation en base.
 * 
 * Priorité:
 * 1. Tenant du contexte (si accès via sous-domaine ex: advisy.lyta.ch)
 * 2. Tenant assigné à l'utilisateur en base de données
 */
export function useUserTenant() {
  const { tenantId: contextTenantId } = useTenant();
  const { user } = useAuth();
  const [userTenantId, setUserTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserTenant = async () => {
      if (!user) {
        setUserTenantId(null);
        setLoading(false);
        return;
      }

      try {
        const { data } = await supabase
          .from('user_tenant_assignments')
          .select('tenant_id')
          .eq('user_id', user.id)
          .not('tenant_id', 'is', null)
          .limit(1)
          .maybeSingle();

        setUserTenantId(data?.tenant_id || null);
      } catch (error) {
        console.error('Error fetching user tenant:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserTenant();
  }, [user]);

  // Le tenant du contexte (sous-domaine) a priorité sur l'assignation utilisateur
  const effectiveTenantId = contextTenantId || userTenantId;

  return {
    tenantId: effectiveTenantId,
    contextTenantId,
    userTenantId,
    loading,
    hasTenant: !!effectiveTenantId
  };
}
