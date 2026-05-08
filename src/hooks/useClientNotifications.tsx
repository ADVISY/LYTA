import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserTenant } from '@/hooks/useUserTenant';

const CLIENT_NOTIFICATION_KINDS = ['contract', 'document', 'invoice', 'claim', 'message'];

export interface ClientNotification {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  message: string | null;
  payload: any;
  read_at: string | null;
  created_at: string;
  tenant_id?: string | null;
}

export const useClientNotifications = () => {
  const [notifications, setNotifications] = useState<ClientNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { tenantId, loading: tenantLoading } = useUserTenant();

  const fetchNotifications = async () => {
    if (!user) return;

    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .in('kind', CLIENT_NOTIFICATION_KINDS)
        .order('created_at', { ascending: false })
        .limit(50);

      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query;

      if (import.meta.env.DEV) {
        console.log('[useClientNotifications] fetch', {
          userId: user.id,
          tenantId,
          tenantLoading,
          rowsReturned: data?.length ?? 0,
          error: error?.message,
        });
      }

      if (error) throw error;

      setNotifications(data || []);
      setUnreadCount((data || []).filter(n => !n.read_at).length);
    } catch (error) {
      console.error('Error fetching client notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId);

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      let query = supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .in('kind', CLIENT_NOTIFICATION_KINDS)
        .is('read_at', null);

      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      await query;

      setNotifications(prev =>
        prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  useEffect(() => {
    if (tenantLoading) return;
    fetchNotifications();
  }, [user, tenantId, tenantLoading]);

  useEffect(() => {
    if (!user || tenantLoading) return;

    const channel = supabase
      .channel(`client-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification = payload.new as ClientNotification;
          if (
            CLIENT_NOTIFICATION_KINDS.includes(newNotification.kind) &&
            (!tenantId || !newNotification.tenant_id || newNotification.tenant_id === tenantId)
          ) {
            setNotifications(prev => [newNotification, ...prev]);
            setUnreadCount(prev => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [user, tenantId, tenantLoading]);

  return {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  };
};
