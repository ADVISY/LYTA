import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { usePendingScans, PendingScan } from "@/hooks/usePendingScans";
import { useScanBatches } from "@/hooks/useScanBatches";
import { PendingScanCard, ScanValidationDialog } from "@/components/crm/propositions";
import { ScanBatchUpload, ScanBatchReview } from "@/components/crm/ia-scan";
import {
  FileText,
  Plus,
  Send,
  FileClock,
  FileCheck,
  FileX,
  RefreshCw,
  Sparkles,
  Inbox,
  Loader2,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function CRMPropositions() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const highlightedScanId = searchParams.get('scan');

  const { scans, loading, error, refresh, rejectScan } = usePendingScans();
  const { batches, loading: batchesLoading, fetchBatches } = useScanBatches();
  const [selectedScan, setSelectedScan] = useState<PendingScan | null>(null);
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'scans' | 'batches'>('scans');
  const [showBatchUpload, setShowBatchUpload] = useState(false);

  // Filter batches - only show classified ones
  const pendingBatches = batches.filter(b => b.status === 'classified');

  // Filter scans by status
  const pendingScans = scans.filter(s => s.status === 'completed' || s.status === 'processing');
  const allScans = scans;

  // Stats
  const processingCount = scans.filter(s => s.status === 'processing').length;
  const completedCount = scans.filter(s => s.status === 'completed').length;
  const lowConfidenceCount = scans.filter(s => 
    s.fields.some(f => f.confidence === 'low')
  ).length;

  const statsCards = [
    { label: "En attente", value: completedCount.toString(), icon: FileClock, color: "from-cyan-500 to-blue-600" },
    { label: "En cours", value: processingCount.toString(), icon: Send, color: "from-amber-500 to-orange-600" },
    { label: "À vérifier", value: lowConfidenceCount.toString(), icon: FileX, color: "from-red-500 to-rose-600" },
    { label: "Ce mois", value: scans.length.toString(), icon: FileCheck, color: "from-emerald-500 to-teal-600" },
  ];

  const handleValidate = (scan: PendingScan) => {
    setSelectedScan(scan);
    setValidationDialogOpen(true);
  };

  const handleReject = async (scanId: string) => {
    setRejectingId(scanId);
    try {
      const { error } = await rejectScan(scanId);
      if (error) throw error;
      toast({
        title: "Dossier rejeté",
        description: "Le dossier a été marqué comme rejeté",
      });
    } catch (err: any) {
      toast({
        title: "Erreur",
        description: err.message || "Impossible de rejeter le dossier",
        variant: "destructive",
      });
    } finally {
      setRejectingId(null);
    }
  };

  const handleValidated = () => {
    refresh();
    setSelectedScan(null);
  };

  return (
    <div className="space-y-8">
      {/* Header with decorative background */}
      <div className="relative">
        <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/10 via-blue-500/5 to-transparent rounded-3xl blur-2xl" />
        <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl blur-lg opacity-50" />
              <div className="relative p-4 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-xl">
                <Sparkles className="h-7 w-7 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Dépôts IA Scan
              </h1>
              <p className="text-muted-foreground">
                Validez les dossiers scannés et créez les clients
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => refresh()}
            disabled={loading}
            className="gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Actualiser
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {statsCards.map((stat, index) => (
          <Card
            key={stat.label}
            className="group border-0 shadow-lg bg-white/80 dark:bg-card/80 backdrop-blur hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 overflow-hidden"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className={cn(
              "absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-10 blur-2xl bg-gradient-to-br",
              stat.color
            )} />
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />

            <CardContent className="p-5 relative">
              <div className="flex items-center gap-3 mb-4">
                <div className={cn(
                  "p-2.5 rounded-xl bg-gradient-to-br shadow-lg group-hover:scale-110 transition-transform duration-300",
                  stat.color
                )}>
                  <stat.icon className="h-4 w-4 text-white" />
                </div>
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main content with tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'scans' | 'batches')}>
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="scans" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Scans individuels
              {pendingScans.length > 0 && (
                <Badge variant="secondary" className="ml-1">{pendingScans.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="batches" className="gap-2">
              <FolderOpen className="h-4 w-4" />
              Dossiers multi-docs
              {pendingBatches.length > 0 && (
                <Badge variant="secondary" className="ml-1">{pendingBatches.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {activeTab === 'batches' && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowBatchUpload(!showBatchUpload)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Nouveau dossier
            </Button>
          )}
        </div>

        {/* Batch upload section */}
        {showBatchUpload && activeTab === 'batches' && (
          <div className="mb-6">
            <ScanBatchUpload
              onBatchCreated={(batchId) => {
                setShowBatchUpload(false);
                fetchBatches();
              }}
            />
          </div>
        )}

        <TabsContent value="scans">
          <Card className="border-0 shadow-xl overflow-hidden">
            <CardHeader className="border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Inbox className="h-5 w-5 text-primary" />
                    Scans à valider
                  </CardTitle>
                  <CardDescription>
                    {pendingScans.length} scan(s) en attente de validation
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6">
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-32 w-full rounded-lg" />
                  ))}
                </div>
              ) : error ? (
                <div className="text-center py-12 text-destructive">
                  <FileX className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Erreur de chargement: {error}</p>
                  <Button type="button" variant="outline" onClick={refresh} className="mt-4">
                    Réessayer
                  </Button>
                </div>
              ) : pendingScans.length === 0 ? (
                <div className="text-center py-16">
                  <div className="relative inline-block mb-6">
                    <div className="absolute inset-0 bg-primary/30 rounded-3xl blur-2xl opacity-30 animate-pulse" />
                    <div className="relative w-24 h-24 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <Inbox className="h-12 w-12 text-primary" />
                    </div>
                  </div>
                  <p className="text-xl font-bold text-foreground">
                    Aucun scan en attente
                  </p>
                  <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                    Les nouveaux dossiers scannés via le formulaire de dépôt apparaîtront ici.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingScans.map(scan => (
                    <div
                      key={scan.id}
                      className={cn(
                        "transition-all",
                        highlightedScanId === scan.id && "ring-2 ring-primary ring-offset-2 rounded-lg"
                      )}
                    >
                      <PendingScanCard
                        scan={scan}
                        onValidate={handleValidate}
                        onReject={handleReject}
                        isRejecting={rejectingId === scan.id}
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="batches">
          <Card className="border-0 shadow-xl overflow-hidden">
            <CardHeader className="border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FolderOpen className="h-5 w-5 text-primary" />
                    Dossiers Multi-Documents
                  </CardTitle>
                  <CardDescription>
                    {pendingBatches.length} dossier(s) classifié(s) en attente de consolidation
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6">
              {batchesLoading ? (
                <div className="space-y-4">
                  {[1, 2].map(i => (
                    <Skeleton key={i} className="h-48 w-full rounded-lg" />
                  ))}
                </div>
              ) : pendingBatches.length === 0 ? (
                <div className="text-center py-16">
                  <div className="relative inline-block mb-6">
                    <div className="absolute inset-0 bg-primary/30 rounded-3xl blur-2xl opacity-30 animate-pulse" />
                    <div className="relative w-24 h-24 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <FolderOpen className="h-12 w-12 text-primary" />
                    </div>
                  </div>
                  <p className="text-xl font-bold text-foreground">
                    Aucun dossier multi-documents
                  </p>
                  <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                    Utilisez "Nouveau dossier" pour uploader plusieurs documents à la fois.
                    L'IA classifiera automatiquement chaque pièce.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowBatchUpload(true)}
                    className="mt-6 gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Créer un dossier
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {pendingBatches.map(batch => (
                    <ScanBatchReview
                      key={batch.id}
                      batch={batch}
                      onValidate={() => {
                        // TODO: Open consolidation dialog
                        toast({
                          title: "Consolidation",
                          description: "La consolidation multi-documents sera implémentée prochainement",
                        });
                      }}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Validation Dialog */}
      <ScanValidationDialog
        scan={selectedScan}
        open={validationDialogOpen}
        onOpenChange={setValidationDialogOpen}
        onValidated={handleValidated}
      />
    </div>
  );
}
