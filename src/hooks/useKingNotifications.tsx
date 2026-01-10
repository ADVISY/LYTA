import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface KingNotification {
  id: string;
  title: string;
  message: string | null;
  kind: string;
  priority: string;
  tenant_id: string | null;
  tenant_name: string | null;
  action_url: string | null;
  action_label: string | null;
  metadata: Record<string, unknown>;
  read_at: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

export function useKingNotifications() {
  const queryClient = useQueryClient();

  const { data: notifications, isLoading, refetch } = useQuery({
    queryKey: ['king-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('king_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching king notifications:', error);
        throw error;
      }

      return (data || []) as KingNotification[];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const unreadCount = notifications?.filter(n => !n.read_at).length || 0;

  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('king_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['king-notifications'] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('king_notifications')
        .update({ read_at: new Date().toISOString() })
        .is('read_at', null);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['king-notifications'] });
    },
  });

  const markAsResolved = useMutation({
    mutationFn: async (notificationId: string) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const { error } = await supabase
        .from('king_notifications')
        .update({ 
          resolved_at: new Date().toISOString(),
          resolved_by: sessionData.session?.user?.id,
          read_at: new Date().toISOString(),
        })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['king-notifications'] });
    },
  });

  return {
    notifications: notifications || [],
    isLoading,
    unreadCount,
    refetch,
    markAsRead: (id: string) => markAsRead.mutate(id),
    markAllAsRead: () => markAllAsRead.mutate(),
    markAsResolved: (id: string) => markAsResolved.mutate(id),
  };
}

export function useKingAuditLogs() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['king-audit-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('king_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching king audit logs:', error);
        throw error;
      }

      return data || [];
    },
    refetchInterval: 60000,
  });

  return { logs: logs || [], isLoading };
}
