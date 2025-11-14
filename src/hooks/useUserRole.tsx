import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

type UserRole = 'admin' | 'partner' | 'client' | null;

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRole() {
      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (error) throw error;
        setRole(data?.role as UserRole);
      } catch (error) {
        console.error('Error fetching user role:', error);
        setRole('client'); // Default to client
      } finally {
        setLoading(false);
      }
    }

    fetchRole();
  }, [user]);

  return { role, loading, isAdmin: role === 'admin', isPartner: role === 'partner', isClient: role === 'client' };
}
