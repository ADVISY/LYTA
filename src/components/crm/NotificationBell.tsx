import { Bell, FileText, Check, Sparkles, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { fr, de, it, enUS } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import i18n from '@/i18n';

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
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();

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
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-semibold text-sm">{t("notifications.title")}</h4>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs h-7"
              onClick={markAllAsRead}
            >
              <Check className="h-3 w-3 mr-1" />
              {t("notifications.markAllRead")}
            </Button>
          )}
        </div>
        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              {t("notifications.noNotifications")}
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full p-3 text-left hover:bg-muted/50 transition-colors ${
                    !notification.read_at ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="flex gap-3">
                    <div className="mt-0.5">
                      {getNotificationIcon(notification)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notification.read_at ? 'font-semibold' : ''}`}>
                        {notification.title}
                      </p>
                      {notification.message && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {notification.message}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), { 
                          addSuffix: true,
                          locale: getDateLocale() 
                        })}
                      </p>
                    </div>
                    {!notification.read_at && (
                      <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
