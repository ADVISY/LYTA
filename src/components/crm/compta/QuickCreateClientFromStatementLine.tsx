/**
 * Smartflow Décomptes — création rapide d'un client depuis une ligne no_match.
 * Pré-rempli avec les données détectées par l'IA dans le décompte. Après
 * création, la ligne est re-linkée au nouveau client et le caller peut
 * enchaîner avec CommissionForm pour valider la commission.
 */
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, UserPlus, SkipForward } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/contexts/TenantContext";
import { invokeSupabaseFunction } from "@/lib/edgeFunctions";

export type QuickCreateLine = {
  id: string;
  raw_client_first_name: string | null;
  raw_client_last_name: string | null;
  raw_client_full_name: string | null;
  raw_policy_number: string | null;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  line: QuickCreateLine | null;
  /** Appelé quand le client est créé et la ligne re-linkée. Reçoit le client_id créé. */
  onClientCreated?: (clientId: string, lineId: string) => void;
  /** Appelé quand l'utilisateur skip cette ligne. */
  onSkip?: (lineId: string) => void;
}

export default function QuickCreateClientFromStatementLine({
  open, onOpenChange, line, onClientCreated, onSkip,
}: Props) {
  const { toast } = useToast();
  const { tenant } = useTenant();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  // Pré-remplir à chaque ouverture
  useEffect(() => {
    if (!open || !line) return;
    let first = line.raw_client_first_name || "";
    let last  = line.raw_client_last_name  || "";
    if ((!first || !last) && line.raw_client_full_name) {
      const parts = line.raw_client_full_name.trim().split(/\s+/);
      if (parts.length >= 2) {
        first = first || parts[0];
        last  = last  || parts.slice(1).join(" ");
      } else {
        last = last || parts[0];
      }
    }
    setFirstName(first);
    setLastName(last);
    setEmail("");
    setPhone("");
  }, [open, line]);

  const handleCreate = async () => {
    if (!line || !tenant?.id) return;
    if (!firstName.trim() && !lastName.trim()) {
      toast({ title: "Nom requis", description: "Renseigne au moins le prénom ou le nom.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // 1. Création du client via edge function create-client (bypass RLS).
      //    Cf. bug systémique 42501 sur INSERT direct rest/v1/clients.
      const createResult = await invokeSupabaseFunction<{ success: boolean; id: string }>(
        "create-client",
        {
          body: {
            tenant_id: tenant.id,
            first_name: firstName.trim() || null,
            last_name: lastName.trim() || null,
            email: email.trim() || null,
            phone: phone.trim() || null,
            status: "active",
          },
        },
      );
      if (!createResult?.success || !createResult?.id) {
        throw new Error("Création client échouée");
      }
      const created = { id: createResult.id };

      // 2. Re-link de la ligne de décompte
      await supabase
        .from("commission_statement_lines")
        .update({
          matched_client_id: created.id,
          match_status: "manual_match",
          match_score: 1.0,
        })
        .eq("id", line.id);

      toast({ title: "Client créé", description: `${firstName} ${lastName}`.trim() });
      onClientCreated?.(created.id, line.id);
      onOpenChange(false);
    } catch (err: any) {
      console.error("Quick create client error", err);
      toast({ title: "Erreur", description: err.message || String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    if (!line) return;
    try {
      await supabase
        .from("commission_statement_lines")
        .update({ match_status: "skipped" })
        .eq("id", line.id);
      onSkip?.(line.id);
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message || String(err), variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Créer ce client
          </DialogTitle>
          <DialogDescription>
            L'IA a détecté un client absent de ton CRM. Crée-le rapidement
            pour pouvoir enregistrer sa commission.
            {line?.raw_policy_number && (
              <> Police détectée : <strong>{line.raw_policy_number}</strong>.</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qcc-first">Prénom</Label>
              <Input id="qcc-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Pierre" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qcc-last">Nom</Label>
              <Input id="qcc-last" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Dupont" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qcc-email">Email (optionnel)</Label>
            <Input id="qcc-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pierre.dupont@example.ch" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qcc-phone">Téléphone (optionnel)</Label>
            <Input id="qcc-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+41 79 ..." />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleSkip} disabled={saving} className="gap-2">
            <SkipForward className="h-4 w-4" />
            Passer au suivant
          </Button>
          <Button onClick={handleCreate} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Créer ce client
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
