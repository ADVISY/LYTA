import React, { useState, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator, FileText, Printer, Download, Eye, Loader2, Users, Calendar, DollarSign, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCommissions, Commission } from "@/hooks/useCommissions";
import { useCommissionParts, CommissionPart } from "@/hooks/useCommissionParts";
import { useCollaborateursCommission, Collaborateur } from "@/hooks/useCollaborateursCommission";
import { useDocuments } from "@/hooks/useDocuments";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import advisyLogo from "@/assets/advisy-logo.svg";

interface DecompteCommission {
  commission: Commission;
  parts: CommissionPart[];
}

export default function CRMCompta() {
  const { commissions, loading: loadingCommissions } = useCommissions();
  const { fetchCommissionParts } = useCommissionParts();
  const { collaborateurs } = useCollaborateursCommission();
  const { createDocument } = useDocuments();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState("decomptes");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [selectedCollaborateur, setSelectedCollaborateur] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [decompteData, setDecompteData] = useState<DecompteCommission[]>([]);
  const [selectedAgentForPreview, setSelectedAgentForPreview] = useState<Collaborateur | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Filter commissions by date range
  const filteredCommissions = useMemo(() => {
    if (!dateDebut || !dateFin) return [];
    
    const debut = new Date(dateDebut);
    const fin = new Date(dateFin);
    fin.setHours(23, 59, 59, 999);
    
    return commissions.filter(c => {
      const createdAt = new Date(c.created_at);
      return createdAt >= debut && createdAt <= fin;
    });
  }, [commissions, dateDebut, dateFin]);

  // Get collaborateur name
  const getCollaborateurName = (collab: Collaborateur) => {
    return `${collab.first_name || ''} ${collab.last_name || ''}`.trim() || collab.email || 'Inconnu';
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF' }).format(amount);
  };

  // Generate decompte for a specific agent
  const handleGenerateDecompte = async () => {
    if (!dateDebut || !dateFin) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner une période",
        variant: "destructive"
      });
      return;
    }

    if (!selectedCollaborateur) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un collaborateur",
        variant: "destructive"
      });
      return;
    }

    setGenerating(true);
    try {
      const debut = new Date(dateDebut);
      debut.setHours(0, 0, 0, 0);
      const fin = new Date(dateFin);
      fin.setHours(23, 59, 59, 999);
      
      console.log("Generating decompte for:", selectedCollaborateur);
      console.log("Date range:", debut, "to", fin);
      console.log("All commissions:", commissions.length);
      
      // Filter commissions by date range here instead of relying on filteredCommissions
      const commissionsInRange = commissions.filter(c => {
        const createdAt = new Date(c.created_at);
        return createdAt >= debut && createdAt <= fin;
      });
      
      console.log("Commissions in date range:", commissionsInRange.length);
      
      const decomptes: DecompteCommission[] = [];
      
      // Loop through filtered commissions and fetch their parts
      for (const commission of commissionsInRange) {
        const parts = await fetchCommissionParts(commission.id);
        console.log("Commission", commission.id, "has parts:", parts.length);
        
        // Check if this collaborator has a part in this commission
        const agentPart = parts.find((p: CommissionPart) => p.agent_id === selectedCollaborateur);
        if (agentPart) {
          console.log("Found part for agent:", agentPart);
          decomptes.push({ commission, parts });
        }
      }
      
      console.log("Total decomptes found:", decomptes.length);
      
      if (decomptes.length === 0) {
        toast({
          title: "Aucune commission",
          description: "Aucune commission trouvée pour ce collaborateur sur cette période",
        });
        setGenerating(false);
        return;
      }
      
      setDecompteData(decomptes);
      
      // Find selected agent for preview
      const agent = collaborateurs.find(c => c.id === selectedCollaborateur);
      setSelectedAgentForPreview(agent || null);
      
      setPreviewOpen(true);
    } catch (error) {
      console.error("Error generating decompte:", error);
      toast({
        title: "Erreur",
        description: "Erreur lors de la génération du décompte",
        variant: "destructive"
      });
    } finally {
      setGenerating(false);
    }
  };

  // Print the decompte
  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Décompte de Commissions - Advisy</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Inter', sans-serif; padding: 20px; color: #1a1a2e; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #1800AD; }
            .logo { height: 60px; }
            .title { text-align: right; }
            .title h1 { font-size: 24px; color: #1800AD; margin-bottom: 5px; }
            .title p { color: #666; font-size: 14px; }
            .agent-info { background: linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%); padding: 20px; border-radius: 10px; margin-bottom: 30px; }
            .agent-info h2 { color: #1800AD; margin-bottom: 10px; font-size: 18px; }
            .agent-info p { color: #444; margin: 5px 0; }
            .summary { display: flex; gap: 20px; margin-bottom: 30px; }
            .summary-card { flex: 1; background: #f8f9ff; padding: 15px; border-radius: 10px; text-align: center; }
            .summary-card .value { font-size: 24px; font-weight: 700; color: #1800AD; }
            .summary-card .label { font-size: 12px; color: #666; margin-top: 5px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { background: #1800AD; color: white; padding: 12px 10px; text-align: left; font-size: 12px; }
            td { padding: 10px; border-bottom: 1px solid #eee; font-size: 12px; }
            tr:nth-child(even) { background: #f9f9f9; }
            .amount { font-weight: 600; color: #059669; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 11px; }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // Save decompte to agent's documents
  const handleSaveToDocuments = async () => {
    if (!selectedAgentForPreview || decompteData.length === 0) {
      toast({
        title: "Info",
        description: "Sélectionnez un collaborateur spécifique pour sauvegarder le document",
      });
      return;
    }

    try {
      const fileName = `Decompte_${selectedAgentForPreview.first_name}_${selectedAgentForPreview.last_name}_${dateDebut}_${dateFin}.pdf`;
      
      // Create a document record for the agent
      await createDocument({
        owner_id: selectedAgentForPreview.id,
        owner_type: 'client',
        file_name: fileName,
        file_key: `decomptes/${selectedAgentForPreview.id}/${fileName}`,
        doc_kind: 'decompte_commission',
        mime_type: 'application/pdf',
      });

      toast({
        title: "Document sauvegardé",
        description: `Le décompte a été ajouté aux documents de ${getCollaborateurName(selectedAgentForPreview)}`,
      });
    } catch (error) {
      console.error("Error saving document:", error);
      toast({
        title: "Erreur",
        description: "Erreur lors de la sauvegarde du document",
        variant: "destructive"
      });
    }
  };

  // Calculate totals for the preview
  const previewTotals = useMemo(() => {
    let totalCommissions = 0;
    let totalAgentAmount = 0;
    let commissionsCount = 0;
    let reserveRate = selectedAgentForPreview?.reserve_rate || 0;

    decompteData.forEach(({ commission, parts }) => {
      totalCommissions += Number(commission.amount) || 0;
      commissionsCount++;
      
      if (selectedAgentForPreview) {
        const agentPart = parts.find(p => p.agent_id === selectedAgentForPreview.id);
        if (agentPart) {
          totalAgentAmount += Number(agentPart.amount) || 0;
        }
      } else {
        parts.forEach(p => {
          totalAgentAmount += Number(p.amount) || 0;
        });
      }
    });

    const reserveAmount = (totalAgentAmount * reserveRate) / 100;
    const netAmount = totalAgentAmount - reserveAmount;

    return { totalCommissions, totalAgentAmount, commissionsCount, reserveRate, reserveAmount, netAmount };
  }, [decompteData, selectedAgentForPreview]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative">
        <div className="absolute -inset-4 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent rounded-3xl blur-2xl" />
        <div className="relative flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl blur-lg opacity-50" />
            <div className="relative p-4 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-xl">
              <Calculator className="h-7 w-7 text-white" />
            </div>
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Comptabilité
            </h1>
            <p className="text-muted-foreground">Décomptes de commissions et fiches de salaire</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="decomptes" className="gap-2">
            <FileText className="h-4 w-4" />
            Décomptes
          </TabsTrigger>
          <TabsTrigger value="salaires" className="gap-2">
            <DollarSign className="h-4 w-4" />
            Fiches de salaire
          </TabsTrigger>
        </TabsList>

        {/* Décomptes Tab */}
        <TabsContent value="decomptes" className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Générer un décompte de commissions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Date de début</Label>
                  <Input
                    type="date"
                    value={dateDebut}
                    onChange={(e) => setDateDebut(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date de fin</Label>
                  <Input
                    type="date"
                    value={dateFin}
                    onChange={(e) => setDateFin(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Collaborateur <span className="text-destructive">*</span></Label>
                  <Select value={selectedCollaborateur} onValueChange={setSelectedCollaborateur}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un collaborateur" />
                    </SelectTrigger>
                    <SelectContent>
                      {collaborateurs.map((collab) => (
                        <SelectItem key={collab.id} value={collab.id}>
                          {getCollaborateurName(collab)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Preview of commissions in range */}
              {dateDebut && dateFin && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Badge variant="secondary" className="text-lg px-4 py-2">
                        {filteredCommissions.length} commission{filteredCommissions.length > 1 ? 's' : ''}
                      </Badge>
                      <span className="text-muted-foreground">
                        du {format(new Date(dateDebut), 'dd MMM yyyy', { locale: fr })} au {format(new Date(dateFin), 'dd MMM yyyy', { locale: fr })}
                      </span>
                    </div>
                    <span className="text-lg font-bold text-emerald-600">
                      {formatCurrency(filteredCommissions.reduce((sum, c) => sum + Number(c.amount || 0), 0))}
                    </span>
                  </div>
                </div>
              )}

              <Button 
                onClick={handleGenerateDecompte}
                disabled={generating || !dateDebut || !dateFin || !selectedCollaborateur}
                className="gap-2"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Génération...
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4" />
                    Générer et prévisualiser
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fiches de salaire Tab */}
        <TabsContent value="salaires" className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Fiches de salaire
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Fonctionnalité à venir - Génération de fiches de salaire pour les collaborateurs
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Prévisualisation du décompte</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
                  <Printer className="h-4 w-4" />
                  Imprimer
                </Button>
                {selectedAgentForPreview && (
                  <Button size="sm" onClick={handleSaveToDocuments} className="gap-2">
                    <Download className="h-4 w-4" />
                    Sauvegarder
                  </Button>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Printable content */}
          <div ref={printRef} className="bg-white p-6 rounded-lg">
            {/* Header */}
            <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-primary">
              <img src={advisyLogo} alt="Advisy" className="h-16" />
              <div className="text-right">
                <h1 className="text-2xl font-bold text-primary">Décompte de Commissions</h1>
                <p className="text-muted-foreground">
                  Période: {dateDebut && format(new Date(dateDebut), 'dd/MM/yyyy')} - {dateFin && format(new Date(dateFin), 'dd/MM/yyyy')}
                </p>
                <p className="text-sm text-muted-foreground">
                  Généré le: {format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                </p>
              </div>
            </div>

            {/* Agent Info */}
            {selectedAgentForPreview && (
              <div className="bg-gradient-to-r from-primary/5 to-primary/10 p-5 rounded-xl mb-6">
                <h2 className="text-lg font-semibold text-primary mb-2">Collaborateur</h2>
                <p className="font-medium text-lg">{getCollaborateurName(selectedAgentForPreview)}</p>
                <p className="text-muted-foreground">{selectedAgentForPreview.email}</p>
                {previewTotals.reserveRate > 0 && (
                  <p className="text-orange-600 text-sm mt-2">
                    Compte de réserve: {previewTotals.reserveRate}%
                  </p>
                )}
              </div>
            )}

            {/* Summary Cards */}
            <div className={`grid gap-4 mb-6 ${previewTotals.reserveRate > 0 ? 'grid-cols-4' : 'grid-cols-2'}`}>
              <div className="bg-muted/50 p-4 rounded-xl text-center">
                <p className="text-2xl font-bold text-primary">{previewTotals.commissionsCount}</p>
                <p className="text-sm text-muted-foreground">Commissions</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-xl text-center">
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(previewTotals.totalAgentAmount)}</p>
                <p className="text-sm text-muted-foreground">Total brut</p>
              </div>
              {previewTotals.reserveRate > 0 && (
                <>
                  <div className="bg-orange-50 p-4 rounded-xl text-center">
                    <p className="text-2xl font-bold text-orange-600">-{formatCurrency(previewTotals.reserveAmount)}</p>
                    <p className="text-sm text-muted-foreground">Réserve ({previewTotals.reserveRate}%)</p>
                  </div>
                  <div className="bg-emerald-50 p-4 rounded-xl text-center">
                    <p className="text-2xl font-bold text-emerald-600">{formatCurrency(previewTotals.netAmount)}</p>
                    <p className="text-sm text-muted-foreground">Net à percevoir</p>
                  </div>
                </>
              )}
              {previewTotals.reserveRate === 0 && (
                <div className="bg-emerald-50 p-4 rounded-xl text-center">
                  <p className="text-2xl font-bold text-emerald-600">{formatCurrency(previewTotals.totalAgentAmount)}</p>
                  <p className="text-sm text-muted-foreground">Total à percevoir</p>
                </div>
              )}
            </div>

            {/* Commissions Table */}
            <Table>
              <TableHeader>
                <TableRow className="bg-primary">
                  <TableHead className="text-white">Date</TableHead>
                  <TableHead className="text-white">Client</TableHead>
                  <TableHead className="text-white">Produit</TableHead>
                  <TableHead className="text-white">N° Police</TableHead>
                  <TableHead className="text-white">Agent</TableHead>
                  <TableHead className="text-white">Manager</TableHead>
                  <TableHead className="text-white text-right">Montant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {decompteData.map(({ commission, parts }) => {
                  const clientName = commission.policy?.client?.company_name || 
                    `${commission.policy?.client?.first_name || ''} ${commission.policy?.client?.last_name || ''}`.trim();
                  
                  // Find agent and manager parts
                  const agentPart = selectedAgentForPreview 
                    ? parts.find(p => p.agent_id === selectedAgentForPreview.id)
                    : parts.find(p => !p.agent?.last_name?.includes('Manager'));
                  
                  const managerPart = parts.find(p => p.agent?.last_name?.includes('Manager') || (p.agent_id !== agentPart?.agent_id));
                  
                  const agentName = agentPart?.agent 
                    ? `${agentPart.agent.first_name || ''} ${agentPart.agent.last_name || ''}`.trim()
                    : '-';
                  
                  const managerName = managerPart?.agent
                    ? `${managerPart.agent.first_name || ''} ${managerPart.agent.last_name || ''}`.trim()
                    : '-';

                  return (
                    <TableRow key={commission.id}>
                      <TableCell className="text-sm">
                        {format(new Date(commission.created_at), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="font-medium">{clientName || '-'}</TableCell>
                      <TableCell className="text-sm">{commission.policy?.product?.name || '-'}</TableCell>
                      <TableCell className="font-mono text-sm">{commission.policy?.policy_number || '-'}</TableCell>
                      <TableCell className="text-sm">{agentName}</TableCell>
                      <TableCell className="text-sm">{managerName}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-600">
                        {agentPart ? formatCurrency(Number(agentPart.amount)) : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t text-center text-sm text-muted-foreground">
              <p>Advisy Sàrl • Conseil en assurances</p>
              <p>Ce document est généré automatiquement et fait foi de décompte de commissions.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}