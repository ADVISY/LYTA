import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Lock, UserPlus, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AddUserSeatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seatsIncluded: number;
  activeUsers: number;
  seatPrice: number;
  onSuccess?: () => void;
}

export function AddUserSeatDialog({
  open,
  onOpenChange,
  seatsIncluded,
  activeUsers,
  seatPrice,
  onSuccess,
}: AddUserSeatDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUnlock = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("Non authentifié");
      }

      const { data, error: fnError } = await supabase.functions.invoke("add-user-seat", {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.method === "checkout" && data.url) {
        // Redirect to Stripe checkout
        window.open(data.url, "_blank");
        toast.info("Redirection vers Stripe pour le paiement...");
        onOpenChange(false);
      } else if (data.method === "subscription_update") {
        // Seat added directly
        toast.success("Siège utilisateur ajouté avec succès!");
        onSuccess?.();
        onOpenChange(false);
      }
    } catch (err) {
      console.error("Error adding seat:", err);
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
      toast.error("Erreur lors de l'ajout du siège");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <Lock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <DialogTitle className="text-center text-xl">
            Ajouter un utilisateur supplémentaire
          </DialogTitle>
          <DialogDescription className="text-center">
            Débloquez un siège pour ajouter un nouvel utilisateur
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Utilisateurs inclus</span>
              <span className="font-medium">{seatsIncluded}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Utilisateurs actifs</span>
              <span className="font-medium">{activeUsers}</span>
            </div>
            <div className="border-t pt-2 mt-2">
              <div className="flex items-center justify-between">
                <span className="font-medium flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  +1 utilisateur supplémentaire
                </span>
                <span className="font-bold text-primary">+{seatPrice} CHF / mois</span>
              </div>
            </div>
          </div>

          <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
            <CreditCard className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              Ce montant sera ajouté à votre facture mensuelle avec proration.
            </AlertDescription>
          </Alert>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Annuler
          </Button>
          <Button
            onClick={handleUnlock}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Traitement...
              </>
            ) : (
              <>
                <Lock className="mr-2 h-4 w-4" />
                Débloquer et continuer
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
