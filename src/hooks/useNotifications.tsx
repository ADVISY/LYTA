import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserTenant } from '@/hooks/useUserTenant';

// CRM/Team notification kinds (NOT client notifications)
const CRM_NOTIFICATION_KINDS = [
  'new_contract', 'team_alert', 'task', 'reminder', 'system',
  'success', 'info', 'warning', 'error',
];

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
      // ─── Source 1 : table notifications (legacy) ─────────────────
      let oldQuery = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .in('kind', CRM_NOTIFICATION_KINDS)
        .order('created_at', { ascending: false })
        .limit(50);

      if (tenantId) {
        oldQuery = oldQuery.eq('tenant_id', tenantId);
      }

      const oldFetch = oldQuery;

      // ─── Source 2 : suivis kind='notification' (modèle unifié) ───
      const inboxBase: any = supabase.from('suivis');
      const inboxFetchPromise = tenantId
        ? inboxBase
            .select('id, title, description, status, completed_at, created_at, kind, related_kind, related_id, action_url, priority')
            .eq('tenant_id', tenantId)
            .eq('kind', 'notification')
            .or(`assigned_agent_id.eq.${user.id},assigned_agent_id.is.null`)
            .in('status', ['ouvert', 'open'])
            .order('created_at', { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [], error: null });

      const [oldRes, inboxRes] = await Promise.all([oldFetch, inboxFetchPromise]);

      const oldRows: Notification[] = (oldRes.data ?? []) as any;

      // Map les suivis vers la même forme que Notification (compatibilité UI)
      const inboxRows: Notification[] = ((inboxRes.data ?? []) as any[]).map(
        (row): Notification => ({
          id: row.id,
          user_id: user.id,
          kind: row.priority === 'urgent' || row.priority === 'high' ? 'warning' : 'info',
          title: row.title,
          message: row.description ?? null,
          payload: {
            action_url: row.action_url ?? undefined,
            related_kind: row.related_kind ?? undefined,
            related_id: row.related_id ?? undefined,
            from_suivis: true, // marker pour markAsRead
          },
          read_at: row.status === 'done' || row.completed_at ? row.completed_at : null,
          created_at: row.created_at,
          tenant_id: tenantId ?? null,
        })
      );

      // Merge + tri par date desc
      const merged = [...oldRows, ...inboxRows].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      if (import.meta.env.DEV) {
        console.log('[useNotifications CRM] fetch', {
          userId: user.id,
          tenantId,
          old: oldRows.length,
          inbox: inboxRows.length,
          total: merged.length,
        });
      }

      setNotifications(merged);
      setUnreadCount(merged.filter(n => !n.read_at).length);
    } catch (error) {
      console.error('Error fetching CRM notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      // Détecte si c'est une notif suivis ou legacy
      const target = notifications.find(n => n.id === notificationId);
      const isFromSuivis = !!target?.payload?.from_suivis;

      if (isFromSuivis) {
        // Marque comme done dans suivis
        await supabase
          .from('suivis')
          .update({ status: 'done', completed_at: new Date().toISOString() })
          .eq('id', notificationId);
      } else {
        // Vieille table notifications
        await supabase
          .from('notifications')
          .update({ read_at: new Date().toISOString() })
          .eq('id', notificationId);
      }

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
      // Marque les 2 sources en parallèle
      let oldQuery = supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .in('kind', CRM_NOTIFICATION_KINDS)
        .is('read_at', null);

      if (tenantId) {
        oldQuery = oldQuery.eq('tenant_id', tenantId);
      }

      // IDs des notifs suivis non lues qu'on a en mémoire
      const suivisIds = notifications
        .filter(n => n.payload?.from_suivis && !n.read_at)
        .map(n => n.id);

      const inboxBase: any = supabase.from('suivis');
      const inboxUpdate = suivisIds.length > 0
        ? inboxBase
            .update({ status: 'done', completed_at: new Date().toISOString() })
            .in('id', suivisIds)
        : Promise.resolve({ error: null });

      await Promise.all([oldQuery, inboxUpdate]);

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
