/**
 * DashboardInboxWidget — Widget Inbox + Tâches sur le dashboard CRM.
 *
 * Remplace le simple widget "Notifications" par un centre de contrôle avec
 * 2 onglets :
 *   - Notifications : avec bouton supprimer (X) au survol
 *   - Mes tâches    : avec bouton attribuer/déléguer (👤+) au survol
 *
 * Permet à l'utilisateur de gérer l'inbox directement depuis le dashboard
 * sans avoir à naviguer.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUserTenant } from "@/hooks/useUserTenant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Bell,
  Clock,
  X,
  UserPlus,
  CheckCircle2,
  Circle,
  ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AssignTaskFromNotificationDialog } from "./AssignTaskFromNotificationDialog";
import { useNotifications } from "@/hooks/useNotifications";

interface DashboardInboxWidgetProps {
  /** Icône getter pour les notifs (passe l'icône appropriée selon le kind) */
  getNotificationIcon?: (kind: string) => React.ReactNode;
}

export function DashboardInboxWidget({
  getNotificationIcon,
}: DashboardInboxWidgetProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { tenantId } = useUserTenant();

  const {
    notifications,
    unreadCount,
    markAsRead,
    fetchNotifications,
  } = useNotifications();

  // Limite à 5 dans le widget pour pas surcharger
  const recentNotifications = notifications.slice(0, 5);

  // Fetch les tâches assignées à l'user connecté
  const { data: myTasks = [], refetch: refetchTasks } = useQuery({
    queryKey: ["dashboard_my_tasks", user?.id, tenantId],
    enabled: !!user?.id && !!tenantId,
    queryFn: async () => {
      const base: any = supabase.from("suivis");
      const { data, error } = await base
        .select(`
          id, title, description, status, priority, reminder_date, created_at,
          client:clients(first_name, last_name, company_name)
        `)
        .eq("tenant_id", tenantId!)
        .eq("kind", "task")
        .eq("assigned_agent_id", user!.id)
        .in("status", ["ouvert", "open", "en_cours", "in_progress"])
        .order("priority", { ascending: false })
        .order("reminder_date", { ascending: true, nullsFirst: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const openTasksCount = myTasks.length;

  // État modale "Convertir notif en tâche"
  const [assignTaskNotif, setAssignTaskNotif] = useState<any | null>(null);

  // Supprimer / archiver une notif
  const handleDeleteNotification = async (notif: any) => {
    try {
      const isFromSuivis = !!notif.payload?.from_suivis;
      if (isFromSuivis) {
        await supabase
          .from("suivis")
          .update({ status: "archived", completed_at: new Date().toISOString() })
          .eq("id", notif.id);
      } else {
        await supabase
          .from("notifications")
          .update({ read_at: new Date().toISOString() })
          .eq("id", notif.id);
      }
      toast({ title: "Notification supprimée" });
      fetchNotifications();
    } catch (err: any) {
      toast({
        title: "Erreur",
        description: err.message || "Impossible de supprimer",
        variant: "destructive",
      });
    }
  };

  // Marquer une tâche comme done
  const handleToggleTaskDone = async (taskId: string, currentStatus: string) => {
    const isDone = currentStatus === "done" || currentStatus === "ferme";
    const newStatus = isDone ? "ouvert" : "done";
    try {
      await supabase
        .from("suivis")
        .update({
          status: newStatus,
          completed_at: newStatus === "done" ? new Date().toISOString() : null,
        })
        .eq("id", taskId);
      refetchTasks();
      queryClient.invalidateQueries({ queryKey: ["suivis"] });
    } catch (err: any) {
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleNotificationClick = (notif: any) => {
    if (!notif.read_at) markAsRead(notif.id);
    if (notif.payload?.action_url) {
      navigate(notif.payload.action_url);
    }
  };

  const handleTaskClick = (task: any) => {
    if (task.client?.id || task.client_id) {
      navigate(`/crm/clients/${task.client_id}`);
    }
  };

  const formatClientName = (task: any): string => {
    const c = task.client;
    if (!c) return "—";
    if (c.company_name) return c.company_name;
    return [c.first_name, c.last_name].filter(Boolean).join(" ") || "—";
  };

  return (
    <>
      <Card className="border shadow-sm bg-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-blue-500" />
              <CardTitle className="text-sm font-semibold">
                Inbox
              </CardTitle>
            </div>
            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {unreadCount} notif{unreadCount > 1 ? "s" : ""}
                </Badge>
              )}
              {openTasksCount > 0 && (
                <Badge variant="outline" className="text-xs">
                  {openTasksCount} tâche{openTasksCount > 1 ? "s" : ""}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Tabs defaultValue="notifications" className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-8 mb-2">
              <TabsTrigger value="notifications" className="text-xs">
                <Bell className="h-3 w-3 mr-1" />
                Notifications
              </TabsTrigger>
              <TabsTrigger value="tasks" className="text-xs">
                <ListChecks className="h-3 w-3 mr-1" />
                Mes tâches
              </TabsTrigger>
            </TabsList>

            {/* ─── ONGLET NOTIFICATIONS ──────────────────────────── */}
            <TabsContent value="notifications" className="mt-0">
              {recentNotifications.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aucune notification
                </p>
              ) : (
                <ScrollArea className="h-[280px]">
                  <div className="space-y-1.5">
                    {recentNotifications.map(notif => (
                      <div
                        key={notif.id}
                        className={cn(
                          "group relative flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors",
                          notif.read_at ? "bg-muted/30" : "bg-blue-50 dark:bg-blue-950/20",
                          "hover:bg-muted/50"
                        )}
                        onClick={() => handleNotificationClick(notif)}
                      >
                        <div className="mt-0.5 flex-shrink-0">
                          {getNotificationIcon
                            ? getNotificationIcon(notif.kind)
                            : <Bell className="h-3.5 w-3.5 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0 pr-7">
                          <p className={cn(
                            "text-xs leading-snug line-clamp-2",
                            !notif.read_at && "font-semibold"
                          )}>
                            {notif.title}
                          </p>
                          {notif.message && (
                            <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                              {notif.message}
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground/70 mt-0.5 flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" />
                            {formatDistanceToNow(new Date(notif.created_at), {
                              addSuffix: true,
                              locale: fr,
                            })}
                          </p>
                        </div>

                        {/* Actions au hover */}
                        <div className="absolute top-1.5 right-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAssignTaskNotif(notif);
                            }}
                            className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600"
                            title="Convertir en tâche"
                          >
                            <UserPlus className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteNotification(notif);
                            }}
                            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900 text-red-600"
                            title="Supprimer"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            {/* ─── ONGLET TÂCHES ──────────────────────────────────── */}
            <TabsContent value="tasks" className="mt-0">
              {myTasks.length === 0 ? (
                <div className="text-center py-8">
                  <ListChecks className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Aucune tâche en cours
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Les tâches qui te sont assignées apparaîtront ici
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[280px]">
                  <div className="space-y-1.5">
                    {myTasks.map(task => {
                      const isDone = task.status === "done" || task.status === "ferme";
                      const priorityColor =
                        task.priority === "urgent" ? "border-l-red-500"
                        : task.priority === "high" ? "border-l-orange-500"
                        : task.priority === "low" ? "border-l-slate-300"
                        : "border-l-slate-400";

                      return (
                        <div
                          key={task.id}
                          className={cn(
                            "group relative flex items-start gap-2 p-2 rounded-lg border-l-2 hover:bg-muted/50 transition-colors cursor-pointer",
                            priorityColor,
                            isDone && "opacity-60"
                          )}
                          onClick={() => handleTaskClick(task)}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleTaskDone(task.id, task.status);
                            }}
                            className="mt-0.5 flex-shrink-0 hover:scale-110 transition-transform"
                            title={isDone ? "Marquer comme non fait" : "Marquer comme fait"}
                          >
                            {isDone ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </button>
                          <div className="flex-1 min-w-0 pr-7">
                            <p className={cn(
                              "text-xs leading-snug line-clamp-2 font-medium",
                              isDone && "line-through text-muted-foreground"
                            )}>
                              {task.title}
                            </p>
                            <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                              {formatClientName(task)}
                            </p>
                            {task.reminder_date && (
                              <p className="text-[10px] text-muted-foreground/70 mt-0.5 flex items-center gap-0.5">
                                <Clock className="h-2.5 w-2.5" />
                                {formatDistanceToNow(new Date(task.reminder_date), {
                                  addSuffix: true,
                                  locale: fr,
                                })}
                              </p>
                            )}
                          </div>

                          {/* Action "Déléguer" au hover */}
                          <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Réutilise la modale "Convertir en tâche" en mode délégation
                                setAssignTaskNotif({
                                  id: task.id,
                                  title: task.title,
                                  message: task.description,
                                  payload: { from_suivis: true, is_delegation: true },
                                });
                              }}
                              className="p-1 rounded hover:bg-violet-100 dark:hover:bg-violet-900 text-violet-600"
                              title="Déléguer à un autre agent"
                            >
                              <UserPlus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Modale "Convertir en tâche" / "Déléguer" */}
      <AssignTaskFromNotificationDialog
        open={!!assignTaskNotif}
        onOpenChange={(open) => !open && setAssignTaskNotif(null)}
        notificationId={assignTaskNotif?.id ?? null}
        notificationTitle={assignTaskNotif?.title ?? ""}
        notificationMessage={assignTaskNotif?.message ?? ""}
        isFromSuivis={!!assignTaskNotif?.payload?.from_suivis}
        onAssigned={() => {
          fetchNotifications();
          refetchTasks();
        }}
      />
    </>
  );
}
