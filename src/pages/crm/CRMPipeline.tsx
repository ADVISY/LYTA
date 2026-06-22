/**
 * CRMPipeline — Vue Kanban des opportunités commerciales.
 *
 * Page autonome qui affiche le PipelineKanban + filtres globaux + actions.
 * Plus tard, un toggle Liste/Kanban sera ajouté dans CRMSuivis pour les
 * vues croisées. Pour l'instant cette page reste l'entrée principale du
 * pipeline.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TrendingUp, RefreshCw } from "lucide-react";
import { PipelineKanban } from "@/components/crm/pipeline/PipelineKanban";
import { OpportunityDetailDialog } from "@/components/crm/pipeline/OpportunityDetailDialog";
import {
  usePipeline,
  type Suivi,
  type PipelineStage,
} from "@/hooks/useSuivis";
import { supabase } from "@/integrations/supabase/client";

const LOSS_REASONS = [
  { value: "trop_cher", label: "Trop cher" },
  { value: "engagé_concurrent", label: "Déjà engagé chez concurrent" },
  { value: "pas_intéressé", label: "Pas intéressé après réflexion" },
  { value: "pas_de_réponse", label: "Pas de réponse client" },
  { value: "autre", label: "Autre" },
];

export default function CRMPipeline() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { totalCount, refetch } = usePipeline();

  // Modale "Détail opportunité"
  const [detailOpp, setDetailOpp] = useState<Suivi | null>(null);

  // Modale "Marquer perdu"
  const [lostOpp, setLostOpp] = useState<Suivi | null>(null);
  const [lossReason, setLossReason] = useState<string>("pas_de_réponse");
  const [lossNote, setLossNote] = useState<string>("");

  const handleOpenOpportunity = (opp: Suivi) => {
    // Click sur une card → ouvre la modale de détails (pas de navigation)
    setDetailOpp(opp);
  };

  const handleMoveStage = async (opp: Suivi, newStage: PipelineStage) => {
    try {
      const { error } = await supabase
        .from("suivis")
        .update({
          pipeline_stage: newStage,
          updated_at: new Date().toISOString(),
        })
        .eq("id", opp.id);

      if (error) throw error;

      toast({
        title: "Opportunité déplacée",
        description: `Stage : ${newStage.replace(/_/g, " ")}`,
      });
      refetch();
    } catch (err: any) {
      toast({
        title: "Erreur",
        description: err.message || "Impossible de déplacer l'opportunité",
        variant: "destructive",
      });
    }
  };

  const handleConfirmLost = async () => {
    if (!lostOpp) return;
    try {
      const fullReason = lossNote
        ? `${LOSS_REASONS.find((r) => r.value === lossReason)?.label} — ${lossNote}`
        : LOSS_REASONS.find((r) => r.value === lossReason)?.label || lossReason;

      const { error } = await supabase
        .from("suivis")
        .update({
          status: "archived",
          pipeline_stage: "perdu",
          loss_reason: fullReason,
          completed_at: new Date().toISOString(),
        })
        .eq("id", lostOpp.id);

      if (error) throw error;

      toast({
        title: "Opportunité archivée",
        description: "Marquée comme perdue. Visible dans l'historique.",
      });
      setLostOpp(null);
      setLossReason("pas_de_réponse");
      setLossNote("");
      refetch();
    } catch (err: any) {
      toast({
        title: "Erreur",
        description: err.message || "Impossible d'archiver l'opportunité",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl blur-lg opacity-50" />
            <div className="relative p-4 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-xl">
              <TrendingUp className="h-7 w-7 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Pipeline commercial
            </h1>
            <p className="text-muted-foreground">
              {totalCount} opportunité{totalCount > 1 ? "s" : ""} active
              {totalCount > 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* Vue Kanban */}
      <Card className="border-0 shadow-lg bg-card/80 backdrop-blur">
        <CardContent className="p-4">
          <PipelineKanban
            onOpenOpportunity={handleOpenOpportunity}
            onMoveStage={handleMoveStage}
            onMarkLost={(opp) => setLostOpp(opp)}
          />
        </CardContent>
      </Card>

      {/* Modale détail opportunité (click sur card) */}
      <OpportunityDetailDialog
        opportunity={detailOpp}
        open={!!detailOpp}
        onOpenChange={(open) => !open && setDetailOpp(null)}
        onMoveStage={handleMoveStage}
        onMarkLost={(opp) => {
          setDetailOpp(null);
          setLostOpp(opp);
        }}
      />

      {/* Modale "Marquer perdu" */}
      <AlertDialog open={!!lostOpp} onOpenChange={(open) => !open && setLostOpp(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Marquer cette opportunité perdue ?</AlertDialogTitle>
            <AlertDialogDescription>
              L'opportunité sera archivée et déplacée vers l'historique.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 my-4">
            <div className="space-y-2">
              <Label htmlFor="loss_reason">Motif</Label>
              <Select value={lossReason} onValueChange={setLossReason}>
                <SelectTrigger id="loss_reason">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOSS_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="loss_note">Commentaire (optionnel)</Label>
              <Textarea
                id="loss_note"
                placeholder="Précisions sur la perte..."
                value={lossNote}
                onChange={(e) => setLossNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmLost}
              className="bg-red-600 hover:bg-red-700"
            >
              Marquer perdue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
