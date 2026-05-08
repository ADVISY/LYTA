import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileSignature, Upload, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserTenant } from "@/hooks/useUserTenant";
import PendingSignaturesPanel from "@/components/signatures/PendingSignaturesPanel";
import ImportDocumentForSignatureDialog from "@/components/signatures/ImportDocumentForSignatureDialog";
import { cn } from "@/lib/utils";

type ClientLite = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
};

function clientLabel(c: ClientLite): string {
  return (
    c.company_name?.trim() ||
    `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() ||
    c.email ||
    "Client sans nom"
  );
}

export default function CRMSignatures() {
  const { tenantId } = useUserTenant();
  const [importOpen, setImportOpen] = useState(false);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!tenantId) return;
    supabase
      .from("clients")
      .select("id, first_name, last_name, company_name, email")
      .eq("tenant_id", tenantId)
      .eq("type_adresse", "client")
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data }) => {
        setClients((data ?? []) as ClientLite[]);
      });
  }, [tenantId]);

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
            <FileSignature className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Signatures électroniques</h1>
            <p className="text-muted-foreground">
              Envoyez des documents à signer à distance et suivez leur statut.
            </p>
          </div>
        </div>
        <Button
          onClick={() => setImportOpen(true)}
          disabled={!selectedClientId}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/20"
        >
          <Upload className="h-4 w-4 mr-2" />
          Importer un document
        </Button>
      </div>

      {/* Sélecteur de client pour l'import */}
      <Card className="border-0 shadow-md bg-card/80 backdrop-blur">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="text-sm font-medium text-muted-foreground sm:w-72">
              <Sparkles className="inline h-4 w-4 mr-1 text-amber-500" />
              Pour envoyer un document, choisis d'abord le client :
            </div>
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Sélectionner un client…" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {clientLabel(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!selectedClientId && (
            <p className={cn("text-xs text-muted-foreground mt-2 italic")}>
              Le bouton « Importer un document » s'active une fois un client choisi.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Liste GLOBALE des signatures du tenant (clientId non fourni) */}
      <PendingSignaturesPanel refreshTick={refreshTick} />

      {/* Dialog d'import — s'ouvre uniquement quand un client est sélectionné */}
      {selectedClient && (
        <ImportDocumentForSignatureDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          clientId={selectedClient.id}
          clientLabel={clientLabel(selectedClient)}
          onSent={() => {
            setImportOpen(false);
            setRefreshTick((t) => t + 1);
          }}
        />
      )}
    </div>
  );
}
