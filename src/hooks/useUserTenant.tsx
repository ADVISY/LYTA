import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/hooks/useAuth";

/**
 * Hook centralisé pour récupérer le tenant_id effectif de l'utilisateur.
 * Combine le tenant du contexte (sous-domaine) avec l'assignation en base.
 *
 * Priorité :
 * 1. Tenant du contexte (si accès via sous-domaine ex: advisy.lyta.ch)
 * 2. Tenant assigné à l'utilisateur en base de données
 *
 * PERF (juin 2026, JCG 928+ contacts) :
 * Avant : useEffect + useState → re-fetch à chaque mount, même quand le user
 * navigue d'une page à l'autre dans le même tenant. Sur JCG, ça ajoutait
 * une round-trip à chaque /crm/clients, /crm/pipeline, /crm/suivis…
 * Maintenant : useQuery avec staleTime 10 min — la 1re lookup met le
 * tenant en cache pour TOUTE la session de navigation. La query ne re-run
 * que si l'user change ou si on invalide explicitement.
 * API publique inchangée : { tenantId, contextTenantId, userTenantId, loading, hasTenant }.
 */
export function useUserTenant() {
  const { tenantId: contextTenantId } = useTenant();
  const { user } = useAuth();

  // On ne fait la requête DB que si le contexte (sous-domaine) ne donne pas
  // déjà un tenantId — le sous-domaine est ultra-prioritaire.
  const { data: userTenantId, isLoading } = useQuery({
    queryKey: ["user_tenant", user?.id ?? ""],
    enabled: !!user && !contextTenantId,
    staleTime: 10 * 60_000, // 10 min — le tenant assigné ne change pas pendant la session
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<string | null> => {
      try {
        const { data } = await supabase
          .from("user_tenant_assignments")
          .select("tenant_id")
          .eq("user_id", user!.id)
          .not("tenant_id", "is", null)
          .limit(1)
          .maybeSingle();
        return data?.tenant_id || null;
      } catch (error) {
        console.error("Error fetching user tenant:", error);
        return null;
      }
    },
  });

  const effectiveTenantId = contextTenantId || userTenantId || null;

  return {
    tenantId: effectiveTenantId,
    contextTenantId,
    userTenantId: userTenantId ?? null,
    // loading=true tant que la query tourne ET qu'on n'a pas de contextTenantId
    // de secours. Si contextTenantId est défini, on n'a pas besoin de wait.
    loading: !contextTenantId && isLoading,
    hasTenant: !!effectiveTenantId,
  };
}
