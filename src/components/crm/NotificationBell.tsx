import { useState } from 'react';
import { Bell, FileText, Check, Sparkles, AlertTriangle, Clock, MoreVertical, UserPlus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '@/hooks/useNotifications';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { fr, de, it, enUS } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import i18n from '@/i18n';
import { AssignTaskFromNotificationDialog } from './AssignTaskFromNotificationDialog';
import { SwipeableNotificationRow } from './SwipeableNotificationRow';

const getDateLocale = () => {
  const lang = i18n.language;
  switch (lang) {
    case 'de': return de;
    case 'it': return it;
    case 'en': return enUS;
    default: return fr;
  }
};

export const NotificationBell = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { notifications, unreadCount, markAsRead, markAllAsRead, fetchNotifications } = useNotifications();
  const navigate = useNavigate();

  // État pour la modale "Convertir en tâche"
  const [assignTaskNotif, setAssignTaskNotif] = useState<any | null>(null);

  const handleNotificationClick = (notification: any) => {
    markAsRead(notification.id);

    // Check for action_url first (used by IA Scan notifications)
    if (notification.payload?.action_url) {
      navigate(notification.payload.action_url);
      return;
    }

    // Fallback to client navigation for new_contract
    if (notification.kind === 'new_contract' && notification.payload?.client_id) {
      navigate(`/crm/clients/${notification.payload.client_id}`);
    }
  };

  // Supprimer / archiver une notification
  const handleDeleteNotification = async (notif: any) => {
    try {
      const isFromSuivis = !!notif.payload?.from_suivis;
      if (isFromSuivis) {
        // Suivis : on archive (pas DELETE pour garder traçabilité)
        await supabase
          .from('suivis')
          .update({ status: 'archived', completed_at: new Date().toISOString() })
          .eq('id', notif.id);
      } else {
        // Legacy : on mark as read
        await supabase
          .from('notifications')
          .update({ read_at: new Date().toISOString() })
          .eq('id', notif.id);
      }
      toast({ title: 'Notification supprimée' });
      fetchNotifications();
    } catch (err: any) {
      toast({
        title: 'Erreur',
        description: err.message || 'Impossible de supprimer',
        variant: 'destructive',
      });
    }
  };

  const getNotificationIcon = (notification: any) => {
    // IA Scan notifications have scan_id in payload
    if (notification.payload?.scan_id) {
      const hasTermination = notification.payload?.has_termination;
      if (hasTermination) {
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      }
      return <Sparkles className="h-4 w-4 text-primary" />;
    }
    
    switch (notification.kind) {
      case 'new_contract':
        return <FileText className="h-4 w-4 text-primary" />;
      default:
        return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(24rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] p-0 z-50"
        align="end"
      >
        <div className="flex items-center justify-between p-3 border-b bg-background">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h4 className="font-semibold text-sm">{t("notifications.title")}</h4>
          </div>
          {unreadCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="h-5 min-w-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-medium">
                {unreadCount}
              </span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs h-7"
                onClick={markAllAsRead}
              >
                <Check className="h-3 w-3 mr-1" />
                {t("notifications.markAllRead")}
              </Button>
            </div>
          )}
        </div>
        <ScrollArea className="h-[350px]">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">
              <Bell className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
              {t("notifications.noNotifications")}
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <SwipeableNotificationRow
                  key={notification.id}
                  onSwipeRight={() => setAssignTaskNotif(notification)}
                  onSwipeLeft={() => handleDeleteNotification(notification)}
                >
                <div
                  className={cn(
                    "relative group hover:bg-muted/50 transition-colors",
                    !notification.read_at && "bg-primary/5"
                  )}
                >
                  <button
                    onClick={() => handleNotificationClick(notification)}
                    className="w-full p-2.5 text-left"
                  >
                    <div className="flex gap-2 pr-8">
                      <div className="mt-0.5 flex-shrink-0">
                        {getNotificationIcon(notification)}
                      </div>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <p className={cn(
                          "text-xs leading-snug line-clamp-2",
                          !notification.read_at && "font-semibold"
                        )}>
                          {notification.title}
                        </p>
                        {notification.message && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-snug">
                            {notification.message}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground/70 mt-1 flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {formatDistanceToNow(new Date(notification.created_at), {
                            addSuffix: true,
                            locale: getDateLocale()
                          })}
                        </p>
                      </div>
                      {!notification.read_at && (
                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                      )}
                    </div>
                  </button>

                  {/* Menu ⋮ d'actions sur chaque notif */}
                  <div className="absolute top-2 right-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Actions"
                        >
                          <MoreVertical className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-44"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenuItem
                          onClick={() => setAssignTaskNotif(notification)}
                        >
                          <UserPlus className="h-3.5 w-3.5 mr-2" />
                          <span className="text-xs">Convertir en tâche</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteNotification(notification)}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          <span className="text-xs">Supprimer</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                </SwipeableNotificationRow>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer : lien vers la page Suivis complète */}
        <div className="border-t bg-muted/30 p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center text-xs"
            onClick={() => navigate("/crm/suivis")}
          >
            Voir toutes mes tâches et rappels →
          </Button>
        </div>
      </PopoverContent>

      {/* Modale "Convertir en tâche" depuis une notif */}
      <AssignTaskFromNotificationDialog
        open={!!assignTaskNotif}
        onOpenChange={(open) => !open && setAssignTaskNotif(null)}
        notificationId={assignTaskNotif?.id ?? null}
        notificationTitle={assignTaskNotif?.title ?? ""}
        notificationMessage={assignTaskNotif?.message ?? ""}
        isFromSuivis={!!assignTaskNotif?.payload?.from_suivis}
        onAssigned={() => {
          fetchNotifications();
        }}
      />
    </Popover>
  );
};
