import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, AlertCircle, Loader2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Notification {
  id: string;
  title: string;
  message: string;
  kind: "info" | "success" | "warning" | "error";
  priority: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface OnboardingNotificationsProps {
  tenantId: string | null;
  tenantName: string;
}

const kindConfig = {
  info: {
    icon: Info,
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
    iconColor: "text-blue-500",
  },
  success: {
    icon: CheckCircle2,
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-200 dark:border-emerald-800",
    iconColor: "text-emerald-500",
  },
  warning: {
    icon: AlertCircle,
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800",
    iconColor: "text-amber-500",
  },
  error: {
    icon: XCircle,
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-800",
    iconColor: "text-red-500",
  },
};

export function OnboardingNotifications({ tenantId, tenantName }: OnboardingNotificationsProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch existing notifications for this tenant
  useEffect(() => {
    if (!tenantId) return;

    const fetchNotifications = async () => {
      const { data } = await supabase
        .from("king_notifications")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (data) {
        setNotifications(data as Notification[]);
      }
    };

    fetchNotifications();
  }, [tenantId]);

  // Subscribe to realtime notifications
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`king-notifications-${tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "king_notifications",
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          console.log("New notification received:", payload);
          const newNotification = payload.new as Notification;
          setNotifications((prev) => [newNotification, ...prev]);
          
          // Check if it's an "in_progress" notification
          const metadata = newNotification.metadata as { status?: string };
          if (metadata?.status === "in_progress") {
            setIsLoading(true);
          } else if (metadata?.status === "completed" || metadata?.status === "failed") {
            setIsLoading(false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId]);

  if (!tenantId && notifications.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Les notifications d'onboarding apparaîtront ici</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {isLoading && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20 animate-pulse">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm font-medium">Onboarding en cours...</span>
        </div>
      )}

      <ScrollArea className="h-[300px] pr-4">
        <div className="space-y-2">
          {notifications.map((notification, index) => {
            const config = kindConfig[notification.kind] || kindConfig.info;
            const Icon = config.icon;
            const isNew = index === 0;

            return (
              <div
                key={notification.id}
                className={cn(
                  "p-3 rounded-lg border transition-all",
                  config.bg,
                  config.border,
                  isNew && "ring-2 ring-primary/20"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn("mt-0.5", config.iconColor)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{notification.title}</p>
                    {notification.message && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      {new Date(notification.created_at).toLocaleTimeString("fr-CH")}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}

          {notifications.length === 0 && !isLoading && (
            <div className="p-4 text-center text-muted-foreground">
              <p className="text-sm">Aucune notification</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
