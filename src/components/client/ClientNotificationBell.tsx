import { Bell, FileText, FolderOpen, AlertTriangle, MessageCircle, Receipt, Check } from 'lucide-react';
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

const getNotificationIcon = (kind: string) => {
  switch (kind) {
    case 'contract':
      return <FileText className="h-4 w-4 text-blue-600" />;
    case 'document':
      return <FolderOpen className="h-4 w-4 text-emerald-600" />;
    case 'claim':
      return <AlertTriangle className="h-4 w-4 text-amber-600" />;
    case 'message':
      return <MessageCircle className="h-4 w-4 text-purple-600" />;
    case 'invoice':
      return <Receipt className="h-4 w-4 text-rose-600" />;
    default:
      return <Bell className="h-4 w-4 text-muted-foreground" />;
  }
};

export const ClientNotificationBell = () => {
  const { t } = useTranslation();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();

  const handleNotificationClick = (notification: any) => {
    markAsRead(notification.id);
    
    // Navigate based on notification type
    switch (notification.kind) {
      case 'contract':
        navigate('/espace-client/contrats');
        break;
      case 'document':
        navigate('/espace-client/documents');
        break;
      case 'claim':
        navigate('/espace-client/sinistres');
        break;
      case 'message':
        navigate('/espace-client/messages');
        break;
      case 'invoice':
        navigate('/espace-client/documents');
        break;
      default:
        navigate('/espace-client/notifications');
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-semibold animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-semibold text-sm">Notifications</h4>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs h-7 px-2"
              onClick={markAllAsRead}
            >
              <Check className="h-3 w-3 mr-1" />
              Tout lire
            </Button>
          )}
        </div>
        <ScrollArea className="h-[320px]">
          {notifications.length === 0 ? (
            <div className="p-6 text-center">
              <Bell className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Aucune notification
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.slice(0, 20).map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full p-3 text-left hover:bg-muted/50 transition-colors ${
                    !notification.read_at ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="flex gap-3">
                    <div className="mt-0.5 p-1.5 rounded-full bg-muted">
                      {getNotificationIcon(notification.kind)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-tight ${!notification.read_at ? 'font-semibold' : ''}`}>
                        {notification.title}
                      </p>
                      {notification.message && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), { 
                          addSuffix: true,
                          locale: getDateLocale() 
                        })}
                      </p>
                    </div>
                    {!notification.read_at && (
                      <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
        {notifications.length > 0 && (
          <div className="p-2 border-t">
            <Button 
              variant="ghost" 
              className="w-full text-xs h-8"
              onClick={() => navigate('/espace-client/notifications')}
            >
              Voir toutes les notifications
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
