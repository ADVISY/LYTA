import { useClientNotifications } from "@/hooks/useClientNotifications";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Bell, 
  Check, 
  FileText, 
  FolderOpen,
  AlertTriangle,
  MessageCircle,
  Receipt
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

const kindConfig: Record<string, { icon: any; color: string }> = {
  contract: { icon: FileText, color: "text-blue-600 bg-blue-100" },
  document: { icon: FolderOpen, color: "text-emerald-600 bg-emerald-100" },
  invoice: { icon: Receipt, color: "text-rose-600 bg-rose-100" },
  claim: { icon: AlertTriangle, color: "text-amber-600 bg-amber-100" },
  message: { icon: MessageCircle, color: "text-purple-600 bg-purple-100" },
  default: { icon: Bell, color: "text-muted-foreground bg-muted" },
};

export default function ClientNotifications() {
  const { t } = useTranslation();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useClientNotifications();

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold">{t('clientNotifications.title')}</h1>
          <p className="text-sm lg:text-base text-muted-foreground">
            {unreadCount > 0 
              ? t('clientNotifications.unreadCount', { count: unreadCount })
              : t('clientNotifications.allRead')
            }
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={markAllAsRead} className="gap-2 h-9 lg:h-10 text-xs lg:text-sm w-full sm:w-auto">
            <Check className="h-4 w-4" />
            {t('clientNotifications.markAllAsRead')}
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="py-10 lg:py-12 text-center">
            <Bell className="h-12 w-12 lg:h-16 lg:w-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-base lg:text-lg font-medium mb-2">{t('clientNotifications.noNotifications')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('clientNotifications.noNotificationsDescription')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2 lg:space-y-3">
          {notifications.map((notification) => {
            const config = kindConfig[notification.kind] || kindConfig.default;
            const Icon = config.icon;
            const isUnread = !notification.read_at;
            
            return (
              <Card 
                key={notification.id}
                className={cn(
                  "transition-colors cursor-pointer active:scale-[0.99]",
                  isUnread && "bg-primary/5 border-primary/20"
                )}
                onClick={() => !notification.read_at && markAsRead(notification.id)}
              >
                <CardContent className="p-3 lg:p-4">
                  <div className="flex items-start gap-3 lg:gap-4">
                    <div className={cn(
                      "h-9 w-9 lg:h-10 lg:w-10 rounded-full flex items-center justify-center flex-shrink-0",
                      config.color
                    )}>
                      <Icon className="h-4 w-4 lg:h-5 lg:w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-sm lg:text-base font-medium",
                            isUnread && "text-foreground"
                          )}>
                            {notification.title}
                          </p>
                          {notification.message && (
                            <p className="text-xs lg:text-sm text-muted-foreground mt-0.5 lg:mt-1 line-clamp-2">
                              {notification.message}
                            </p>
                          )}
                        </div>
                        {isUnread && (
                          <Badge variant="default" className="flex-shrink-0 text-[10px] lg:text-xs h-5 lg:h-6">{t('clientNotifications.new')}</Badge>
                        )}
                      </div>
                      <p className="text-[10px] lg:text-xs text-muted-foreground mt-1.5 lg:mt-2">
                        {format(new Date(notification.created_at), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
