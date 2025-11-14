import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";

export interface Agent {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

export function useAgents() {
  const { toast } = useToast();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAgents() {
      try {
        setLoading(true);
        
        // Récupérer les IDs des utilisateurs avec rôle agent ou manager
        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('user_id')
          .in('role', ['agent', 'manager', 'admin']);

        if (roleError) throw roleError;

        const userIds = roleData.map(r => r.user_id);

        if (userIds.length === 0) {
          setAgents([]);
          return;
        }

        // Récupérer les profils correspondants
        const { data, error } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('id', userIds)
          .order('first_name', { ascending: true });

        if (error) throw error;
        setAgents(data || []);
      } catch (error: any) {
        toast({
          title: "Erreur",
          description: error.message,
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    }

    fetchAgents();
  }, []);

  return { agents, loading };
}
