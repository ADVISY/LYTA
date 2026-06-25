/**
 * WelcomeDialog — Modale d'accueil affichée à la connexion.
 *
 * S'ouvre une seule fois par session (flag sessionStorage), au premier
 * load du dashboard CRM. Affiche un récap du jour :
 *   - Salutation personnalisée (Bonjour/Bonsoir + prénom)
 *   - Nombre de tâches en cours assignées
 *   - Nombre de notifications non lues
 *   - Nombre de RDV pipeline du jour (RDV fixés aujourd'hui)
 *   - Boutons d'action rapide vers les sections concernées
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserTenant } from "@/hooks/useUserTenant";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ListChecks,
  Bell,
  Calendar,
  TrendingUp,
  Sparkles,
  ArrowRight,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "lyta_welcome_dialog_shown_session";

interface UserGreeting {
  greeting: string;
  emoji: string;
}

function getGreeting(): UserGreeting {
  const hour = new Date().getHours();
  if (hour < 5) return { greeting: "Bonne nuit", emoji: "🌙" };
  if (hour < 12) return { greeting: "Bonjour", emoji: "☀️" };
  if (hour < 18) return { greeting: "Bon après-midi", emoji: "☕" };
  return { greeting: "Bonsoir", emoji: "🌆" };
}

function extractFirstName(user: any): string {
  if (!user) return "";
  const meta = user.user_metadata || {};
  if (meta.first_name) return meta.first_name;
  if (meta.full_name) return meta.full_name.split(" ")[0];
  if (user.email) return user.email.split("@")[0].split(".")[0];
  return "";
}

export function WelcomeDialog() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tenantId } = useUserTenant();
  const [open, setOpen] = useState(false);

  // Détecte si on doit afficher la modale (1x par session)
  useEffect(() => {
    if (!user?.id || !tenantId) return;
    try {
      const shown = sessionStorage.getItem(STORAGE_KEY);
      if (!shown) {
        // Petit délai pour laisser le dashboard se charger avant l'overlay
        const timer = setTimeout(() => setOpen(true), 800);
        return () => clearTimeout(timer);
      }
    } catch {
      // sessionStorage peut être indisponible (Safari privé) → on n'affiche pas
    }
  }, [user?.id, tenantId]);

  const handleClose = (open: boolean) => {
    if (!open) {
      setOpen(false);
      try {
        sessionStorage.setItem(STORAGE_KEY, "1");
      } catch {
        // ignore
      }
    }
  };

  // Stats du jour
  const { data: stats } = useQuery({
    queryKey: ["welcome_dialog_stats", user?.id, tenantId],
    enabled: !!user?.id && !!tenantId && open,
    queryFn: async () => {
      const base: any = supabase.from("suivis");

      // Tâches assignées en cours
      const tasksQuery = await base
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId!)
        .eq("kind", "task")
        .eq("assigned_agent_id", user!.id)
        .in("status", ["ouvert", "open", "en_cours", "in_progress"]);

      // Notifications non lues
      const notifsQuery = await base
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId!)
        .eq("kind", "notification")
        .or(`assigned_agent_id.eq.${user!.id},assigned_agent_id.is.null`)
        .in("status", ["ouvert", "open"]);

      // RDV pipeline aujourd'hui
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const rdvsQuery = await base
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId!)
        .eq("kind", "pipeline_card")
        .eq("pipeline_stage", "rdv_fixe")
        .eq("assigned_agent_id", user!.id)
        .gte("reminder_date", today.toISOString())
        .lt("reminder_date", tomorrow.toISOString());

      // Opportunités actives totales
      const oppsQuery = await base
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId!)
        .eq("kind", "pipeline_card")
        .eq("assigned_agent_id", user!.id)
        .not("status", "in", "(archived,done,ferme)");

      return {
        tasks: tasksQuery.count ?? 0,
        notifs: notifsQuery.count ?? 0,
        rdvsToday: rdvsQuery.count ?? 0,
        opps: oppsQuery.count ?? 0,
      };
    },
  });

  const firstName = extractFirstName(user);
  const { greeting, emoji } = getGreeting();
  const totalItems = (stats?.tasks ?? 0) + (stats?.notifs ?? 0) + (stats?.rdvsToday ?? 0);

  const cards = [
    {
      key: "tasks",
      icon: ListChecks,
      label: stats?.tasks === 1 ? "tâche en cours" : "tâches en cours",
      count: stats?.tasks ?? 0,
      color: "from-emerald-500 to-teal-500",
      bgColor: "from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30",
      borderColor: "border-emerald-200 dark:border-emerald-800",
      onClick: () => {
        handleClose(false);
        navigate("/crm/suivis");
      },
    },
    {
      key: "notifs",
      icon: Bell,
      label: stats?.notifs === 1 ? "notification" : "notifications",
      count: stats?.notifs ?? 0,
      color: "from-blue-500 to-indigo-500",
      bgColor: "from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30",
      borderColor: "border-blue-200 dark:border-blue-800",
      onClick: () => {
        handleClose(false);
        navigate("/crm");
      },
    },
    {
      key: "rdv",
      icon: Calendar,
      label: stats?.rdvsToday === 1 ? "RDV aujourd'hui" : "RDV aujourd'hui",
      count: stats?.rdvsToday ?? 0,
      color: "from-violet-500 to-purple-500",
      bgColor: "from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30",
      borderColor: "border-violet-200 dark:border-violet-800",
      onClick: () => {
        handleClose(false);
        navigate("/crm/pipeline");
      },
    },
    {
      key: "opps",
      icon: TrendingUp,
      label: stats?.opps === 1 ? "opportunité active" : "opportunités actives",
      count: stats?.opps ?? 0,
      color: "from-amber-500 to-orange-500",
      bgColor: "from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30",
      borderColor: "border-amber-200 dark:border-amber-800",
      onClick: () => {
        handleClose(false);
        navigate("/crm/pipeline");
      },
    },
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      {/* `[&>button:last-child]:hidden` masque la croix built-in shadcn (très discrète
          opacity-70) pour qu'on n'ait pas 2 croix qui se chevauchent. On rend la
          nôtre plus visible juste en dessous. */}
      <DialogContent className="max-w-lg [&>button:last-child]:hidden">
        <button
          type="button"
          onClick={() => handleClose(false)}
          aria-label="Fermer"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            {emoji} {greeting}
            {firstName && `, ${firstName}`} !
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {totalItems > 0
              ? `Voici votre récap du jour — ${totalItems} élément${totalItems > 1 ? "s" : ""} demande${totalItems > 1 ? "nt" : ""} votre attention.`
              : "Tout est calme aujourd'hui. Profitez-en pour avancer sur vos opportunités !"}
          </p>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 my-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.key}
                type="button"
                onClick={card.onClick}
                className={cn(
                  "group relative rounded-xl border-2 p-4 transition-all hover:shadow-lg hover:-translate-y-0.5 text-left",
                  card.borderColor,
                  `bg-gradient-to-br ${card.bgColor}`
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <div
                    className={cn(
                      "p-2 rounded-lg bg-gradient-to-br text-white shadow",
                      card.color
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-2xl font-bold leading-none">{card.count}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-tight">
                  {card.label}
                </p>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            Bonne journée
          </p>
          <Button onClick={() => handleClose(false)} size="sm">
            C'est parti
            <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
