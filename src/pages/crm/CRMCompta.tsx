import React, { useState, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Calculator, FileText, Printer, Eye, Loader2, Users, Calendar, DollarSign, FileDown, CheckSquare, Building2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCommissions, Commission } from "@/hooks/useCommissions";
import { useCommissionParts, CommissionPart } from "@/hooks/useCommissionParts";
import { useCollaborateursCommission, Collaborateur } from "@/hooks/useCollaborateursCommission";
import { useDocuments } from "@/hooks/useDocuments";
import { format, startOfMonth, endOfMonth, getMonth, getYear } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/contexts/TenantContext";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
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

interface FichePaie {
  collaborateur: Collaborateur;
  mois: string;
  annee: number;
  salaireBrut: number;
  commissionsBrut: number;
  reserveRate: number;
  reserveAmount: number;
  commissionsNet: number;
  totalBrut: number;
  // Charges sociales
  avs: number;
  ac: number;
  lpp: number;
  aanp: number;
  totalChargesSociales: number;
  // Impôt à la source
  canton: string;
  tauxImpotSource: number;
  impotSource: number;
  // Totaux
  totalDeductions: number;
  netAPayer: number;
}

// Barèmes simplifiés impôt à la source par canton (taux moyen pour célibataire, revenu ~5000 CHF/mois)
// Ces taux sont indicatifs et varient selon la situation familiale et le revenu
const TAUX_IMPOT_SOURCE: Record<string, { celibataire: number; marie: number }> = {
  'GE': { celibataire: 0.14, marie: 0.08 },
  'VD': { celibataire: 0.13, marie: 0.07 },
  'VS': { celibataire: 0.10, marie: 0.05 },
  'FR': { celibataire: 0.11, marie: 0.06 },
  'NE': { celibataire: 0.12, marie: 0.06 },
  'JU': { celibataire: 0.13, marie: 0.07 },
  'BE': { celibataire: 0.12, marie: 0.06 },
  'ZH': { celibataire: 0.10, marie: 0.05 },
  'BS': { celibataire: 0.14, marie: 0.08 },
  'AG': { celibataire: 0.09, marie: 0.05 },
  'LU': { celibataire: 0.09, marie: 0.05 },
  'TI': { celibataire: 0.11, marie: 0.06 },
  'SG': { celibataire: 0.10, marie: 0.05 },
  'DEFAULT': { celibataire: 0.11, marie: 0.06 },
};

const getTauxImpotSource = (canton: string | null, civilStatus: string | null): number => {
  const cantonCode = canton?.toUpperCase() || 'DEFAULT';
  const taux = TAUX_IMPOT_SOURCE[cantonCode] || TAUX_IMPOT_SOURCE['DEFAULT'];
  const isMarie = civilStatus?.toLowerCase().includes('marié') || civilStatus?.toLowerCase().includes('marie');
  return isMarie ? taux.marie : taux.celibataire;
};

export default function CRMCompta() {
  const { t } = useTranslation();
  const { commissions, loading: loadingCommissions } = useCommissions();
  const { fetchCommissionParts } = useCommissionParts();
  const { collaborateurs, loading: loadingCollaborateurs } = useCollaborateursCommission();
  const { createDocument } = useDocuments();
  const { toast } = useToast();
  const { tenant } = useTenant();
  const { hasModule } = usePlanFeatures();
  
  // Check if payroll module is available
  const hasPayrollAccess = hasModule('payroll');
  
  // Tenant branding for PDFs
  const tenantName = tenant?.branding?.display_name || tenant?.name || "Cabinet";
  const tenantLogo = tenant?.branding?.logo_url;
  const tenantPrimaryColor = tenant?.branding?.primary_color || '#1800AD';
  const tenantSecondaryColor = tenant?.branding?.secondary_color || '#1a1a2e';
  
  const [activeTab, setActiveTab] = useState("decomptes");
  
  // Décomptes state
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [selectedCollaborateurs, setSelectedCollaborateurs] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [allDecomptes, setAllDecomptes] = useState<CollaborateurDecompte[]>([]);
  const printRef = useRef<HTMLDivElement>(null);

  // Fiches de paie state
  const [selectedMois, setSelectedMois] = useState<string>("");
  const [selectedAnnee, setSelectedAnnee] = useState<string>(new Date().getFullYear().toString());
  const [selectedCollabsSalaire, setSelectedCollabsSalaire] = useState<string[]>([]);
  const [generatingSalaire, setGeneratingSalaire] = useState(false);
  const [previewSalaireOpen, setPreviewSalaireOpen] = useState(false);
  const [fichesPaie, setFichesPaie] = useState<FichePaie[]>([]);
  const printSalaireRef = useRef<HTMLDivElement>(null);

  // Mois options - translated
  const moisOptions = [
    { value: "0", label: t('accounting.january') },
    { value: "1", label: t('accounting.february') },
    { value: "2", label: t('accounting.march') },
    { value: "3", label: t('accounting.april') },
    { value: "4", label: t('accounting.may') },
    { value: "5", label: t('accounting.june') },
    { value: "6", label: t('accounting.july') },
    { value: "7", label: t('accounting.august') },
    { value: "8", label: t('accounting.september') },
    { value: "9", label: t('accounting.october') },
    { value: "10", label: t('accounting.november') },
    { value: "11", label: t('accounting.december') },
  ];

  // Année options (last 3 years)
  const currentYear = new Date().getFullYear();
  const anneeOptions = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(y => ({
    value: y.toString(),
    label: y.toString()
  }));

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

  // Toggle collaborateur selection (décomptes)
  const toggleCollaborateur = (collabId: string) => {
    setSelectedCollaborateurs(prev => 
      prev.includes(collabId) 
        ? prev.filter(id => id !== collabId)
        : [...prev, collabId]
    );
  };

  // Select all collaborateurs (décomptes)
  const selectAllCollaborateurs = () => {
    if (selectedCollaborateurs.length === collaborateurs.length) {
      setSelectedCollaborateurs([]);
    } else {
      setSelectedCollaborateurs(collaborateurs.map(c => c.id));
    }
  };

  // Toggle collaborateur selection (salaires)
  const toggleCollabSalaire = (collabId: string) => {
    setSelectedCollabsSalaire(prev => 
      prev.includes(collabId) 
        ? prev.filter(id => id !== collabId)
        : [...prev, collabId]
    );
  };

  // Select all collaborateurs (salaires)
  const selectAllCollabsSalaire = () => {
    if (selectedCollabsSalaire.length === collaborateurs.length) {
      setSelectedCollabsSalaire([]);
    } else {
      setSelectedCollabsSalaire(collaborateurs.map(c => c.id));
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
        title: t('common.error'),
        description: t('accounting.errorPeriodRequired'),
        variant: "destructive"
      });
      return;
    }

    if (selectedCollaborateurs.length === 0) {
      toast({
        title: t('common.error'),
        description: t('accounting.errorCollaboratorRequired'),
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
      
      const commissionsInRange = commissions.filter(c => {
        const createdAt = new Date(c.created_at);
        return createdAt >= debut && createdAt <= fin;
      });
      
      const allCollabDecomptes: CollaborateurDecompte[] = [];
      
      for (const collabId of selectedCollaborateurs) {
        const collaborateur = collaborateurs.find(c => c.id === collabId);
        if (!collaborateur) continue;
        
        const decomptes: DecompteCommission[] = [];
        
        for (const commission of commissionsInRange) {
          const parts = await fetchCommissionParts(commission.id);
          
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
          title: t('common.info'),
          description: t('accounting.noCommissions'),
        });
        setGenerating(false);
        return;
      }
      
      setAllDecomptes(allCollabDecomptes);
      setPreviewOpen(true);
    } catch (error) {
      console.error("Error generating decomptes:", error);
      toast({
        title: t('common.error'),
        description: t('accounting.pdfError'),
        variant: "destructive"
      });
    } finally {
      setGenerating(false);
    }
  };

  // Generate fiches de paie
  const handleGenerateFichesPaie = async () => {
    if (!selectedMois || !selectedAnnee) {
      toast({
        title: t('common.error'),
        description: t('accounting.errorMonthYearRequired'),
        variant: "destructive"
      });
      return;
    }

    if (selectedCollabsSalaire.length === 0) {
      toast({
        title: t('common.error'),
        description: t('accounting.errorCollaboratorRequired'),
        variant: "destructive"
      });
      return;
    }

    setGeneratingSalaire(true);
    try {
      const moisIndex = parseInt(selectedMois);
      const annee = parseInt(selectedAnnee);
      const dateRef = new Date(annee, moisIndex, 1);
      const debut = startOfMonth(dateRef);
      const fin = endOfMonth(dateRef);
      
      const fiches: FichePaie[] = [];
      
      for (const collabId of selectedCollabsSalaire) {
        const collaborateur = collaborateurs.find(c => c.id === collabId);
        if (!collaborateur) continue;
        
        // Get commissions for this collaborator in this month
        const commissionsInMonth = commissions.filter(c => {
          const createdAt = new Date(c.created_at);
          return createdAt >= debut && createdAt <= fin;
        });
        
        let commissionsBrut = 0;
        
        for (const commission of commissionsInMonth) {
          const parts = await fetchCommissionParts(commission.id);
          const agentPart = parts.find((p: CommissionPart) => p.agent_id === collabId);
          
          if (agentPart) {
            commissionsBrut += Number(agentPart.amount) || 0;
          }
        }
        
        const salaireBrut = Number(collaborateur.fixed_salary) || 0;
        const reserveRate = Number(collaborateur.reserve_rate) || 0;
        const reserveAmount = (commissionsBrut * reserveRate) / 100;
        const commissionsNet = commissionsBrut - reserveAmount;
        const totalBrut = salaireBrut + commissionsNet;
        
        // Charges sociales
        const avs = totalBrut * 0.053;  // AVS/AI/APG
        const ac = totalBrut * 0.011;   // Assurance chômage
        const lpp = totalBrut * 0.07;   // LPP (2e pilier)
        const aanp = totalBrut * 0.016; // AANP
        const totalChargesSociales = avs + ac + lpp + aanp;
        
        // Impôt à la source
        const canton = collaborateur.canton || 'VD';
        const tauxImpotSource = getTauxImpotSource(canton, collaborateur.civil_status);
        const impotSource = totalBrut * tauxImpotSource;
        
        const totalDeductions = totalChargesSociales + impotSource;
        const netAPayer = totalBrut - totalDeductions;
        
        fiches.push({
          collaborateur,
          mois: moisOptions.find(m => m.value === selectedMois)?.label || '',
          annee,
          salaireBrut,
          commissionsBrut,
          reserveRate,
          reserveAmount,
          commissionsNet,
          totalBrut,
          avs,
          ac,
          lpp,
          aanp,
          totalChargesSociales,
          canton,
          tauxImpotSource,
          impotSource,
          totalDeductions,
          netAPayer
        });
      }
      
      if (fiches.length === 0) {
        toast({
          title: t('common.info'),
          description: t('accounting.noDataFound'),
        });
        setGeneratingSalaire(false);
        return;
      }
      
      setFichesPaie(fiches);
      setPreviewSalaireOpen(true);
    } catch (error) {
      console.error("Error generating fiches de paie:", error);
      toast({
        title: t('common.error'),
        description: t('accounting.pdfError'),
        variant: "destructive"
      });
    } finally {
      setGeneratingSalaire(false);
    }
  };

  // Print functions
  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(getPrintHTML(printContent.innerHTML));
    printWindow.document.close();
    printWindow.print();
  };

  const handlePrintSalaire = () => {
    const printContent = printSalaireRef.current;
    if (!printContent) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(getPrintHTML(printContent.innerHTML));
    printWindow.document.close();
    printWindow.print();
  };

  const getPrintHTML = (content: string) => `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Document - ${tenantName}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Inter', sans-serif; color: ${tenantSecondaryColor}; }
          .page { width: 210mm; min-height: 297mm; padding: 15mm; page-break-after: always; background: white; }
          .page:last-child { page-break-after: avoid; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid ${tenantPrimaryColor}; }
          .logo { height: 50px; }
          .title { text-align: right; }
          .title h1 { font-size: 20px; color: ${tenantPrimaryColor}; margin-bottom: 4px; }
          .title p { color: #666; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
          th { background: ${tenantPrimaryColor}; color: white; padding: 8px 6px; text-align: left; }
          td { padding: 6px; border-bottom: 1px solid #eee; }
          .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 10px; }
          @media print { body { padding: 0; } .page { padding: 10mm; } }
        </style>
      </head>
      <body>${content}</body>
    </html>
  `;

  // Download PDF functions
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
        title: t('accounting.pdfDownloaded'),
        description: t('accounting.statementsDownloaded', { count: allDecomptes.length }),
      });
    } catch (error) {
      toast({ title: t('common.error'), description: t('accounting.pdfError'), variant: "destructive" });
    }
  };

  const handleDownloadSalairePDF = async () => {
    const printContent = printSalaireRef.current;
    if (!printContent) return;

    const moisLabel = moisOptions.find(m => m.value === selectedMois)?.label || '';
    const collaborateurNames = fichesPaie.length === 1 
      ? `${fichesPaie[0].collaborateur.first_name || ''}_${fichesPaie[0].collaborateur.last_name || ''}`.trim().replace(/\s+/g, '_')
      : `${fichesPaie.length}_collaborateurs`;
    const fileName = `Fiches_Paie_${moisLabel}_${selectedAnnee}_${collaborateurNames}.pdf`;

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
        title: t('accounting.pdfDownloaded'),
        description: t('accounting.payslipsDownloaded', { count: fichesPaie.length }),
      });
    } catch (error) {
      toast({ title: t('common.error'), description: t('accounting.pdfError'), variant: "destructive" });
    }
  };

  // Render single decompte page
  const renderDecomptePage = (collabDecompte: CollaborateurDecompte, isLast: boolean) => {
    const { collaborateur, decomptes, totals } = collabDecompte;
    
    return (
      <div 
        key={collaborateur.id} 
        className="bg-white p-6"
        style={{ pageBreakAfter: isLast ? 'auto' : 'always', minHeight: '277mm', width: '100%' }}
      >
        <div className="flex justify-between items-start mb-6 pb-4 border-b-2 border-primary">
          {tenantLogo ? (
            <img src={tenantLogo} alt={tenantName} className="h-12" />
          ) : (
            <div className="flex items-center gap-2">
              <Building2 className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold text-primary">{tenantName}</span>
            </div>
          )}
          <div className="text-right">
            <h1 className="text-xl font-bold text-primary">{t('accounting.statementTitle')}</h1>
            <p className="text-muted-foreground text-sm">
              {t('accounting.period')}: {dateDebut && format(new Date(dateDebut), 'dd/MM/yyyy')} - {dateFin && format(new Date(dateFin), 'dd/MM/yyyy')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('accounting.generatedOn')}: {format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })}
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-primary/5 to-primary/10 p-4 rounded-lg mb-5">
          <h2 className="text-sm font-semibold text-primary mb-1">{t('accounting.collaborator')}</h2>
          <p className="font-medium">{getCollaborateurName(collaborateur)}</p>
          <p className="text-muted-foreground text-sm">{collaborateur.email}</p>
          {totals.reserveRate > 0 && (
            <p className="text-orange-600 text-xs mt-1">{t('accounting.reserveAccount')}: {totals.reserveRate}%</p>
          )}
        </div>

        <div className={`grid gap-3 mb-5 ${totals.reserveRate > 0 ? 'grid-cols-4' : 'grid-cols-2'}`}>
          <div className="bg-muted/50 p-3 rounded-lg text-center">
            <p className="text-xl font-bold text-primary">{totals.commissionsCount}</p>
            <p className="text-xs text-muted-foreground">{t('commissions.title')}</p>
          </div>
          <div className="bg-blue-50 p-3 rounded-lg text-center">
            <p className="text-xl font-bold text-blue-600">{formatCurrency(totals.totalAgentAmount)}</p>
            <p className="text-xs text-muted-foreground">{t('accounting.totalBrut')}</p>
          </div>
          {totals.reserveRate > 0 && (
            <>
              <div className="bg-orange-50 p-3 rounded-lg text-center">
                <p className="text-xl font-bold text-orange-600">-{formatCurrency(totals.reserveAmount)}</p>
                <p className="text-xs text-muted-foreground">{t('accounting.reserve')} ({totals.reserveRate}%)</p>
              </div>
              <div className="bg-emerald-50 p-3 rounded-lg text-center">
                <p className="text-xl font-bold text-emerald-600">{formatCurrency(totals.netAmount)}</p>
                <p className="text-xs text-muted-foreground">{t('accounting.netToReceive')}</p>
              </div>
            </>
          )}
          {totals.reserveRate === 0 && (
            <div className="bg-emerald-50 p-3 rounded-lg text-center">
              <p className="text-xl font-bold text-emerald-600">{formatCurrency(totals.totalAgentAmount)}</p>
              <p className="text-xs text-muted-foreground">{t('accounting.totalToReceive')}</p>
            </div>
          )}
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-primary">
              <TableHead className="text-white text-xs py-2">{t('accounting.date')}</TableHead>
              <TableHead className="text-white text-xs py-2">{t('accounting.client')}</TableHead>
              <TableHead className="text-white text-xs py-2">{t('accounting.product')}</TableHead>
              <TableHead className="text-white text-xs py-2">{t('accounting.policyNumber')}</TableHead>
              <TableHead className="text-white text-xs py-2 text-right">{t('accounting.amount')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {decomptes.map(({ commission, parts }) => {
              const clientName = commission.policy?.client?.company_name || 
                `${commission.policy?.client?.first_name || ''} ${commission.policy?.client?.last_name || ''}`.trim();
              const agentPart = parts.find(p => p.agent_id === collaborateur.id);
              const isDecommission = commission.type === 'decommission' || Number(agentPart?.amount) < 0;
              return (
                <TableRow key={commission.id} className={cn(isDecommission && "bg-red-50")}>
                  <TableCell className="text-xs py-2">{format(new Date(commission.created_at), 'dd/MM/yyyy')}</TableCell>
                  <TableCell className="font-medium text-xs py-2">
                    {clientName || '-'}
                    {isDecommission && (
                      <Badge variant="destructive" className="ml-2 text-[10px] px-1 py-0">
                        {t('accounting.decommission')}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs py-2">{commission.policy?.product?.name || '-'}</TableCell>
                  <TableCell className="font-mono text-xs py-2">{commission.policy?.policy_number || '-'}</TableCell>
                  <TableCell className={cn(
                    "text-right font-semibold text-xs py-2",
                    isDecommission ? "text-red-600" : "text-emerald-600"
                  )}>
                    {agentPart ? formatCurrency(Number(agentPart.amount)) : '-'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <div className="mt-6 pt-4 border-t text-center text-xs text-muted-foreground">
          <p>{tenantName} • {t('accounting.insuranceAdvice')}</p>
          <p>{t('accounting.documentAutoGenerated')}</p>
        </div>
      </div>
    );
  };

  // Render single fiche de paie page
  const renderFichePaiePage = (fiche: FichePaie, isLast: boolean) => {
    return (
      <div 
        key={fiche.collaborateur.id} 
        className="bg-white p-6"
        style={{ pageBreakAfter: isLast ? 'auto' : 'always', minHeight: '277mm', width: '100%' }}
      >
        <div className="flex justify-between items-start mb-6 pb-4 border-b-2 border-primary">
          {tenantLogo ? (
            <img src={tenantLogo} alt={tenantName} className="h-12" />
          ) : (
            <div className="flex items-center gap-2">
              <Building2 className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold text-primary">{tenantName}</span>
            </div>
          )}
          <div className="text-right">
            <h1 className="text-xl font-bold text-primary">{t('accounting.payslipTitle')}</h1>
            <p className="text-muted-foreground text-sm">{fiche.mois} {fiche.annee}</p>
            <p className="text-xs text-muted-foreground">
              {t('accounting.generatedOn')}: {format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })}
            </p>
          </div>
        </div>

        {/* Informations employé */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="bg-gradient-to-r from-primary/5 to-primary/10 p-4 rounded-lg">
            <h2 className="text-sm font-semibold text-primary mb-2">{t('accounting.employer')}</h2>
            <p className="font-medium">{tenantName}</p>
            <p className="text-sm text-muted-foreground">{t('accounting.insuranceAdvice')}</p>
            <p className="text-sm text-muted-foreground">Suisse</p>
          </div>
          <div className="bg-gradient-to-r from-primary/5 to-primary/10 p-4 rounded-lg">
            <h2 className="text-sm font-semibold text-primary mb-2">{t('accounting.collaborator')}</h2>
            <p className="font-medium">{getCollaborateurName(fiche.collaborateur)}</p>
            <p className="text-sm text-muted-foreground">{fiche.collaborateur.profession || t('accounting.adviser')}</p>
            {fiche.collaborateur.address && (
              <p className="text-sm text-muted-foreground">
                {fiche.collaborateur.address}, {fiche.collaborateur.postal_code} {fiche.collaborateur.city}
              </p>
            )}
          </div>
        </div>

        {/* Détail des revenus */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-primary mb-3 pb-2 border-b">{t('accounting.revenueDetails')}</h3>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs py-2">{t('accounting.designation')}</TableHead>
                <TableHead className="text-xs py-2 text-right">{t('accounting.amount')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="text-xs py-2 font-medium">{t('accounting.fixedSalary')}</TableCell>
                <TableCell className="text-xs py-2 text-right">{formatCurrency(fiche.salaireBrut)}</TableCell>
              </TableRow>
              
              <TableRow>
                <TableCell className="text-xs py-2 font-medium">{t('accounting.commissionsGross')}</TableCell>
                <TableCell className="text-xs py-2 text-right">{formatCurrency(fiche.commissionsBrut)}</TableCell>
              </TableRow>
              
              {fiche.reserveRate > 0 && (
                <TableRow className="bg-orange-50">
                  <TableCell className="text-xs py-2">{t('accounting.reserveWithholding')} ({fiche.reserveRate}%)</TableCell>
                  <TableCell className="text-xs py-2 text-right text-orange-600">-{formatCurrency(fiche.reserveAmount)}</TableCell>
                </TableRow>
              )}
              
              <TableRow className="bg-blue-50">
                <TableCell className="text-xs py-2 font-semibold">{t('accounting.commissionsNet')}</TableCell>
                <TableCell className="text-xs py-2 text-right font-semibold text-blue-600">
                  {formatCurrency(fiche.commissionsNet)}
                </TableCell>
              </TableRow>
              
              <TableRow className="bg-primary/10">
                <TableCell className="text-sm py-3 font-bold">{t('accounting.totalGross').toUpperCase()}</TableCell>
                <TableCell className="text-sm py-3 text-right font-bold text-primary">
                  {formatCurrency(fiche.totalBrut)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* Déductions */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-primary mb-3 pb-2 border-b">{t('accounting.deductions')}</h3>
          <Table>
            <TableBody>
              {/* Charges sociales */}
              <TableRow className="bg-muted/30">
                <TableCell className="text-xs py-2 font-semibold" colSpan={2}>{t('accounting.socialContributions')}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-xs py-2 pl-4">{t('accounting.avs')} (5.3%)</TableCell>
                <TableCell className="text-xs py-2 text-right text-red-600">
                  -{formatCurrency(fiche.avs)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-xs py-2 pl-4">{t('accounting.ac')} (1.1%)</TableCell>
                <TableCell className="text-xs py-2 text-right text-red-600">
                  -{formatCurrency(fiche.ac)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-xs py-2 pl-4">{t('accounting.lpp')} (~7%)</TableCell>
                <TableCell className="text-xs py-2 text-right text-red-600">
                  -{formatCurrency(fiche.lpp)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-xs py-2 pl-4">{t('accounting.aanp')} (1.6%)</TableCell>
                <TableCell className="text-xs py-2 text-right text-red-600">
                  -{formatCurrency(fiche.aanp)}
                </TableCell>
              </TableRow>
              <TableRow className="bg-red-50/50">
                <TableCell className="text-xs py-2 font-medium">{t('accounting.subTotalContributions')} (~15%)</TableCell>
                <TableCell className="text-xs py-2 text-right font-medium text-red-600">
                  -{formatCurrency(fiche.totalChargesSociales)}
                </TableCell>
              </TableRow>
              
              {/* Impôt à la source */}
              <TableRow className="bg-muted/30">
                <TableCell className="text-xs py-2 font-semibold" colSpan={2}>{t('accounting.withholdingTax')}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-xs py-2 pl-4">
                  {t('accounting.canton')} {fiche.canton} ({(fiche.tauxImpotSource * 100).toFixed(1)}%)
                </TableCell>
                <TableCell className="text-xs py-2 text-right text-red-600">
                  -{formatCurrency(fiche.impotSource)}
                </TableCell>
              </TableRow>
              
              {/* Total déductions */}
              <TableRow className="bg-red-100">
                <TableCell className="text-xs py-2 font-bold">{t('accounting.totalDeductions').toUpperCase()}</TableCell>
                <TableCell className="text-xs py-2 text-right font-bold text-red-600">
                  -{formatCurrency(fiche.totalDeductions)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* Net à payer */}
        <div className="bg-emerald-50 p-4 rounded-lg mb-6">
          <div className="flex justify-between items-center">
            <span className="text-lg font-bold">{t('accounting.netToPay').toUpperCase()}</span>
            <span className="text-2xl font-bold text-emerald-600">{formatCurrency(fiche.netAPayer)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t text-center text-xs text-muted-foreground">
          <p>{tenantName} • {t('accounting.insuranceAdvice')}</p>
          <p>{t('accounting.payslipAutoGenerated')}</p>
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
              {t('accounting.title')}
            </h1>
            <p className="text-muted-foreground">{t('accounting.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={cn("grid w-full max-w-md", hasPayrollAccess ? "grid-cols-2" : "grid-cols-1")}>
          <TabsTrigger value="decomptes" className="gap-2">
            <FileText className="h-4 w-4" />
            {t('accounting.statements')}
          </TabsTrigger>
          {hasPayrollAccess && (
            <TabsTrigger value="salaires" className="gap-2">
              <DollarSign className="h-4 w-4" />
              {t('accounting.payslips')}
            </TabsTrigger>
          )}
        </TabsList>

        {/* Décomptes Tab */}
        <TabsContent value="decomptes" className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                {t('accounting.generateStatements')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('accounting.periodStart')}</Label>
                  <Input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t('accounting.periodEnd')}</Label>
                  <Input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>{t('accounting.selectCollaborators')}</Label>
                  <Button variant="outline" size="sm" onClick={selectAllCollaborateurs} className="gap-2">
                    <CheckSquare className="h-4 w-4" />
                    {selectedCollaborateurs.length === collaborateurs.length ? t('accounting.deselectAll') : t('accounting.selectAll')}
                  </Button>
                </div>
                
                {loadingCollaborateurs ? (
                  <div className="p-4 text-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                    {t('accounting.loading')}
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
                          <p className="font-medium text-sm truncate">{getCollaborateurName(collab)}</p>
                          {collab.email && <p className="text-xs text-muted-foreground truncate">{collab.email}</p>}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                
                {selectedCollaborateurs.length > 0 && (
                  <Badge variant="secondary">{t('accounting.collaboratorsSelected', { count: selectedCollaborateurs.length })}</Badge>
                )}
              </div>

              {dateDebut && dateFin && (
                <div className="p-4 bg-muted/50 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Badge variant="secondary" className="text-lg px-4 py-2">
                      {filteredCommissions.length} commission(s)
                    </Badge>
                    <span className="text-muted-foreground">
                      du {format(new Date(dateDebut), 'dd MMM yyyy', { locale: fr })} au {format(new Date(dateFin), 'dd MMM yyyy', { locale: fr })}
                    </span>
                  </div>
                  <span className="text-lg font-bold text-emerald-600">
                    {formatCurrency(filteredCommissions.reduce((sum, c) => sum + Number(c.amount || 0), 0))}
                  </span>
                </div>
              )}

              <Button 
                onClick={handleGenerateDecomptes}
                disabled={generating || !dateDebut || !dateFin || selectedCollaborateurs.length === 0}
                className="gap-2"
              >
                {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> {t('accounting.generating')}</> : <><Eye className="h-4 w-4" /> {selectedCollaborateurs.length > 1 ? t('accounting.generateStatementCount', { count: selectedCollaborateurs.length }) : t('accounting.generateAndPreview')}</>}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fiches de salaire Tab - Only if payroll module enabled */}
        {hasPayrollAccess && (
        <TabsContent value="salaires" className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                {t('accounting.generatePayslips')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('accounting.month')}</Label>
                  <Select value={selectedMois} onValueChange={setSelectedMois}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('accounting.selectAMonth')} />
                    </SelectTrigger>
                    <SelectContent>
                      {moisOptions.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('accounting.year')}</Label>
                  <Select value={selectedAnnee} onValueChange={setSelectedAnnee}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('accounting.selectAYear')} />
                    </SelectTrigger>
                    <SelectContent>
                      {anneeOptions.map(a => (
                        <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>{t('accounting.selectCollaborators')}</Label>
                  <Button variant="outline" size="sm" onClick={selectAllCollabsSalaire} className="gap-2">
                    <CheckSquare className="h-4 w-4" />
                    {selectedCollabsSalaire.length === collaborateurs.length ? t('accounting.deselectAll') : t('accounting.selectAll')}
                  </Button>
                </div>
                
                {loadingCollaborateurs ? (
                  <div className="p-4 text-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                    {t('accounting.loading')}
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 p-4 bg-muted/30 rounded-lg max-h-64 overflow-y-auto">
                    {collaborateurs.map((collab) => (
                      <label
                        key={collab.id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                          selectedCollabsSalaire.includes(collab.id)
                            ? "bg-primary/10 border-primary"
                            : "bg-background border-border hover:border-primary/50"
                        )}
                      >
                        <Checkbox
                          checked={selectedCollabsSalaire.includes(collab.id)}
                          onCheckedChange={() => toggleCollabSalaire(collab.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{getCollaborateurName(collab)}</p>
                          {collab.fixed_salary ? (
                            <p className="text-xs text-emerald-600 truncate">{t('accounting.fixedSalary')}: {formatCurrency(collab.fixed_salary)}</p>
                          ) : (
                            <p className="text-xs text-muted-foreground truncate">{t('accounting.noFixedSalary')}</p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                
                {selectedCollabsSalaire.length > 0 && (
                  <Badge variant="secondary">{t('accounting.collaboratorsSelected', { count: selectedCollabsSalaire.length })}</Badge>
                )}
              </div>

              <Button 
                onClick={handleGenerateFichesPaie}
                disabled={generatingSalaire || !selectedMois || !selectedAnnee || selectedCollabsSalaire.length === 0}
                className="gap-2"
              >
                {generatingSalaire ? <><Loader2 className="h-4 w-4 animate-spin" /> {t('accounting.generating')}</> : <><Eye className="h-4 w-4" /> {selectedCollabsSalaire.length > 1 ? t('accounting.generatePayslipsCount', { count: selectedCollabsSalaire.length }) : t('accounting.generateAndPreview')}</>}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        )}
      </Tabs>

      {/* Preview Decomptes Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{t('accounting.previewTitle', { count: allDecomptes.length })}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadPDF} className="gap-2">
                  <FileDown className="h-4 w-4" /> {t('accounting.downloadPdf')}
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
                  <Printer className="h-4 w-4" /> {t('accounting.print')}
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div ref={printRef} className="bg-white rounded-lg">
            {allDecomptes.map((collabDecompte, index) => 
              renderDecomptePage(collabDecompte, index === allDecomptes.length - 1)
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Fiches de Paie Dialog */}
      <Dialog open={previewSalaireOpen} onOpenChange={setPreviewSalaireOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{t('accounting.previewPayslipsTitle', { count: fichesPaie.length })}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadSalairePDF} className="gap-2">
                  <FileDown className="h-4 w-4" /> {t('accounting.downloadPdf')}
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrintSalaire} className="gap-2">
                  <Printer className="h-4 w-4" /> {t('accounting.print')}
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div ref={printSalaireRef} className="bg-white rounded-lg">
            {fichesPaie.map((fiche, index) => 
              renderFichePaiePage(fiche, index === fichesPaie.length - 1)
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
