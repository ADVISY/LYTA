import React, { useState, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Calculator, FileText, Printer, Download, Eye, Loader2, Users, Calendar, DollarSign, FileDown, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCommissions, Commission } from "@/hooks/useCommissions";
import { useCommissionParts, CommissionPart } from "@/hooks/useCommissionParts";
import { useCollaborateursCommission, Collaborateur } from "@/hooks/useCollaborateursCommission";
import { useDocuments } from "@/hooks/useDocuments";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import advisyLogo from "@/assets/advisy-logo.svg";
import html2pdf from "html2pdf.js";

interface DecompteCommission {
  commission: Commission;
  parts: CommissionPart[];
}

interface CollaborateurDecompte {
  collaborateur: Collaborateur;
  decomptes: DecompteCommission[];
  totals: {
    totalCommissions: number;
    totalAgentAmount: number;
    commissionsCount: number;
    reserveRate: number;
    reserveAmount: number;
    netAmount: number;
  };
}

export default function CRMCompta() {
  const { commissions, loading: loadingCommissions } = useCommissions();
  const { fetchCommissionParts } = useCommissionParts();
  const { collaborateurs, loading: loadingCollaborateurs } = useCollaborateursCommission();
  const { createDocument } = useDocuments();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState("decomptes");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [selectedCollaborateurs, setSelectedCollaborateurs] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [allDecomptes, setAllDecomptes] = useState<CollaborateurDecompte[]>([]);
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

  // Toggle collaborateur selection
  const toggleCollaborateur = (collabId: string) => {
    setSelectedCollaborateurs(prev => 
      prev.includes(collabId) 
        ? prev.filter(id => id !== collabId)
        : [...prev, collabId]
    );
  };

  // Select all collaborateurs
  const selectAllCollaborateurs = () => {
    if (selectedCollaborateurs.length === collaborateurs.length) {
      setSelectedCollaborateurs([]);
    } else {
      setSelectedCollaborateurs(collaborateurs.map(c => c.id));
    }
  };

  // Calculate totals for a collaborateur
  const calculateTotals = (decomptes: DecompteCommission[], collaborateur: Collaborateur) => {
    let totalCommissions = 0;
    let totalAgentAmount = 0;
    let commissionsCount = 0;
    const reserveRate = collaborateur.reserve_rate || 0;

    decomptes.forEach(({ commission, parts }) => {
      totalCommissions += Number(commission.amount) || 0;
      commissionsCount++;
      
      const agentPart = parts.find(p => p.agent_id === collaborateur.id);
      if (agentPart) {
        totalAgentAmount += Number(agentPart.amount) || 0;
      }
    });

    const reserveAmount = (totalAgentAmount * reserveRate) / 100;
    const netAmount = totalAgentAmount - reserveAmount;

    return { totalCommissions, totalAgentAmount, commissionsCount, reserveRate, reserveAmount, netAmount };
  };

  // Generate decomptes for all selected collaborateurs
  const handleGenerateDecomptes = async () => {
    if (!dateDebut || !dateFin) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner une période",
        variant: "destructive"
      });
      return;
    }

    if (selectedCollaborateurs.length === 0) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner au moins un collaborateur",
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
      
      // Filter commissions by date range
      const commissionsInRange = commissions.filter(c => {
        const createdAt = new Date(c.created_at);
        return createdAt >= debut && createdAt <= fin;
      });
      
      const allCollabDecomptes: CollaborateurDecompte[] = [];
      
      // Process each selected collaborateur
      for (const collabId of selectedCollaborateurs) {
        const collaborateur = collaborateurs.find(c => c.id === collabId);
        if (!collaborateur) continue;
        
        const decomptes: DecompteCommission[] = [];
        
        // Loop through filtered commissions and fetch their parts
        for (const commission of commissionsInRange) {
          const parts = await fetchCommissionParts(commission.id);
          
          // Check if this collaborator has a part in this commission
          const agentPart = parts.find((p: CommissionPart) => p.agent_id === collabId);
          if (agentPart) {
            decomptes.push({ commission, parts });
          }
        }
        
        if (decomptes.length > 0) {
          const totals = calculateTotals(decomptes, collaborateur);
          allCollabDecomptes.push({ collaborateur, decomptes, totals });
        }
      }
      
      if (allCollabDecomptes.length === 0) {
        toast({
          title: "Aucune commission",
          description: "Aucune commission trouvée pour les collaborateurs sélectionnés sur cette période",
        });
        setGenerating(false);
        return;
      }
      
      setAllDecomptes(allCollabDecomptes);
      setPreviewOpen(true);
    } catch (error) {
      console.error("Error generating decomptes:", error);
      toast({
        title: "Erreur",
        description: "Erreur lors de la génération des décomptes",
        variant: "destructive"
      });
    } finally {
      setGenerating(false);
    }
  };

  // Print all decomptes
  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Décomptes de Commissions - Advisy</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Inter', sans-serif; color: #1a1a2e; }
            .page { 
              width: 210mm; 
              min-height: 297mm; 
              padding: 15mm; 
              page-break-after: always; 
              background: white;
            }
            .page:last-child { page-break-after: avoid; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #1800AD; }
            .logo { height: 50px; }
            .title { text-align: right; }
            .title h1 { font-size: 20px; color: #1800AD; margin-bottom: 4px; }
            .title p { color: #666; font-size: 12px; }
            .agent-info { background: linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%); padding: 15px; border-radius: 8px; margin-bottom: 20px; }
            .agent-info h2 { color: #1800AD; margin-bottom: 8px; font-size: 14px; }
            .agent-info p { color: #444; margin: 3px 0; font-size: 13px; }
            .summary { display: flex; gap: 15px; margin-bottom: 20px; }
            .summary-card { flex: 1; background: #f8f9ff; padding: 12px; border-radius: 8px; text-align: center; }
            .summary-card .value { font-size: 18px; font-weight: 700; color: #1800AD; }
            .summary-card .label { font-size: 10px; color: #666; margin-top: 3px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
            th { background: #1800AD; color: white; padding: 8px 6px; text-align: left; }
            td { padding: 6px; border-bottom: 1px solid #eee; }
            tr:nth-child(even) { background: #f9f9f9; }
            .amount { font-weight: 600; color: #059669; }
            .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 10px; }
            @media print {
              body { padding: 0; }
              .page { padding: 10mm; }
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

  // Download all decomptes as single PDF
  const handleDownloadPDF = async () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const collaborateurNames = allDecomptes.length === 1 
      ? `${allDecomptes[0].collaborateur.first_name || ''}_${allDecomptes[0].collaborateur.last_name || ''}`.trim().replace(/\s+/g, '_')
      : `${allDecomptes.length}_collaborateurs`;
    const fileName = `Decomptes_${collaborateurNames}_${dateDebut}_${dateFin}.pdf`;

    const opt = {
      margin: [10, 10, 10, 10] as [number, number, number, number],
      filename: fileName,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
      pagebreak: { mode: ['css', 'legacy'] as ('css' | 'legacy')[] }
    };

    try {
      await html2pdf().set(opt).from(printContent).save();
      toast({
        title: "PDF téléchargé",
        description: `${allDecomptes.length} décompte(s) téléchargé(s): ${fileName}`,
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors de la génération du PDF",
        variant: "destructive"
      });
    }
  };

  // Render single decompte page
  const renderDecomptePage = (collabDecompte: CollaborateurDecompte, isLast: boolean) => {
    const { collaborateur, decomptes, totals } = collabDecompte;
    
    return (
      <div 
        key={collaborateur.id} 
        className={cn(
          "bg-white p-6",
          !isLast && "page-break-after"
        )}
        style={{ 
          pageBreakAfter: isLast ? 'auto' : 'always',
          minHeight: '277mm',
          width: '100%'
        }}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-6 pb-4 border-b-2 border-primary">
          <img src={advisyLogo} alt="Advisy" className="h-12" />
          <div className="text-right">
            <h1 className="text-xl font-bold text-primary">Décompte de Commissions</h1>
            <p className="text-muted-foreground text-sm">
              Période: {dateDebut && format(new Date(dateDebut), 'dd/MM/yyyy')} - {dateFin && format(new Date(dateFin), 'dd/MM/yyyy')}
            </p>
            <p className="text-xs text-muted-foreground">
              Généré le: {format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })}
            </p>
          </div>
        </div>

        {/* Agent Info */}
        <div className="bg-gradient-to-r from-primary/5 to-primary/10 p-4 rounded-lg mb-5">
          <h2 className="text-sm font-semibold text-primary mb-1">Collaborateur</h2>
          <p className="font-medium">{getCollaborateurName(collaborateur)}</p>
          <p className="text-muted-foreground text-sm">{collaborateur.email}</p>
          {totals.reserveRate > 0 && (
            <p className="text-orange-600 text-xs mt-1">
              Compte de réserve: {totals.reserveRate}%
            </p>
          )}
        </div>

        {/* Summary Cards */}
        <div className={`grid gap-3 mb-5 ${totals.reserveRate > 0 ? 'grid-cols-4' : 'grid-cols-2'}`}>
          <div className="bg-muted/50 p-3 rounded-lg text-center">
            <p className="text-xl font-bold text-primary">{totals.commissionsCount}</p>
            <p className="text-xs text-muted-foreground">Commissions</p>
          </div>
          <div className="bg-blue-50 p-3 rounded-lg text-center">
            <p className="text-xl font-bold text-blue-600">{formatCurrency(totals.totalAgentAmount)}</p>
            <p className="text-xs text-muted-foreground">Total brut</p>
          </div>
          {totals.reserveRate > 0 && (
            <>
              <div className="bg-orange-50 p-3 rounded-lg text-center">
                <p className="text-xl font-bold text-orange-600">-{formatCurrency(totals.reserveAmount)}</p>
                <p className="text-xs text-muted-foreground">Réserve ({totals.reserveRate}%)</p>
              </div>
              <div className="bg-emerald-50 p-3 rounded-lg text-center">
                <p className="text-xl font-bold text-emerald-600">{formatCurrency(totals.netAmount)}</p>
                <p className="text-xs text-muted-foreground">Net à percevoir</p>
              </div>
            </>
          )}
          {totals.reserveRate === 0 && (
            <div className="bg-emerald-50 p-3 rounded-lg text-center">
              <p className="text-xl font-bold text-emerald-600">{formatCurrency(totals.totalAgentAmount)}</p>
              <p className="text-xs text-muted-foreground">Total à percevoir</p>
            </div>
          )}
        </div>

        {/* Commissions Table */}
        <Table>
          <TableHeader>
            <TableRow className="bg-primary">
              <TableHead className="text-white text-xs py-2">Date</TableHead>
              <TableHead className="text-white text-xs py-2">Client</TableHead>
              <TableHead className="text-white text-xs py-2">Produit</TableHead>
              <TableHead className="text-white text-xs py-2">N° Police</TableHead>
              <TableHead className="text-white text-xs py-2 text-right">Montant</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {decomptes.map(({ commission, parts }) => {
              const clientName = commission.policy?.client?.company_name || 
                `${commission.policy?.client?.first_name || ''} ${commission.policy?.client?.last_name || ''}`.trim();
              
              const agentPart = parts.find(p => p.agent_id === collaborateur.id);

              return (
                <TableRow key={commission.id}>
                  <TableCell className="text-xs py-2">
                    {format(new Date(commission.created_at), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell className="font-medium text-xs py-2">{clientName || '-'}</TableCell>
                  <TableCell className="text-xs py-2">{commission.policy?.product?.name || '-'}</TableCell>
                  <TableCell className="font-mono text-xs py-2">{commission.policy?.policy_number || '-'}</TableCell>
                  <TableCell className="text-right font-semibold text-emerald-600 text-xs py-2">
                    {agentPart ? formatCurrency(Number(agentPart.amount)) : '-'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t text-center text-xs text-muted-foreground">
          <p>Advisy Sàrl • Conseil en assurances</p>
          <p>Ce document est généré automatiquement et fait foi de décompte de commissions.</p>
        </div>
      </div>
    );
  };

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
                Générer des décomptes de commissions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Date range */}
              <div className="grid md:grid-cols-2 gap-4">
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
              </div>

              {/* Collaborateurs selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Sélectionner les collaborateurs</Label>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={selectAllCollaborateurs}
                    className="gap-2"
                  >
                    <CheckSquare className="h-4 w-4" />
                    {selectedCollaborateurs.length === collaborateurs.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                  </Button>
                </div>
                
                {loadingCollaborateurs ? (
                  <div className="p-4 text-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                    Chargement des collaborateurs...
                  </div>
                ) : collaborateurs.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground bg-muted/50 rounded-lg">
                    Aucun collaborateur trouvé
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 p-4 bg-muted/30 rounded-lg max-h-64 overflow-y-auto">
                    {collaborateurs.map((collab) => (
                      <label
                        key={collab.id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                          selectedCollaborateurs.includes(collab.id)
                            ? "bg-primary/10 border-primary"
                            : "bg-background border-border hover:border-primary/50"
                        )}
                      >
                        <Checkbox
                          checked={selectedCollaborateurs.includes(collab.id)}
                          onCheckedChange={() => toggleCollaborateur(collab.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {getCollaborateurName(collab)}
                          </p>
                          {collab.email && (
                            <p className="text-xs text-muted-foreground truncate">
                              {collab.email}
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                
                {selectedCollaborateurs.length > 0 && (
                  <Badge variant="secondary" className="text-sm">
                    {selectedCollaborateurs.length} collaborateur{selectedCollaborateurs.length > 1 ? 's' : ''} sélectionné{selectedCollaborateurs.length > 1 ? 's' : ''}
                  </Badge>
                )}
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
                onClick={handleGenerateDecomptes}
                disabled={generating || !dateDebut || !dateFin || selectedCollaborateurs.length === 0}
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
                    Générer {selectedCollaborateurs.length > 1 ? `${selectedCollaborateurs.length} décomptes` : 'et prévisualiser'}
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
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>
                Prévisualisation - {allDecomptes.length} décompte{allDecomptes.length > 1 ? 's' : ''}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadPDF} className="gap-2">
                  <FileDown className="h-4 w-4" />
                  Télécharger PDF
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
                  <Printer className="h-4 w-4" />
                  Imprimer
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Printable content - All decomptes */}
          <div ref={printRef} className="bg-white rounded-lg">
            {allDecomptes.map((collabDecompte, index) => 
              renderDecomptePage(collabDecompte, index === allDecomptes.length - 1)
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
