/**
 * NewOpportunityDialog — Modale de création d'une opportunité commerciale.
 *
 * Cas d'usage :
 *   - Depuis fiche client : bouton "+ Nouvelle opportunité"
 *   - Depuis page Pipeline : bouton "+ Nouvelle opportunité" + select client
 *
 * Stage initial : "Prospect" par défaut.
 * Si l'user choisit "RDV fixé" → révèle champs date/heure → crée l'opp +
 * affiche un lien "📅 Ajouter à Google Agenda" (pre-fill URL).
 *
 * L'intégration Google Calendar OAuth bi-directionnelle arrive sprint juillet.
 * Pour l'instant, l'user clique le lien et save l'event dans son agenda
 * manuellement (workaround propre, marche immédiatement).
 */
import { useState } from "react";
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
import { Calendar, ExternalLink, Loader2, CheckCircle2 } from "lucide-react";
import {
  PIPELINE_STAGES,
  PIPELINE_STAGE_LABELS,
  type PipelineStage,
} from "@/hooks/useSuivis";
import { buildGoogleCalendarUrl } from "@/lib/google-calendar";

const PRODUCTS = [
  "LAMal",
  "LCA",
  "LPP",
  "LAA",
  "Auto",
  "Ménage",
  "RC privée",
  "Hypothèque",
  "Prévoyance",
  "Vie",
  "Multi-lignes",
  "Autre",
];

const COMPANIES = [
  "Helsana",
  "Helvetia",
  "Vaudoise",
  "Allianz",
  "AXA",
  "Generali",
  "Zurich",
  "CSS",
  "Swica",
  "Concordia",
  "Visana",
  "Sanitas",
  "Mobilière",
  "Baloise",
  "PostFinance",
  "UBS",
  "Autre",
];

interface NewOpportunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  onCreated?: () => void;
}

export function NewOpportunityDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  onCreated,
}: NewOpportunityDialogProps) {
  const { tenantId } = useUserTenant();
  const { toast } = useToast();

  const [product, setProduct] = useState<string>("");
  const [company, setCompany] = useState<string>("");
  const [stage, setStage] = useState<PipelineStage>("prospect");
  const [rdvDate, setRdvDate] = useState<string>("");
  const [rdvTime, setRdvTime] = useState<string>("10:00");
  const [rdvDuration, setRdvDuration] = useState<string>("30");
  const [notes, setNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Après création réussie avec stage RDV : affichage lien Google Agenda
  const [createdGoogleUrl, setCreatedGoogleUrl] = useState<string | null>(null);

  const isRdvStage = stage === "rdv_fixe";

  const reset = () => {
    setProduct("");
    setCompany("");
    setStage("prospect");
    setRdvDate("");
    setRdvTime("10:00");
    setRdvDuration("30");
    setNotes("");
    setSaving(false);
    setCreatedGoogleUrl(null);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  // buildGoogleCalendarUrl est importé depuis @/lib/google-calendar et
  // enrichit l'event avec l'adresse client (location/Maps) + téléphone + email

  const handleSubmit = async () => {
    if (!tenantId) {
      toast({
        title: "Erreur",
        description: "Aucun cabinet assigné",
        variant: "destructive",
      });
      return;
    }
    if (!product) {
      toast({
        title: "Champ requis",
        description: "Sélectionne un produit espéré",
        variant: "destructive",
      });
      return;
    }
    if (isRdvStage && !rdvDate) {
      toast({
        title: "Champ requis",
        description: "Sélectionne une date pour le RDV",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Construit reminder_date si RDV
      let reminderIso: string | null = null;
      if (isRdvStage && rdvDate) {
        const [hh, mm] = rdvTime.split(":").map((n) => parseInt(n, 10));
        const d = new Date(rdvDate);
        d.setHours(hh, mm, 0, 0);
        reminderIso = d.toISOString();
      }

      const title = company
        ? `${product} ${company} — ${clientName}`
        : `${product} — ${clientName}`;

      const description = [
        product && `Produit : ${product}`,
        company && `Compagnie : ${company}`,
        notes && `Notes : ${notes}`,
        `Opportunité créée depuis LYTA`,
      ]
        .filter(Boolean)
        .join("\n");

      // ─── Résolution de l'agent à assigner ────────────────────────
      // Le client peut avoir un assigned_agent_id (référence vers un
      // client de type 'collaborateur'). On résout vers son user_id
      // pour que la FK profiles fonctionne sur suivis.assigned_agent_id.
      let resolvedAgentUserId: string | null = null;
      try {
        const { data: clientRow } = await supabase
          .from("clients")
          .select("assigned_agent_id")
          .eq("id", clientId)
          .maybeSingle();

        if (clientRow?.assigned_agent_id) {
          const { data: agentClient } = await supabase
            .from("clients")
            .select("user_id")
            .eq("id", clientRow.assigned_agent_id)
            .maybeSingle();
          resolvedAgentUserId = agentClient?.user_id ?? null;
        }
      } catch {
        // En cas d'erreur, on laisse null → "Non assigné" affiché
      }

      const { error } = await supabase.from("suivis").insert([
        {
          tenant_id: tenantId,
          client_id: clientId,
          kind: "pipeline_card",
          status: "ouvert",
          pipeline_stage: stage,
          expected_product: product,
          expected_company: company || null,
          title,
          description,
          reminder_date: reminderIso,
          priority: "normal",
          source: "manual",
          assigned_agent_id: resolvedAgentUserId,
        },
      ]);

      if (error) throw error;

      toast({
        title: "Opportunité créée ✅",
        description: `${title} — stage : ${PIPELINE_STAGE_LABELS[stage]}`,
      });

      // Si RDV : prépare le lien Google Calendar enrichi (adresse + tel + email)
      if (isRdvStage && reminderIso) {
        // Fetch les infos client pour enrichir l'event Google Calendar
        const { data: clientData } = await supabase
          .from("clients")
          .select("first_name, last_name, company_name, email, phone, mobile, address, postal_code, city, country")
          .eq("id", clientId)
          .maybeSingle();

        const gcalUrl = buildGoogleCalendarUrl(
          { title, description, expected_product: product, expected_company: company, reminder_date: reminderIso },
          clientData,
          parseInt(rdvDuration, 10) || 30,
          notes,
        );
        setCreatedGoogleUrl(gcalUrl);
        // On ne ferme pas la modale : l'user voit le bouton "Ajouter à Google Agenda"
      } else {
        onCreated?.();
        handleClose();
      }
    } catch (err: any) {
      toast({
        title: "Erreur",
        description: err.message || "Impossible de créer l'opportunité",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {createdGoogleUrl ? "Opportunité créée 🎉" : "Nouvelle opportunité"}
          </DialogTitle>
          <DialogDescription>
            {createdGoogleUrl
              ? "Tu peux maintenant ajouter le RDV à Google Agenda en un clic."
              : `Pour ${clientName}`}
          </DialogDescription>
        </DialogHeader>

        {/* État 1 : formulaire de création */}
        {!createdGoogleUrl && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="opp-product">Produit *</Label>
                <Select value={product} onValueChange={setProduct}>
                  <SelectTrigger id="opp-product">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCTS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="opp-company">Compagnie</Label>
                <Select value={company} onValueChange={setCompany}>
                  <SelectTrigger id="opp-company">
                    <SelectValue placeholder="Optionnel" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="opp-stage">Stage initial</Label>
              <Select
                value={stage}
                onValueChange={(v) => setStage(v as PipelineStage)}
              >
                <SelectTrigger id="opp-stage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PIPELINE_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {PIPELINE_STAGE_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Champs RDV affichés si stage = RDV fixé */}
            {isRdvStage && (
              <div className="space-y-3 rounded-lg border bg-violet-50/50 dark:bg-violet-950/20 p-3">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Détails du RDV
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1">
                    <Label htmlFor="rdv-date" className="text-xs">
                      Date *
                    </Label>
                    <Input
                      id="rdv-date"
                      type="date"
                      value={rdvDate}
                      onChange={(e) => setRdvDate(e.target.value)}
                      min={new Date().toISOString().slice(0, 10)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="rdv-time" className="text-xs">
                      Heure
                    </Label>
                    <Input
                      id="rdv-time"
                      type="time"
                      value={rdvTime}
                      onChange={(e) => setRdvTime(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="rdv-duration" className="text-xs">
                    Durée (minutes)
                  </Label>
                  <Select value={rdvDuration} onValueChange={setRdvDuration}>
                    <SelectTrigger id="rdv-duration">
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
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="opp-notes">Notes (optionnel)</Label>
              <Textarea
                id="opp-notes"
                placeholder="Contexte, besoin spécifique..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
        )}

        {/* État 2 : confirmation post-création avec lien Google */}
        {createdGoogleUrl && (
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 p-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-emerald-900 dark:text-emerald-100">
                  Opportunité ajoutée à ton pipeline
                </p>
                <p className="text-emerald-700 dark:text-emerald-300 mt-1">
                  Le RDV est enregistré dans LYTA. Tu peux maintenant l'ajouter
                  à ton calendrier Google en 1 clic.
                </p>
              </div>
            </div>

            <Button asChild className="w-full" size="lg">
              <a
                href={createdGoogleUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  // Après clic, on attend 2s et on ferme + refresh
                  setTimeout(() => {
                    onCreated?.();
                    handleClose();
                  }, 500);
                }}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Ajouter à Google Agenda
                <ExternalLink className="h-3.5 w-3.5 ml-2" />
              </a>
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Google Calendar va s'ouvrir avec l'événement pré-rempli. Tu n'as
              qu'à cliquer "Enregistrer".
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
              <Button onClick={handleSubmit} disabled={saving || !product}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Créer l'opportunité
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              onClick={() => {
                onCreated?.();
                handleClose();
              }}
              className="w-full"
            >
              Fermer
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
