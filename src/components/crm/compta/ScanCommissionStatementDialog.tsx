import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, FileText, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/contexts/TenantContext";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded?: (statementId: string) => void;
}

const MONTHS = [
  { value: 1, label: "Janvier" }, { value: 2, label: "Février" }, { value: 3, label: "Mars" },
  { value: 4, label: "Avril" }, { value: 5, label: "Mai" }, { value: 6, label: "Juin" },
  { value: 7, label: "Juillet" }, { value: 8, label: "Août" }, { value: 9, label: "Septembre" },
  { value: 10, label: "Octobre" }, { value: 11, label: "Novembre" }, { value: 12, label: "Décembre" },
];

export default function ScanCommissionStatementDialog({ open, onOpenChange, onUploaded }: Props) {
  const { toast } = useToast();
  const { tenant } = useTenant();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [periodYear, setPeriodYear] = useState<number>(new Date().getFullYear());
  const [periodMonth, setPeriodMonth] = useState<number>(new Date().getMonth() + 1);
  const [uploading, setUploading] = useState(false);

  const reset = () => {
    setFile(null);
    setPeriodYear(new Date().getFullYear());
    setPeriodMonth(new Date().getMonth() + 1);
  };

  const handleFile = (f: File | null) => {
    if (!f) return;
    if (f.type !== "application/pdf") {
      toast({ title: "Format non supporté", description: "Seuls les PDF sont acceptés pour l'instant.", variant: "destructive" });
      return;
    }
    if (f.size > 25 * 1024 * 1024) {
      toast({ title: "Fichier trop lourd", description: "Maximum 25 MB.", variant: "destructive" });
      return;
    }
    setFile(f);
  };

  const handleUpload = async () => {
    if (!file || !tenant?.id) return;
    setUploading(true);
    try {
      // 1. Upload du PDF dans Supabase Storage
      const fileKey = `commission-statements/${tenant.id}/${Date.now()}_${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error: storageError } = await supabase.storage
        .from("documents")
        .upload(fileKey, file, { contentType: "application/pdf", upsert: false });
      if (storageError) throw storageError;

      // 2. Création de la row commission_statements
      const { data: stmt, error: insertError } = await supabase
        .from("commission_statements")
        .insert({
          tenant_id: tenant.id,
          period_year: periodYear,
          period_month: periodMonth,
          original_file_key: fileKey,
          original_file_name: file.name,
          mime_type: "application/pdf",
          status: "pending",
        })
        .select("id")
        .single();
      if (insertError) throw insertError;

      toast({
        title: "Décompte envoyé",
        description: "L'IA analyse le décompte… (peut prendre 30-90 secondes pour un PDF long)",
      });

      reset();
      onOpenChange(false);
      onUploaded?.(stmt.id);

      // 3. Déclencher le scan IA en arrière-plan (fire-and-forget côté UI).
      // L'edge function tourne ~30-90s ; pendant ce temps le broker peut
      // continuer à bosser. La bannière "X commissions à valider" apparaîtra
      // dans CRMCommissions dès que le scan est terminé (au prochain refresh).
      supabase.functions
        .invoke("scan-commission-statement", { body: { statementId: stmt.id } })
        .then(({ error }) => {
          if (error) {
            console.error("scan-commission-statement error", error);
            toast({
              title: "Erreur scan IA",
              description: error.message || "Impossible de scanner le décompte. Réessaye depuis l'écran Commissions.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Décompte analysé",
              description: "Tu peux valider les commissions dans Commissions → bannière 'à valider'.",
            });
          }
        });
    } catch (err: any) {
      console.error("Upload commission statement error", err);
      toast({ title: "Erreur", description: err.message || String(err), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!uploading) onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Scanner un décompte de commissions
          </DialogTitle>
          <DialogDescription>
            Dépose le PDF reçu d'une compagnie (Helsana, AXA, Mobilière, …).
            L'IA va détecter chaque ligne et te permettre de valider chacune
            par client en quelques minutes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Période */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Mois</Label>
              <Select value={String(periodMonth)} onValueChange={(v) => setPeriodMonth(parseInt(v, 10))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Année</Label>
              <Input
                type="number"
                value={periodYear}
                onChange={(e) => setPeriodYear(parseInt(e.target.value, 10) || new Date().getFullYear())}
                min={2020}
                max={2100}
              />
            </div>
          </div>

          {/* Drop zone */}
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/30 transition"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFile(e.dataTransfer.files?.[0] || null);
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
            />
            {file ? (
              <div className="flex items-center justify-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-medium truncate max-w-[260px]">{file.name}</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="text-muted-foreground text-sm">
                <Upload className="h-6 w-6 mx-auto mb-2" />
                Glisse-dépose le PDF ici ou clique pour parcourir
                <p className="text-xs mt-1">PDF, max 25 MB</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
            Annuler
          </Button>
          <Button onClick={handleUpload} disabled={!file || uploading} className="gap-2">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? "Envoi…" : "Lancer le scan IA"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
