import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bell,
  CheckCircle2,
  CreditCard,
  AlertTriangle,
  Building2,
  TrendingUp,
  XCircle,
  Clock,
  CheckCheck,
  ExternalLink,
  Filter,
} from "lucide-react";
import { useKingNotifications, KingNotification } from "@/hooks/useKingNotifications";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

const KIND_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  payment_received: { icon: CreditCard, color: 'text-emerald-500', label: 'Paiement' },
  payment_failed: { icon: AlertTriangle, color: 'text-red-500', label: 'Échec paiement' },
  new_request: { icon: Building2, color: 'text-blue-500', label: 'Demande' },
  tenant_activated: { icon: CheckCircle2, color: 'text-emerald-500', label: 'Activation' },
  upgrade_requested: { icon: TrendingUp, color: 'text-purple-500', label: 'Upgrade' },
  subscription_cancelled: { icon: XCircle, color: 'text-red-500', label: 'Annulation' },
  error: { icon: AlertTriangle, color: 'text-red-500', label: 'Erreur' },
  info: { icon: Bell, color: 'text-blue-500', label: 'Info' },
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  normal: 'bg-blue-500',
  low: 'bg-slate-400',
};

interface NotificationItemProps {
  notification: KingNotification;
  onMarkAsRead: (id: string) => void;
  onMarkAsResolved: (id: string) => void;
  onNavigate: (url: string) => void;
}

function NotificationItem({ notification, onMarkAsRead, onMarkAsResolved, onNavigate }: NotificationItemProps) {
  const config = KIND_CONFIG[notification.kind] || KIND_CONFIG.info;
  const Icon = config.icon;
  const isUnread = !notification.read_at;
  const isResolved = !!notification.resolved_at;

  return (
    <div 
      className={cn(
        "p-4 border-b last:border-b-0 hover:bg-muted/50 transition-colors",
        isUnread && "bg-primary/5",
        isResolved && "opacity-60"
      )}
    >
      <div className="flex gap-3">
        <div className={cn("p-2 rounded-lg bg-muted flex-shrink-0", config.color)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <p className={cn("font-medium", isUnread && "font-semibold")}>
                {notification.title}
              </p>
              {isUnread && (
                <span className={cn("w-2 h-2 rounded-full", PRIORITY_COLORS[notification.priority])} />
              )}
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: fr })}
            </span>
          </div>
          
          {notification.message && (
            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
              {notification.message}
            </p>
          )}
          
          {notification.tenant_name && (
            <Badge variant="outline" className="text-xs mb-2">
              <Building2 className="h-3 w-3 mr-1" />
              {notification.tenant_name}
            </Badge>
          )}
          
          <div className="flex items-center gap-2 mt-2">
            {notification.action_url && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onNavigate(notification.action_url!)}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                {notification.action_label || 'Voir'}
              </Button>
            )}
            {isUnread && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => onMarkAsRead(notification.id)}
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Lu
              </Button>
            )}
            {!isResolved && notification.kind !== 'info' && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => onMarkAsResolved(notification.id)}
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Résolu
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function KingNotificationsInbox() {
  const navigate = useNavigate();
  const { notifications, isLoading, unreadCount, markAsRead, markAllAsRead, markAsResolved } = useKingNotifications();
  const [filter, setFilter] = useState<string>('all');

  const filteredNotifications = notifications.filter(n => {
    switch (filter) {
      case 'unread':
        return !n.read_at;
      case 'payment':
        return n.kind === 'payment_received' || n.kind === 'payment_failed';
      case 'tenant':
        return n.kind === 'new_request' || n.kind === 'tenant_activated';
      case 'urgent':
        return n.priority === 'urgent' || n.priority === 'high';
      default:
        return true;
    }
  });

  const handleNavigate = (url: string) => {
    navigate(url);
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
            {unreadCount > 0 && (
              <Badge className="bg-amber-500">{unreadCount}</Badge>
            )}
          </CardTitle>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead}>
              <CheckCheck className="h-4 w-4 mr-1" />
              Tout marquer lu
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs value={filter} onValueChange={setFilter} className="w-full">
          <div className="px-4 border-b">
            <TabsList className="w-full justify-start bg-transparent h-auto p-0 gap-4">
              <TabsTrigger 
                value="all" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-amber-500 rounded-none pb-2 px-0"
              >
                Tout
              </TabsTrigger>
              <TabsTrigger 
                value="unread"
                className="data-[state=active]:border-b-2 data-[state=active]:border-amber-500 rounded-none pb-2 px-0"
              >
                Non lu
                {notifications.filter(n => !n.read_at).length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {notifications.filter(n => !n.read_at).length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="payment"
                className="data-[state=active]:border-b-2 data-[state=active]:border-amber-500 rounded-none pb-2 px-0"
              >
                <CreditCard className="h-3 w-3 mr-1" />
                Paiements
              </TabsTrigger>
              <TabsTrigger 
                value="tenant"
                className="data-[state=active]:border-b-2 data-[state=active]:border-amber-500 rounded-none pb-2 px-0"
              >
                <Building2 className="h-3 w-3 mr-1" />
                Tenants
              </TabsTrigger>
              <TabsTrigger 
                value="urgent"
                className="data-[state=active]:border-b-2 data-[state=active]:border-amber-500 rounded-none pb-2 px-0"
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                Urgent
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value={filter} className="m-0">
            <ScrollArea className="h-[500px]">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-muted border-t-primary" />
                </div>
              ) : filteredNotifications.length > 0 ? (
                <div>
                  {filteredNotifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkAsRead={markAsRead}
                      onMarkAsResolved={markAsResolved}
                      onNavigate={handleNavigate}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Bell className="h-12 w-12 mb-4 opacity-20" />
                  <p>Aucune notification</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export function KingNotificationBell() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead } = useKingNotifications();
  const [isOpen, setIsOpen] = useState(false);

  const recentNotifications = notifications.slice(0, 5);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />
          <Card className="absolute right-0 top-12 w-80 z-50 shadow-lg">
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium">Notifications</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-80">
                {recentNotifications.length > 0 ? (
                  recentNotifications.map((n) => {
                    const config = KIND_CONFIG[n.kind] || KIND_CONFIG.info;
                    const Icon = config.icon;
                    return (
                      <div
                        key={n.id}
                        className={cn(
                          "p-3 border-b cursor-pointer hover:bg-muted/50",
                          !n.read_at && "bg-primary/5"
                        )}
                        onClick={() => {
                          markAsRead(n.id);
                          if (n.action_url) {
                            navigate(n.action_url);
                            setIsOpen(false);
                          }
                        }}
                      >
                        <div className="flex gap-2">
                          <Icon className={cn("h-4 w-4 mt-0.5", config.color)} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{n.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: fr })}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="p-4 text-sm text-muted-foreground text-center">
                    Aucune notification
                  </p>
                )}
              </ScrollArea>
              <div className="p-2 border-t">
                <Button 
                  variant="ghost" 
                  className="w-full text-sm"
                  onClick={() => {
                    navigate('/king');
                    setIsOpen(false);
                  }}
                >
                  Voir toutes les notifications
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
