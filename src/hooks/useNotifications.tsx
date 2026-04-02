import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserTenant } from '@/hooks/useUserTenant';

// CRM/Team notification kinds (NOT client notifications)
const CRM_NOTIFICATION_KINDS = ['new_contract', 'team_alert', 'task', 'reminder', 'system'];

export interface Notification {
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

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { tenantId } = useUserTenant();

  const fetchNotifications = async () => {
    if (!user) return;
    
    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .in('kind', CRM_NOTIFICATION_KINDS)
        .order('created_at', { ascending: false })
        .limit(50);

      // Filter by tenant if available
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      setNotifications(data || []);
      setUnreadCount((data || []).filter(n => !n.read_at).length);
    } catch (error) {
      console.error('Error fetching CRM notifications:', error);
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
        .in('kind', CRM_NOTIFICATION_KINDS)
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
    if (tenantId !== undefined) {
      fetchNotifications();
    }
  }, [user, tenantId]);

  // Subscribe to real-time notifications
  useEffect(() => {
    if (user && tenantId) {
      const channel = supabase
        .channel(`crm-notifications-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            const newNotification = payload.new as Notification;
            // Only add if it's a CRM notification kind and matches tenant
            if (
              CRM_NOTIFICATION_KINDS.includes(newNotification.kind) &&
              (!tenantId || newNotification.tenant_id === tenantId)
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
    }
  }, [user, tenantId]);

  return {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead
  };
};
