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
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { DataPagination } from "@/components/ui/DataPagination";
import { PendingScanCard, ScanValidationDialog } from "@/components/crm/propositions";
import { ScanBatchUpload, ScanBatchReview } from "@/components/crm/ia-scan";
import { invokeSupabaseFunction } from "@/lib/edgeFunctions";
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
import lytaSmartFlowLogo from "@/assets/lyta-smartflow-logo.png";

interface ScanDocumentResponse {
  success?: boolean;
  error?: string;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return fallback;
}

const normalizeArray = <T,>(value: any): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed as T[];
    } catch {
      // ignore non-JSON strings
    }
    return [];
  }
  if (value && typeof value === "object") return [value as T];
  return [];
};

const normalizeStringArray = (value: any): string[] =>
  normalizeArray<unknown>(value).filter((item): item is string => typeof item === "string");

export default function CRMPropositions() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const highlightedScanId = searchParams.get('scan');

  const { tenantId } = useTenant();
  const { scans, loading, error, page: scansPage, totalCount: scansTotalCount, totalPages: scansTotalPages, goToPage: scansGoToPage, refresh, rejectScan } = usePendingScans();
  const { batches, loading: batchesLoading, page: batchesPage, totalCount: batchesTotalCount, totalPages: batchesTotalPages, goToPage: batchesGoToPage, fetchBatches } = useScanBatches();
  const [selectedScan, setSelectedScan] = useState<PendingScan | null>(null);
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'scans' | 'batches'>('scans');
  const [showBatchUpload, setShowBatchUpload] = useState(false);
  const [batchIdForSelectedScan, setBatchIdForSelectedScan] = useState<string | null>(null);

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
    setBatchIdForSelectedScan(null);
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
    } catch (err: unknown) {
      toast({
        title: "Erreur",
        description: getErrorMessage(err, "Impossible de rejeter le dossier"),
        variant: "destructive",
      });
    } finally {
      setRejectingId(null);
    }
  };

  const fetchScanForValidation = async (scanId: string): Promise<PendingScan> => {
    const { data: scan, error: scanError } = await supabase
      .from('document_scans')
      .select('*')
      .eq('id', scanId)
      .single();

    if (scanError) throw scanError;

    const [fieldsResult, auditResult] = await Promise.all([
      supabase
        .from('document_scan_results')
        .select('*')
        .eq('scan_id', scanId),
      supabase
        .from('document_scan_audit')
        .select('*')
        .eq('scan_id', scanId)
        .eq('action', 'extracted')
        .order('performed_at', { ascending: false })
        .limit(1),
    ]);

    if (fieldsResult.error) throw fieldsResult.error;
    if (auditResult.error) throw auditResult.error;

    const aiSnapshot = (auditResult.data?.[0]?.ai_response_snapshot as any) || {};
    const rawEngagement = (aiSnapshot.engagement_analysis && typeof aiSnapshot.engagement_analysis === 'object')
      ? aiSnapshot.engagement_analysis
      : undefined;

    return {
      id: scan.id,
      created_at: scan.created_at,
      source_form_type: scan.source_form_type,
      original_file_name: scan.original_file_name,
      original_file_key: scan.original_file_key,
      detected_doc_type: scan.detected_doc_type,
      doc_type_confidence: scan.doc_type_confidence,
      quality_score: scan.quality_score,
      overall_confidence: scan.overall_confidence,
      status: scan.status,
      verified_partner_email: scan.verified_partner_email,
      error_message: scan.error_message,
      dossier_summary: aiSnapshot.dossier_summary,
      documents_detected: normalizeArray(aiSnapshot.documents_detected),
      products_detected: normalizeArray(aiSnapshot.products_detected),
      old_products_detected: normalizeArray(aiSnapshot.old_products_detected),
      new_products_detected: normalizeArray(aiSnapshot.new_products_detected),
      family_members_detected: normalizeArray(aiSnapshot.family_members_detected),
      primary_holder: aiSnapshot.primary_holder,
      has_old_policy: aiSnapshot.has_old_policy,
      has_new_policy: aiSnapshot.has_new_policy,
      has_termination: aiSnapshot.has_termination,
      has_identity_doc: aiSnapshot.has_identity_doc,
      has_multiple_products: aiSnapshot.has_multiple_products,
      has_family_members: aiSnapshot.has_family_members,
      engagement_analysis: rawEngagement
        ? {
            ...rawEngagement,
            warnings: normalizeStringArray(rawEngagement.warnings),
          }
        : undefined,
      workflow_actions: normalizeArray(aiSnapshot.workflow_actions),
      inconsistencies: normalizeStringArray(aiSnapshot.inconsistencies),
      missing_documents: normalizeStringArray(aiSnapshot.missing_documents),
      fields: (fieldsResult.data || []).map((field: any) => ({
        id: field.id,
        field_category: field.field_category,
        field_name: field.field_name,
        extracted_value: field.extracted_value,
        confidence: field.confidence,
        confidence_score: field.confidence_score,
        extraction_notes: field.extraction_notes,
        validated_value: field.validated_value,
      })),
    };
  };

  const handleValidated = () => {
    if (batchIdForSelectedScan) {
      supabase
        .from("scan_batches")
        .update({ status: "validated" })
        .eq("id", batchIdForSelectedScan)
        .then(({ error }) => {
          if (error) {
            toast({
              title: "Erreur",
              description: getErrorMessage(error, "Impossible de marquer le dossier comme validé"),
              variant: "destructive",
            });
          }
          fetchBatches();
        });
    }

    refresh();
    setSelectedScan(null);
    setBatchIdForSelectedScan(null);
  };

  return (
    <div className="space-y-8">
      {/* Header with decorative background */}
      <div className="relative">
        <div className="absolute -inset-4 bg-gradient-to-r from-primary/10 via-secondary/5 to-transparent rounded-3xl blur-2xl" />
        <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <img 
              src={lytaSmartFlowLogo} 
              alt="LYTA Smart Flow" 
              className="h-14 w-auto"
            />
            <div>
              <p className="text-muted-foreground">
                {t('propositions.validateScansSubtitle', 'Validez les dossiers scannés et créez les clients')}
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
                  <DataPagination
                    page={scansPage}
                    totalPages={scansTotalPages}
                    totalCount={scansTotalCount}
                    onPageChange={scansGoToPage}
                  />
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
                      onValidate={async (batchId: string) => {
                        try {
                          if (!tenantId) {
                            throw new Error("Cabinet introuvable pour consolider le dossier");
                          }

                          const batchToConsolidate = batches.find(item => item.id === batchId);
                          const batchDocuments = [...(batchToConsolidate?.documents || [])]
                            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

                          if (batchDocuments.length === 0) {
                            throw new Error("Aucun document à consolider dans ce dossier");
                          }

                          const { data: { user } } = await supabase.auth.getUser();
                          const primaryDocument = batchDocuments[0];

                          const { data: scanRecord, error: scanCreateError } = await supabase
                            .from("document_scans")
                            .insert({
                              tenant_id: tenantId,
                              uploaded_by: user?.id ?? null,
                              source_type: "backoffice",
                              original_file_key: primaryDocument.file_key,
                              original_file_name: `Dossier (${batchDocuments.length} documents)`,
                              mime_type: "batch",
                              status: "pending",
                            })
                            .select("id")
                            .single();

                          if (scanCreateError) throw scanCreateError;

                          await supabase
                            .from("scan_batch_documents")
                            .update({ scan_id: scanRecord.id })
                            .eq("batch_id", batchId);

                          const scanResult = await invokeSupabaseFunction<ScanDocumentResponse>("scan-document", {
                            body: {
                              scanId: scanRecord.id,
                              tenantId,
                              batchMode: true,
                              files: batchDocuments.map(doc => ({
                                path: doc.file_key,
                                fileName: doc.file_name,
                                mimeType: doc.mime_type,
                              })),
                            },
                          });

                          if (!scanResult.success) {
                            throw new Error(scanResult.error || "La consolidation IA a échoué");
                          }

                          const completedScan = await fetchScanForValidation(scanRecord.id);
                          setSelectedScan(completedScan);
                          setBatchIdForSelectedScan(batchId);
                          setValidationDialogOpen(true);
                          setActiveTab("scans");

                          toast({
                            title: "Consolidation terminée",
                            description: "Vérifiez les données extraites avant de créer le client.",
                          });

                          refresh();
                        } catch (err: unknown) {
                          toast({
                            title: "Erreur de consolidation",
                            description: getErrorMessage(err, "Impossible de valider le dossier"),
                            variant: "destructive",
                          });
                        }
                      }}
                    />
                  ))}
                  <DataPagination
                    page={batchesPage}
                    totalPages={batchesTotalPages}
                    totalCount={batchesTotalCount}
                    onPageChange={batchesGoToPage}
                  />
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
