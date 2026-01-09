import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  BarChart3, Plus, Play, Pencil, Trash2, Download, FileSpreadsheet, 
  FileText, Users, FileCheck, MessageSquare, X, Filter, Save
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// Sources de données disponibles - will be translated in component
const getDataSources = (t: any) => [
  { id: "adresses", label: t('reports.addresses'), icon: Users, required: true },
  { id: "contrats", label: t('reports.contracts'), icon: FileCheck, required: false },
  { id: "suivis", label: t('reports.followups'), icon: MessageSquare, required: false },
];

// Champs disponibles par source - will be translated in component
const getFieldsBySource = (t: any): Record<string, { id: string; label: string; type: string; dbField: string; isJoined?: boolean }[]> => ({
  adresses: [
    { id: "adr_type_adresse", label: t('clientForm.addressType'), type: "select", dbField: "type_adresse" },
    { id: "adr_first_name", label: t('clients.firstName'), type: "text", dbField: "first_name" },
    { id: "adr_last_name", label: t('clients.lastName'), type: "text", dbField: "last_name" },
    { id: "adr_email", label: t('common.email'), type: "text", dbField: "email" },
    { id: "adr_phone", label: t('common.phone'), type: "text", dbField: "phone" },
    { id: "adr_mobile", label: t('clients.mobile'), type: "text", dbField: "mobile" },
    { id: "adr_address", label: t('common.address'), type: "text", dbField: "address" },
    { id: "adr_zip_code", label: t('clients.postalCode'), type: "text", dbField: "zip_code" },
    { id: "adr_city", label: t('clients.city'), type: "text", dbField: "city" },
    { id: "adr_canton", label: t('clients.canton'), type: "text", dbField: "canton" },
    { id: "adr_country", label: t('clients.country'), type: "text", dbField: "country" },
    { id: "adr_birthdate", label: t('clients.birthdate'), type: "date", dbField: "birthdate" },
    { id: "adr_nationality", label: t('clients.nationality'), type: "text", dbField: "nationality" },
    { id: "adr_civil_status", label: t('clients.civilStatus'), type: "select", dbField: "civil_status" },
    { id: "adr_permit_type", label: t('clientForm.permitType'), type: "select", dbField: "permit_type" },
    { id: "adr_profession", label: t('clients.profession'), type: "text", dbField: "profession" },
    { id: "adr_employer", label: t('clients.employer'), type: "text", dbField: "employer" },
    { id: "adr_status", label: t('clients.status'), type: "select", dbField: "status" },
    { id: "adr_created_at", label: t('settings.createdAt'), type: "date", dbField: "created_at" },
    { id: "adr_agent_id", label: t('clientForm.assignedAgentId'), type: "agent", dbField: "assigned_agent_id" },
    { id: "adr_agent_name", label: t('clientForm.agentName'), type: "text", dbField: "agent_name", isJoined: true },
    { id: "adr_manager_id", label: t('clientForm.managerId'), type: "agent", dbField: "manager_id" },
    { id: "adr_manager_name", label: t('clientForm.managerName'), type: "text", dbField: "manager_name", isJoined: true },
  ],
  contrats: [
    { id: "ctr_policy_number", label: t('contracts.policyNumber'), type: "text", dbField: "policy_number" },
    { id: "ctr_company_name", label: t('contracts.company'), type: "text", dbField: "company_name" },
    { id: "ctr_product_type", label: t('contracts.product'), type: "select", dbField: "product_type" },
    { id: "ctr_status", label: t('contracts.status'), type: "select", dbField: "status" },
    { id: "ctr_start_date", label: t('contracts.startDate'), type: "date", dbField: "start_date" },
    { id: "ctr_end_date", label: t('contracts.endDate'), type: "date", dbField: "end_date" },
    { id: "ctr_premium_monthly", label: t('contracts.monthlyPremium'), type: "number", dbField: "premium_monthly" },
    { id: "ctr_premium_yearly", label: t('contracts.yearlyPremium'), type: "number", dbField: "premium_yearly" },
    { id: "ctr_deductible", label: t('contracts.deductible'), type: "number", dbField: "deductible" },
    { id: "ctr_notes", label: t('common.notes'), type: "text", dbField: "notes" },
    { id: "ctr_created_at", label: t('settings.createdAt'), type: "date", dbField: "created_at" },
  ],
  suivis: [
    { id: "suv_title", label: t('followups.title_field'), type: "text", dbField: "title" },
    { id: "suv_type", label: t('followups.type'), type: "select", dbField: "type" },
    { id: "suv_status", label: t('followups.status'), type: "select", dbField: "status" },
    { id: "suv_description", label: t('common.description'), type: "text", dbField: "description" },
    { id: "suv_reminder_date", label: t('followups.reminderDate'), type: "date", dbField: "reminder_date" },
    { id: "suv_created_at", label: t('settings.createdAt'), type: "date", dbField: "created_at" },
    { id: "suv_updated_at", label: t('reports.lastModified'), type: "date", dbField: "updated_at" },
    { id: "suv_agent_id", label: t('clientForm.assignedAgentId'), type: "agent", dbField: "assigned_agent_id" },
    { id: "suv_agent_name", label: t('followups.assignedTo'), type: "text", dbField: "agent_name", isJoined: true },
  ],
});

// Opérateurs par type de champ - will be translated in component
const getOperatorsByFieldType = (t: any): Record<string, { id: string; label: string }[]> => ({
  text: [
    { id: "equals", label: t('reports.equals') },
    { id: "contains", label: t('reports.contains') },
    { id: "starts_with", label: t('reports.startsWith') },
    { id: "ends_with", label: t('reports.endsWith') },
    { id: "not_equals", label: t('reports.notEquals') },
    { id: "is_empty", label: t('reports.isEmpty') },
    { id: "is_not_empty", label: t('reports.isNotEmpty') },
  ],
  number: [
    { id: "equals", label: t('reports.equals') },
    { id: "greater_than", label: t('reports.greaterThan') },
    { id: "less_than", label: t('reports.lessThan') },
    { id: "between", label: t('reports.between') },
  ],
  date: [
    { id: "equals", label: t('reports.equals') },
    { id: "before", label: t('reports.before') },
    { id: "after", label: t('reports.after') },
    { id: "between", label: t('reports.between') },
  ],
  select: [
    { id: "equals", label: t('reports.equals') },
    { id: "not_equals", label: t('reports.notEquals') },
    { id: "in", label: t('reports.between') },
  ],
  agent: [
    { id: "equals", label: t('reports.equals') },
    { id: "not_equals", label: t('reports.notEquals') },
    { id: "is_empty", label: t('reports.isEmpty') },
    { id: "is_not_empty", label: t('reports.isNotEmpty') },
  ],
});

// Conditions de jointure - will be translated in component
const getJoinConditions = (t: any) => [
  { id: "has_contract", label: t('reports.hasContract'), source: "contrats" },
  { id: "no_contract", label: t('reports.noContract'), source: "contrats" },
  { id: "has_suivi", label: t('reports.hasSuivi'), source: "suivis" },
  { id: "no_suivi", label: t('reports.noSuivi'), source: "suivis" },
];

interface SavedReport {
  id: string;
  name: string;
  sources: string[];
  selectedFields: string[];
  filters: ReportFilter[];
  joinConditions: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface ReportFilter {
  id: string;
  source: string;
  field: string;
  operator: string;
  value: string;
  value2?: string;
}

export default function CRMRapports() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [isNewReportOpen, setIsNewReportOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<SavedReport | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [reportResults, setReportResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [activeTab, setActiveTab] = useState("adresses");
  const [collaborateurs, setCollaborateurs] = useState<any[]>([]);

  // Translated lookup tables
  const dataSources = getDataSources(t);
  const fieldsBySource = getFieldsBySource(t);
  const operatorsByFieldType = getOperatorsByFieldType(t);
  const joinConditions = getJoinConditions(t);

  // État du nouveau rapport
  const [reportName, setReportName] = useState("");
  const [selectedSources, setSelectedSources] = useState<string[]>(["adresses"]);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [filters, setFilters] = useState<ReportFilter[]>([]);
  const [conditions, setConditions] = useState<string[]>([]);

  // Charger les rapports sauvegardés et les collaborateurs
  useEffect(() => {
    const saved = localStorage.getItem("crm_reports_v2");
    if (saved) {
      setSavedReports(JSON.parse(saved));
    }

    // Charger les collaborateurs (agents et managers)
    const loadCollaborateurs = async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, first_name, last_name, email")
        .eq("type_adresse", "collaborateur");
      if (data) setCollaborateurs(data);
    };
    loadCollaborateurs();
  }, []);

  // Sauvegarder dans localStorage
  const saveReportsToStorage = (reports: SavedReport[]) => {
    localStorage.setItem("crm_reports_v2", JSON.stringify(reports));
    setSavedReports(reports);
  };

  const handleCreateReport = () => {
    if (!reportName.trim()) {
      toast.error(t('reports.reportNameRequired'));
      return;
    }
    if (selectedFields.length === 0) {
      toast.error(t('reports.selectFieldsRequired'));
      return;
    }

    const newReport: SavedReport = {
      id: crypto.randomUUID(),
      name: reportName,
      sources: selectedSources,
      selectedFields,
      filters,
      joinConditions: conditions,
      createdBy: user?.email || t('common.unknown'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveReportsToStorage([...savedReports, newReport]);
    resetForm();
    setIsNewReportOpen(false);
    toast.success(t('reports.reportCreated'));
  };

  const handleUpdateReport = () => {
    if (!selectedReport) return;

    const updated = savedReports.map(r => 
      r.id === selectedReport.id 
        ? { ...r, name: reportName, sources: selectedSources, selectedFields, filters, joinConditions: conditions, updatedAt: new Date().toISOString() }
        : r
    );
    saveReportsToStorage(updated);
    setSelectedReport(null);
    resetForm();
    setIsNewReportOpen(false);
    toast.success(t('reports.reportUpdated'));
  };

  const handleDeleteReport = (id: string) => {
    const updated = savedReports.filter(r => r.id !== id);
    saveReportsToStorage(updated);
    toast.success(t('reports.reportDeleted'));
  };

  const resetForm = () => {
    setReportName("");
    setSelectedSources(["adresses"]);
    setSelectedFields([]);
    setFilters([]);
    setConditions([]);
    setActiveTab("adresses");
  };

  const toggleSource = (sourceId: string) => {
    if (sourceId === "adresses") return; // Adresses is always required
    
    setSelectedSources(prev => {
      const newSources = prev.includes(sourceId)
        ? prev.filter(s => s !== sourceId)
        : [...prev, sourceId];
      
      // Remove fields and filters from removed sources
      if (!newSources.includes(sourceId)) {
        const prefix = sourceId === "contrats" ? "ctr_" : "suv_";
        setSelectedFields(f => f.filter(field => !field.startsWith(prefix)));
        setFilters(f => f.filter(filter => filter.source !== sourceId));
      }
      
      return newSources;
    });
  };

  const toggleField = (fieldId: string) => {
    setSelectedFields(prev => 
      prev.includes(fieldId) 
        ? prev.filter(f => f !== fieldId)
        : [...prev, fieldId]
    );
  };

  const addFilter = (source: string) => {
    const availableFields = fieldsBySource[source];
    if (availableFields && availableFields.length > 0) {
      setFilters([...filters, {
        id: crypto.randomUUID(),
        source,
        field: availableFields[0].id,
        operator: "equals",
        value: "",
      }]);
    }
  };

  const updateFilter = (id: string, updates: Partial<ReportFilter>) => {
    setFilters(filters.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeFilter = (id: string) => {
    setFilters(filters.filter(f => f.id !== id));
  };

  const toggleCondition = (conditionId: string) => {
    setConditions(prev =>
      prev.includes(conditionId)
        ? prev.filter(c => c !== conditionId)
        : [...prev, conditionId]
    );
  };

  const getFieldLabel = (fieldId: string): string => {
    for (const source of Object.keys(fieldsBySource)) {
      const field = fieldsBySource[source].find(f => f.id === fieldId);
      if (field) return field.label;
    }
    return fieldId;
  };

  const executeReport = async (report: SavedReport) => {
    setIsExecuting(true);
    setShowResults(true);
    
    try {
      // Fetch clients
      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select("*");
      
      if (clientsError) throw clientsError;

      // Build agent/manager lookup map from collaborateurs
      const agentMap = new Map<string, string>();
      for (const collab of collaborateurs) {
        agentMap.set(collab.id, `${collab.first_name || ""} ${collab.last_name || ""}`.trim() || collab.email);
      }

      // Fetch policies if needed
      let policiesData: any[] = [];
      if (report.sources.includes("contrats")) {
        const { data, error } = await supabase.from("policies").select("*");
        if (!error && data) policiesData = data;
      }

      // Fetch suivis if needed
      let suivisData: any[] = [];
      if (report.sources.includes("suivis")) {
        const { data, error } = await supabase.from("suivis").select("*");
        if (!error && data) suivisData = data;
      }

      // Apply address filters on clients
      let filteredClients = clientsData || [];
      const addressFilters = report.filters.filter(f => f.source === "adresses");
      
      for (const filter of addressFilters) {
        const fieldDef = fieldsBySource.adresses.find(f => f.id === filter.field);
        if (!fieldDef) continue;
        const dbField = fieldDef.dbField;
        
        if (!filter.value && filter.operator !== "is_empty" && filter.operator !== "is_not_empty") continue;
        
        filteredClients = filteredClients.filter(client => {
          const value = client[dbField];
          switch (filter.operator) {
            case "equals":
              return String(value || "") === filter.value;
            case "not_equals":
              return String(value || "") !== filter.value;
            case "contains":
              return String(value || "").toLowerCase().includes(filter.value.toLowerCase());
            case "starts_with":
              return String(value || "").toLowerCase().startsWith(filter.value.toLowerCase());
            case "ends_with":
              return String(value || "").toLowerCase().endsWith(filter.value.toLowerCase());
            case "is_empty":
              return !value;
            case "is_not_empty":
              return !!value;
            default:
              return true;
          }
        });
      }

      let results: any[] = [];

      // Process results
      for (const client of filteredClients) {
        const baseRow: any = {};
        
        // Add address fields with joined agent/manager names
        for (const field of fieldsBySource.adresses) {
          if (report.selectedFields.includes(field.id)) {
            if (field.id === "adr_agent_name") {
              baseRow[field.label] = client.assigned_agent_id ? agentMap.get(client.assigned_agent_id) || "-" : "-";
            } else if (field.id === "adr_manager_name") {
              baseRow[field.label] = client.manager_id ? agentMap.get(client.manager_id) || "-" : "-";
            } else {
              baseRow[field.label] = client[field.dbField] ?? "-";
            }
          }
        }

        // Get related policies and suivis
        const clientPolicies = policiesData.filter(p => p.client_id === client.id);
        const clientSuivis = suivisData.filter(s => s.client_id === client.id);

        // Apply join conditions
        if (report.joinConditions.includes("has_contract") && clientPolicies.length === 0) continue;
        if (report.joinConditions.includes("no_contract") && clientPolicies.length > 0) continue;
        if (report.joinConditions.includes("has_suivi") && clientSuivis.length === 0) continue;
        if (report.joinConditions.includes("no_suivi") && clientSuivis.length > 0) continue;

        // If we include contracts
        if (report.sources.includes("contrats")) {
          if (clientPolicies.length > 0) {
            for (const policy of clientPolicies) {
              const row = { ...baseRow };

              // Add contract fields
              for (const field of fieldsBySource.contrats) {
                if (report.selectedFields.includes(field.id)) {
                  row[field.label] = policy[field.dbField] ?? "-";
                }
              }

              // If we also include suivis
              if (report.sources.includes("suivis") && clientSuivis.length > 0) {
                for (const suivi of clientSuivis) {
                  const fullRow = { ...row };
                  for (const field of fieldsBySource.suivis) {
                    if (report.selectedFields.includes(field.id)) {
                      if (field.id === "suv_agent_name") {
                        fullRow[field.label] = suivi.assigned_agent_id ? agentMap.get(suivi.assigned_agent_id) || "-" : "-";
                      } else {
                        fullRow[field.label] = suivi[field.dbField] ?? "-";
                      }
                    }
                  }
                  results.push(fullRow);
                }
              } else {
                results.push(row);
              }
            }
          } else if (!report.joinConditions.includes("has_contract")) {
            for (const field of fieldsBySource.contrats) {
              if (report.selectedFields.includes(field.id)) {
                baseRow[field.label] = "-";
              }
            }
            results.push(baseRow);
          }
        } else if (report.sources.includes("suivis")) {
          if (clientSuivis.length > 0) {
            for (const suivi of clientSuivis) {
              const row = { ...baseRow };
              for (const field of fieldsBySource.suivis) {
                if (report.selectedFields.includes(field.id)) {
                  if (field.id === "suv_agent_name") {
                    row[field.label] = suivi.assigned_agent_id ? agentMap.get(suivi.assigned_agent_id) || "-" : "-";
                  } else {
                    row[field.label] = suivi[field.dbField] ?? "-";
                  }
                }
              }
              results.push(row);
            }
          } else if (!report.joinConditions.includes("has_suivi")) {
            results.push(baseRow);
          }
        } else {
          results.push(baseRow);
        }
      }
      
      setReportResults(results);
      toast.success(t('reports.resultsFound', { count: results.length }));
    } catch (error: any) {
      console.error("Error executing report:", error);
      toast.error(t('reports.errorExecuting'));
      setReportResults([]);
    } finally {
      setIsExecuting(false);
    }
  };

  const exportToPDF = async () => {
    const html2pdf = (await import("html2pdf.js")).default;
    const element = document.getElementById("report-results");
    if (!element) return;

    html2pdf()
      .set({
        margin: 10,
        filename: `rapport_${format(new Date(), "yyyy-MM-dd")}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
      })
      .from(element)
      .save();
    
    toast.success(t('reports.pdfGenerated'));
  };

  const exportToExcel = () => {
    if (reportResults.length === 0) return;

    const headers = Object.keys(reportResults[0]).join(";");
    const rows = reportResults.map(row => 
      Object.values(row).map(v => 
        typeof v === "object" ? JSON.stringify(v) : `"${v}"`
      ).join(";")
    );
    const csv = "\uFEFF" + [headers, ...rows].join("\n"); // BOM for Excel UTF-8
    
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `rapport_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    
    toast.success(t('reports.excelGenerated'));
  };

  const openEditReport = (report: SavedReport) => {
    setSelectedReport(report);
    setReportName(report.name);
    setSelectedSources(report.sources);
    setSelectedFields(report.selectedFields);
    setFilters(report.filters);
    setConditions(report.joinConditions);
    setIsNewReportOpen(true);
  };

  const getSourceIcon = (sources: string[]) => {
    if (sources.includes("contrats") && sources.includes("suivis")) {
      return <div className="flex -space-x-1">
        <Users className="h-4 w-4" />
        <FileCheck className="h-4 w-4" />
        <MessageSquare className="h-4 w-4" />
      </div>;
    }
    if (sources.includes("contrats")) {
      return <div className="flex -space-x-1">
        <Users className="h-4 w-4" />
        <FileCheck className="h-4 w-4" />
      </div>;
    }
    if (sources.includes("suivis")) {
      return <div className="flex -space-x-1">
        <Users className="h-4 w-4" />
        <MessageSquare className="h-4 w-4" />
      </div>;
    }
    return <Users className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg">
            <BarChart3 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t('reports.title')}</h1>
            <p className="text-muted-foreground text-sm">{t('reports.subtitle')}</p>
          </div>
        </div>
        
        <Dialog open={isNewReportOpen} onOpenChange={(open) => {
          setIsNewReportOpen(open);
          if (!open) {
            setSelectedReport(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              {t('reports.newReport')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedReport ? t('reports.editReport') : t('reports.newReport')}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              {/* Nom du rapport */}
              <div className="space-y-2">
                <Label>{t('reports.reportName')}</Label>
                <Input 
                  value={reportName} 
                  onChange={(e) => setReportName(e.target.value)}
                  placeholder={t('reports.reportNamePlaceholder')}
                />
              </div>

              {/* Sélection des sources */}
              <div className="space-y-2">
                <Label>{t('reports.dataSources')}</Label>
                <div className="flex gap-2">
                  {dataSources.map(source => (
                    <Badge 
                      key={source.id}
                      variant={selectedSources.includes(source.id) ? "default" : "outline"}
                      className={cn(
                        "cursor-pointer gap-2 py-2 px-3",
                        source.required && "cursor-default"
                      )}
                      onClick={() => !source.required && toggleSource(source.id)}
                    >
                      <source.icon className="h-4 w-4" />
                      {source.label}
                      {source.required && <span className="text-xs opacity-70">{t('reports.required')}</span>}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Conditions de jointure */}
              <div className="space-y-2">
                <Label>{t('reports.conditions')}</Label>
                <div className="flex flex-wrap gap-2">
                  {joinConditions.map(cond => (
                    <Badge 
                      key={cond.id}
                      variant={conditions.includes(cond.id) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleCondition(cond.id)}
                    >
                      {cond.label}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Onglets pour champs et filtres par source */}
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  {selectedSources.map(sourceId => {
                    const source = dataSources.find(s => s.id === sourceId);
                    return (
                      <TabsTrigger key={sourceId} value={sourceId} className="gap-2">
                        {source && <source.icon className="h-4 w-4" />}
                        {source?.label}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>

                {selectedSources.map(sourceId => (
                  <TabsContent key={sourceId} value={sourceId} className="space-y-4 mt-4">
                    {/* Champs disponibles */}
                    <div className="space-y-2">
                      <Label>{t('reports.fieldsToDisplay')}</Label>
                      <div className="grid grid-cols-3 gap-2 p-4 border rounded-lg bg-muted/30 max-h-40 overflow-y-auto">
                        {fieldsBySource[sourceId]?.map(field => (
                          <div key={field.id} className="flex items-center space-x-2">
                            <Checkbox 
                              id={field.id}
                              checked={selectedFields.includes(field.id)}
                              onCheckedChange={() => toggleField(field.id)}
                            />
                            <label 
                              htmlFor={field.id} 
                              className="text-sm cursor-pointer"
                            >
                              {field.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Filtres pour cette source */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>{t('reports.filters')}</Label>
                        <Button variant="outline" size="sm" onClick={() => addFilter(sourceId)}>
                          <Plus className="h-4 w-4 mr-1" />
                          {t('reports.addFilter')}
                        </Button>
                      </div>
                      
                      {filters.filter(f => f.source === sourceId).length > 0 ? (
                        <div className="space-y-2">
                          {filters.filter(f => f.source === sourceId).map(filter => {
                            const fieldDef = fieldsBySource[sourceId]?.find(f => f.id === filter.field);
                            const operators = operatorsByFieldType[fieldDef?.type || "text"] || [];
                            
                            return (
                              <div key={filter.id} className="flex items-center gap-2 p-2 border rounded-lg bg-background">
                                <Select 
                                  value={filter.field} 
                                  onValueChange={(v) => updateFilter(filter.id, { field: v })}
                                >
                                  <SelectTrigger className="w-40">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {fieldsBySource[sourceId]?.map(f => (
                                      <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                
                                <Select 
                                  value={filter.operator}
                                  onValueChange={(v) => updateFilter(filter.id, { operator: v })}
                                >
                                  <SelectTrigger className="w-36">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {operators.map(op => (
                                      <SelectItem key={op.id} value={op.id}>{op.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                
                                {!["is_empty", "is_not_empty"].includes(filter.operator) && (
                                  fieldDef?.type === "agent" ? (
                                    <Select 
                                      value={filter.value}
                                      onValueChange={(v) => updateFilter(filter.id, { value: v })}
                                    >
                                      <SelectTrigger className="flex-1">
                                        <SelectValue placeholder="Sélectionner un agent..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {collaborateurs.map(collab => (
                                          <SelectItem key={collab.id} value={collab.id}>
                                            {collab.first_name} {collab.last_name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <Input 
                                      value={filter.value}
                                      onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                                      placeholder={t('reports.value')}
                                      className="flex-1"
                                    />
                                  )
                                )}
                                
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => removeFilter(filter.id)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground p-3 border rounded-lg bg-muted/30 text-center">
                          {t('reports.noResults')}
                        </p>
                      )}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>

              {/* Aperçu des champs sélectionnés */}
              {selectedFields.length > 0 && (
                <div className="space-y-2">
                  <Label>{t('reports.selectFields')} ({selectedFields.length})</Label>
                  <div className="flex flex-wrap gap-1">
                    {selectedFields.map(fieldId => (
                      <Badge key={fieldId} variant="secondary" className="gap-1">
                        {getFieldLabel(fieldId)}
                        <X 
                          className="h-3 w-3 cursor-pointer" 
                          onClick={() => toggleField(fieldId)}
                        />
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setIsNewReportOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={selectedReport ? handleUpdateReport : handleCreateReport}>
                  <Save className="h-4 w-4 mr-2" />
                  {selectedReport ? t('common.save') : t('common.save')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Liste des rapports */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('reports.savedReports')}</CardTitle>
        </CardHeader>
        <CardContent>
          {savedReports.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common.name')}</TableHead>
                  <TableHead>{t('reports.dataSources')}</TableHead>
                  <TableHead>{t('reports.createdBy')}</TableHead>
                  <TableHead>{t('reports.lastModified')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {savedReports.map(report => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {getSourceIcon(report.sources)}
                        {report.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {report.sources.map(s => (
                          <Badge key={s} variant="outline" className="text-xs">
                            {dataSources.find(ds => ds.id === s)?.label}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {report.createdBy}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(report.updatedAt), "dd.MM.yyyy HH:mm", { locale: fr })}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => executeReport(report)}
                          disabled={isExecuting}
                          title={t('reports.execute')}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => openEditReport(report)}
                          title={t('common.edit')}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDeleteReport(report.id)}
                          title={t('common.delete')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">{t('reports.noReports')}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {t('reports.noReportsDesc')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Résultats */}
      {showResults && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                Résultats ({reportResults.length})
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportToPDF} disabled={reportResults.length === 0}>
                  <FileText className="h-4 w-4 mr-2" />
                  PDF
                </Button>
                <Button variant="outline" size="sm" onClick={exportToExcel} disabled={reportResults.length === 0}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Excel
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setShowResults(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isExecuting ? (
              <div className="text-center py-8">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-muted-foreground">Exécution du rapport...</p>
              </div>
            ) : reportResults.length > 0 ? (
              <div id="report-results" className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {Object.keys(reportResults[0]).map(key => (
                        <TableHead key={key} className="whitespace-nowrap">
                          {key}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportResults.slice(0, 100).map((row, idx) => (
                      <TableRow key={idx}>
                        {Object.values(row).map((value: any, cellIdx) => (
                          <TableCell key={cellIdx} className="whitespace-nowrap">
                            {value === null || value === undefined ? "-" : 
                             typeof value === "object" ? JSON.stringify(value) :
                             String(value).length > 40 ? String(value).slice(0, 40) + "..." :
                             String(value)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {reportResults.length > 100 && (
                  <p className="text-sm text-muted-foreground text-center mt-4">
                    Affichage des 100 premiers résultats sur {reportResults.length}
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Filter className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-muted-foreground">Aucun résultat trouvé</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
