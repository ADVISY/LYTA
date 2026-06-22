/**
 * SetRdvDialog — Modale pour fixer/modifier la date d'un RDV sur une
 * opportunité.
 *
 * S'ouvre dans 3 cas :
 *   - Drag vers colonne "RDV fixé" depuis le Kanban
 *   - Click "Déplacer vers > RDV fixé" depuis le menu ⋮ d'une card
 *   - Click "Modifier RDV" depuis la modale détail
 *
 * À la confirmation :
 *   - UPDATE pipeline_stage='rdv_fixe' + reminder_date = ISO
 *   - Génère un lien Google Calendar pré-rempli
 *   - Affiche le bouton "Ajouter à Google Agenda"
 */
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  ExternalLink,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import type { Suivi } from "@/hooks/useSuivis";
import { buildGoogleCalendarUrl } from "@/lib/google-calendar";

interface SetRdvDialogProps {
  opportunity: Suivi | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
}

export function SetRdvDialog({
  opportunity,
  open,
  onOpenChange,
  onUpdated,
}: SetRdvDialogProps) {
  const { toast } = useToast();

  const [rdvDate, setRdvDate] = useState<string>("");
  const [rdvTime, setRdvTime] = useState<string>("10:00");
  const [rdvDuration, setRdvDuration] = useState<string>("30");
  const [saving, setSaving] = useState(false);
  const [createdGoogleUrl, setCreatedGoogleUrl] = useState<string | null>(null);

  // Pré-remplit si l'opp a déjà un reminder_date (édition d'un RDV existant)
  useEffect(() => {
    if (!open) return;
    if (opportunity?.reminder_date) {
      const d = new Date(opportunity.reminder_date);
      setRdvDate(d.toISOString().slice(0, 10));
      setRdvTime(
        `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
      );
    } else {
      // Default : demain 10h
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setRdvDate(tomorrow.toISOString().slice(0, 10));
      setRdvTime("10:00");
    }
    setRdvDuration("30");
    setCreatedGoogleUrl(null);
  }, [open, opportunity]);

  const handleClose = () => {
    setCreatedGoogleUrl(null);
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!opportunity || !rdvDate) {
      toast({
        title: "Champ requis",
        description: "Sélectionne une date pour le RDV",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const [hh, mm] = rdvTime.split(":").map((n) => parseInt(n, 10));
      const d = new Date(rdvDate);
      d.setHours(hh, mm, 0, 0);
      const reminderIso = d.toISOString();

      // Update l'opportunité : passage stage rdv_fixe + reminder_date
      const { error } = await supabase
        .from("suivis")
        .update({
          pipeline_stage: "rdv_fixe",
          reminder_date: reminderIso,
          updated_at: new Date().toISOString(),
        })
        .eq("id", opportunity.id);

      if (error) throw error;

      toast({
        title: "RDV fixé ✅",
        description: `${d.toLocaleDateString("fr-CH", {
          weekday: "long",
          day: "2-digit",
          month: "long",
        })} à ${rdvTime}`,
      });

      // Construit l'URL Google Calendar avec infos client enrichies
      // (adresse → location/Maps, téléphone/email → détails)
      const gcalUrl = buildGoogleCalendarUrl(
        { ...opportunity, reminder_date: reminderIso },
        opportunity.client,
        parseInt(rdvDuration, 10) || 30,
      );
      setCreatedGoogleUrl(gcalUrl);
      onUpdated?.();
    } catch (err: any) {
      toast({
        title: "Erreur",
        description: err.message || "Impossible de fixer le RDV",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!opportunity) return null;

  const clientName = opportunity.client
    ? opportunity.client.company_name ||
      `${opportunity.client.first_name || ""} ${opportunity.client.last_name || ""}`.trim()
    : "Client";

  const isEdit = !!opportunity.reminder_date;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {createdGoogleUrl
              ? "RDV fixé 🎉"
              : isEdit
                ? "Modifier le rendez-vous"
                : "Fixer un rendez-vous"}
          </DialogTitle>
          <DialogDescription>
            {createdGoogleUrl
              ? "Ajoute le RDV à ton agenda Google en un clic."
              : `${clientName} · ${opportunity.expected_product || ""}${opportunity.expected_company ? ` chez ${opportunity.expected_company}` : ""}`}
          </DialogDescription>
        </DialogHeader>

        {/* État 1 : formulaire date/heure */}
        {!createdGoogleUrl && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-1">
                <Label htmlFor="rdv-edit-date">Date *</Label>
                <Input
                  id="rdv-edit-date"
                  type="date"
                  value={rdvDate}
                  onChange={(e) => setRdvDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rdv-edit-time">Heure</Label>
                <Input
                  id="rdv-edit-time"
                  type="time"
                  value={rdvTime}
                  onChange={(e) => setRdvTime(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="rdv-edit-duration">Durée estimée</Label>
              <Select value={rdvDuration} onValueChange={setRdvDuration}>
                <SelectTrigger id="rdv-edit-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">1 heure</SelectItem>
                  <SelectItem value="90">1h30</SelectItem>
                  <SelectItem value="120">2 heures</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                La durée détermine le créneau réservé dans Google Agenda.
              </p>
            </div>
          </div>
        )}

        {/* État 2 : succès + lien Google */}
        {createdGoogleUrl && (
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 p-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-emerald-900 dark:text-emerald-100">
                  RDV enregistré dans LYTA
                </p>
                <p className="text-emerald-700 dark:text-emerald-300 mt-1">
                  L'opportunité est maintenant en stage "RDV fixé". Ajoute-le
                  à ton calendrier Google en 1 clic.
                </p>
              </div>
            </div>

            <Button asChild className="w-full" size="lg">
              <a
                href={createdGoogleUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Ajouter à Google Agenda
                <ExternalLink className="h-3.5 w-3.5 ml-2" />
              </a>
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Google Calendar va s'ouvrir avec l'événement pré-rempli.
              Clique "Enregistrer" dans Google.
            </p>
          </div>
        )}

        <DialogFooter>
          {!createdGoogleUrl ? (
            <>
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={saving}
              >
                Annuler
              </Button>
              <Button onClick={handleSubmit} disabled={saving || !rdvDate}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEdit ? "Mettre à jour le RDV" : "Fixer le RDV"}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={handleClose} className="w-full">
              Fermer
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
