/**
 * AssignTaskFromNotificationDialog — Convertit une notification en tâche
 * assignée à un agent.
 *
 * Workflow :
 *   1. User clique "Convertir en tâche" sur une notif
 *   2. Modale s'ouvre avec : titre (préfilléé), description, agent, priorité
 *   3. Submit : INSERT suivis (kind='task', assigned_agent_id, ...)
 *      + Marque la notif comme done (= disparaît du bell-icon)
 */
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useUserTenant } from "@/hooks/useUserTenant";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, UserPlus } from "lucide-react";

interface AssignTaskFromNotificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notificationId: string | null;
  notificationTitle?: string;
  notificationMessage?: string;
  isFromSuivis?: boolean;       // pour savoir comment marquer comme done
  onAssigned?: () => void;       // callback (refresh notifs)
}

interface AgentOption {
  user_id: string;
  display: string;
}

export function AssignTaskFromNotificationDialog({
  open,
  onOpenChange,
  notificationId,
  notificationTitle = "",
  notificationMessage = "",
  isFromSuivis = false,
  onAssigned,
}: AssignTaskFromNotificationDialogProps) {
  const { toast } = useToast();
  const { tenantId } = useUserTenant();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedUserId, setAssignedUserId] = useState<string>("");
  const [priority, setPriority] = useState<string>("normal");
  const [saving, setSaving] = useState(false);

  // Pré-remplit quand la modale s'ouvre
  useEffect(() => {
    if (open) {
      setTitle(notificationTitle);
      setDescription(notificationMessage);
      setPriority("normal");
      setAssignedUserId("");
      setSaving(false);
    }
  }, [open, notificationTitle, notificationMessage]);

  // Fetch les agents (collaborateurs avec user_id) du tenant
  const { data: agents = [] } = useQuery<AgentOption[]>({
    queryKey: ["tenant_agents_for_assign", tenantId],
    enabled: !!tenantId && open,
    queryFn: async () => {
      if (!tenantId) return [];
      const base: any = supabase.from("clients");
      const { data, error } = await base
        .select("user_id, first_name, last_name, email")
        .eq("tenant_id", tenantId)
        .eq("type_adresse", "collaborateur")
        .not("user_id", "is", null);
      if (error) throw error;
      return (data ?? []).map((c: any) => ({
        user_id: c.user_id,
        display:
          `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() ||
          c.email ||
          "Sans nom",
      }));
    },
  });

  const handleSubmit = async () => {
    if (!notificationId || !tenantId || !title.trim()) {
      toast({
        title: "Champs requis",
        description: "Le titre est obligatoire",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // 1. Crée la tâche assignée (cast any pour éviter l'inférence profonde)
      const suivisBase: any = supabase.from("suivis");
      const { error: insertError } = await suivisBase.insert([
        {
          tenant_id: tenantId,
          kind: "task",
          status: "ouvert",
          priority,
          title: title.trim(),
          description: description.trim() || null,
          assigned_agent_id: assignedUserId || null,
          source: "manual",
          related_kind: "notification",
          related_id: notificationId,
        },
      ]);
      if (insertError) throw insertError;

      // 2. Marque la notification source comme done
      if (isFromSuivis) {
        // Notif venant du modèle unifié (suivis kind='notification')
        await supabase
          .from("suivis")
          .update({
            status: "done",
            completed_at: new Date().toISOString(),
          })
          .eq("id", notificationId);
      } else {
        // Notif legacy (table notifications)
        await supabase
          .from("notifications")
          .update({ read_at: new Date().toISOString() })
          .eq("id", notificationId);
      }

      toast({
        title: "Tâche créée ✅",
        description: assignedUserId
          ? "Assignée à " + (agents.find(a => a.user_id === assignedUserId)?.display ?? "agent")
          : "Sans assignation",
      });
      onAssigned?.();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Erreur",
        description: err.message || "Impossible de créer la tâche",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onOpenChange(false)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Convertir en tâche
          </DialogTitle>
          <DialogDescription>
            La notification deviendra une tâche actionnable assignée à un agent.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Titre *</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Rappeler le client X"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-desc">Description (optionnel)</Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Détails de la tâche..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-agent">Assigner à</Label>
              <Select value={assignedUserId} onValueChange={setAssignedUserId}>
                <SelectTrigger id="task-agent">
                  <SelectValue placeholder="Personne / vide" />
                </SelectTrigger>
                <SelectContent>
                  {agents.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      Aucun agent disponible
                    </SelectItem>
                  ) : (
                    agents.map((a) => (
                      <SelectItem key={a.user_id} value={a.user_id}>
                        {a.display}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-priority">Priorité</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger id="task-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">🔴 Urgent</SelectItem>
                  <SelectItem value="high">🟠 Haute</SelectItem>
                  <SelectItem value="normal">⚪ Normale</SelectItem>
                  <SelectItem value="low">🔵 Basse</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !title.trim()}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Créer la tâche
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
