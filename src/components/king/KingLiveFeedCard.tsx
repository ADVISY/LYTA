/**
 * KingLiveFeedCard
 * ================
 * Feed temps réel des derniers events de la plateforme (notifications king).
 * Auto-refresh + subscription realtime sur king_notifications.
 */
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Loader2, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface FeedItem {
  id: string;
  title: string;
  message: string | null;
  kind: string;
  priority: string;
  tenant_id: string | null;
  tenant_name: string | null;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
}

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-red-500",
  normal: "bg-blue-500",
  low: "bg-gray-400",
};

export function KingLiveFeedCard() {
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["king-live-feed"],
    queryFn: async (): Promise<FeedItem[]> => {
      const { data, error } = await supabase
        .from("king_notifications")
        .select("id, title, message, kind, priority, tenant_id, tenant_name, action_url, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return (data || []) as FeedItem[];
    },
    refetchInterval: 30_000,
  });

  // Realtime : refresh dès qu'une nouvelle notif arrive
  useEffect(() => {
    const ch = supabase
      .channel("king-live-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "king_notifications" }, () => {
        queryClient.invalidateQueries({ queryKey: ["king-live-feed"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [queryClient]);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-500" />
          Activité temps réel
          <span className="ml-auto flex items-center gap-1 text-xs font-normal text-emerald-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Aucune activité pour l'instant.
          </p>
        ) : (
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {items.map((it) => (
              <Link
                key={it.id}
                to={it.action_url || "#"}
                className={`block p-2.5 rounded-lg border text-xs transition-colors hover:bg-muted/50 ${
                  it.read_at ? "opacity-70" : "border-primary/30 bg-primary/5"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className={`h-2 w-2 rounded-full mt-1 ${PRIORITY_DOT[it.priority] || PRIORITY_DOT.normal}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="font-medium truncate">{it.title}</p>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(it.created_at), { locale: fr, addSuffix: true })}
                      </span>
                    </div>
                    {it.message && (
                      <p className="text-muted-foreground line-clamp-2">{it.message}</p>
                    )}
                    {it.tenant_name && (
                      <p className="text-[10px] text-primary mt-1 flex items-center gap-1">
                        {it.tenant_name} {it.action_url && <ExternalLink className="h-2.5 w-2.5" />}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
