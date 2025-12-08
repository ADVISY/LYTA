import { useState, useEffect } from "react";
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

// Sources de données disponibles
const dataSources = [
  { id: "adresses", label: "Adresses", icon: Users, required: true },
  { id: "contrats", label: "Contrats", icon: FileCheck, required: false },
  { id: "suivis", label: "Suivis", icon: MessageSquare, required: false },
];

// Champs disponibles par source
const fieldsBySource: Record<string, { id: string; label: string; type: string; dbField: string; isJoined?: boolean }[]> = {
  adresses: [
    { id: "adr_type_adresse", label: "Type d'adresse", type: "select", dbField: "type_adresse" },
    { id: "adr_first_name", label: "Prénom", type: "text", dbField: "first_name" },
    { id: "adr_last_name", label: "Nom", type: "text", dbField: "last_name" },
    { id: "adr_email", label: "Email", type: "text", dbField: "email" },
    { id: "adr_phone", label: "Téléphone", type: "text", dbField: "phone" },
    { id: "adr_mobile", label: "Mobile", type: "text", dbField: "mobile" },
    { id: "adr_address", label: "Adresse", type: "text", dbField: "address" },
    { id: "adr_zip_code", label: "Code postal", type: "text", dbField: "zip_code" },
    { id: "adr_city", label: "Ville", type: "text", dbField: "city" },
    { id: "adr_canton", label: "Canton", type: "text", dbField: "canton" },
    { id: "adr_country", label: "Pays", type: "text", dbField: "country" },
    { id: "adr_birthdate", label: "Date de naissance", type: "date", dbField: "birthdate" },
    { id: "adr_nationality", label: "Nationalité", type: "text", dbField: "nationality" },
    { id: "adr_civil_status", label: "État civil", type: "select", dbField: "civil_status" },
    { id: "adr_permit_type", label: "Permis", type: "select", dbField: "permit_type" },
    { id: "adr_profession", label: "Profession", type: "text", dbField: "profession" },
    { id: "adr_employer", label: "Employeur", type: "text", dbField: "employer" },
    { id: "adr_status", label: "Statut client", type: "select", dbField: "status" },
    { id: "adr_created_at", label: "Date création adresse", type: "date", dbField: "created_at" },
    { id: "adr_agent_id", label: "Agent (ID)", type: "agent", dbField: "assigned_agent_id" },
    { id: "adr_agent_name", label: "Nom Agent", type: "text", dbField: "agent_name", isJoined: true },
    { id: "adr_manager_id", label: "Manager (ID)", type: "agent", dbField: "manager_id" },
    { id: "adr_manager_name", label: "Nom Manager", type: "text", dbField: "manager_name", isJoined: true },
  ],
  contrats: [
    { id: "ctr_policy_number", label: "N° Police", type: "text", dbField: "policy_number" },
    { id: "ctr_company_name", label: "Compagnie", type: "text", dbField: "company_name" },
    { id: "ctr_product_type", label: "Type produit", type: "select", dbField: "product_type" },
    { id: "ctr_status", label: "Statut contrat", type: "select", dbField: "status" },
    { id: "ctr_start_date", label: "Date début", type: "date", dbField: "start_date" },
    { id: "ctr_end_date", label: "Date fin", type: "date", dbField: "end_date" },
    { id: "ctr_premium_monthly", label: "Prime mensuelle", type: "number", dbField: "premium_monthly" },
    { id: "ctr_premium_yearly", label: "Prime annuelle", type: "number", dbField: "premium_yearly" },
    { id: "ctr_deductible", label: "Franchise", type: "number", dbField: "deductible" },
    { id: "ctr_notes", label: "Notes contrat", type: "text", dbField: "notes" },
    { id: "ctr_created_at", label: "Date création contrat", type: "date", dbField: "created_at" },
  ],
  suivis: [
    { id: "suv_title", label: "Titre suivi", type: "text", dbField: "title" },
    { id: "suv_type", label: "Type suivi", type: "select", dbField: "type" },
    { id: "suv_status", label: "Statut suivi", type: "select", dbField: "status" },
    { id: "suv_description", label: "Description", type: "text", dbField: "description" },
    { id: "suv_reminder_date", label: "Date rappel", type: "date", dbField: "reminder_date" },
    { id: "suv_created_at", label: "Date création suivi", type: "date", dbField: "created_at" },
    { id: "suv_updated_at", label: "Mise à jour suivi", type: "date", dbField: "updated_at" },
    { id: "suv_agent_id", label: "Agent suivi (ID)", type: "agent", dbField: "assigned_agent_id" },
    { id: "suv_agent_name", label: "Agent suivi", type: "text", dbField: "agent_name", isJoined: true },
  ],
};

// Opérateurs par type de champ
const operatorsByFieldType: Record<string, { id: string; label: string }[]> = {
  text: [
    { id: "equals", label: "Égal à" },
    { id: "contains", label: "Contient" },
    { id: "starts_with", label: "Commence par" },
    { id: "ends_with", label: "Termine par" },
    { id: "not_equals", label: "Différent de" },
    { id: "is_empty", label: "Est vide" },
    { id: "is_not_empty", label: "N'est pas vide" },
  ],
  number: [
    { id: "equals", label: "Égal à" },
    { id: "greater_than", label: "Supérieur à" },
    { id: "less_than", label: "Inférieur à" },
    { id: "between", label: "Entre" },
  ],
  date: [
    { id: "equals", label: "Égal à" },
    { id: "before", label: "Avant" },
    { id: "after", label: "Après" },
    { id: "between", label: "Entre" },
  ],
  select: [
    { id: "equals", label: "Égal à" },
    { id: "not_equals", label: "Différent de" },
    { id: "in", label: "Parmi" },
  ],
  agent: [
    { id: "equals", label: "Est" },
    { id: "not_equals", label: "N'est pas" },
    { id: "is_empty", label: "Non assigné" },
    { id: "is_not_empty", label: "Est assigné" },
  ],
};

// Conditions de jointure
const joinConditions = [
  { id: "has_contract", label: "Doit avoir un contrat", source: "contrats" },
  { id: "no_contract", label: "Ne doit pas avoir de contrat", source: "contrats" },
  { id: "has_suivi", label: "Doit avoir un suivi", source: "suivis" },
  { id: "no_suivi", label: "Ne doit pas avoir de suivi", source: "suivis" },
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
  const { user } = useAuth();
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [isNewReportOpen, setIsNewReportOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<SavedReport | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [reportResults, setReportResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [activeTab, setActiveTab] = useState("adresses");
  const [collaborateurs, setCollaborateurs] = useState<any[]>([]);

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
      toast.error("Veuillez entrer un nom pour le rapport");
      return;
    }
    if (selectedFields.length === 0) {
      toast.error("Veuillez sélectionner au moins un champ");
      return;
    }

    const newReport: SavedReport = {
      id: crypto.randomUUID(),
      name: reportName,
      sources: selectedSources,
      selectedFields,
      filters,
      joinConditions: conditions,
      createdBy: user?.email || "Utilisateur",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveReportsToStorage([...savedReports, newReport]);
    resetForm();
    setIsNewReportOpen(false);
    toast.success("Rapport créé avec succès");
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
    toast.success("Rapport mis à jour");
  };

  const handleDeleteReport = (id: string) => {
    const updated = savedReports.filter(r => r.id !== id);
    saveReportsToStorage(updated);
    toast.success("Rapport supprimé");
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
      toast.success(`${results.length} résultats trouvés`);
    } catch (error: any) {
      console.error("Erreur lors de l'exécution du rapport:", error);
      toast.error("Erreur lors de l'exécution du rapport");
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
    
    toast.success("Export PDF généré");
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
    
    toast.success("Export Excel (CSV) généré");
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
            <h1 className="text-2xl font-bold">Rapports</h1>
            <p className="text-muted-foreground text-sm">Créez et gérez vos rapports personnalisés</p>
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
              Nouveau rapport
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedReport ? "Modifier le rapport" : "Nouveau rapport"}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              {/* Nom du rapport */}
              <div className="space-y-2">
                <Label>Nom du rapport</Label>
                <Input 
                  value={reportName} 
                  onChange={(e) => setReportName(e.target.value)}
                  placeholder="Ex: Clients avec contrats santé 2025"
                />
              </div>

              {/* Sélection des sources */}
              <div className="space-y-2">
                <Label>Sources de données</Label>
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
                      {source.required && <span className="text-xs opacity-70">(requis)</span>}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Conditions de jointure */}
              <div className="space-y-2">
                <Label>Conditions</Label>
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
                      <Label>Champs à afficher</Label>
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
                        <Label>Filtres</Label>
                        <Button variant="outline" size="sm" onClick={() => addFilter(sourceId)}>
                          <Plus className="h-4 w-4 mr-1" />
                          Ajouter un filtre
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
                                      placeholder="Valeur..."
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
                          Aucun filtre pour cette source
                        </p>
                      )}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>

              {/* Aperçu des champs sélectionnés */}
              {selectedFields.length > 0 && (
                <div className="space-y-2">
                  <Label>Champs sélectionnés ({selectedFields.length})</Label>
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
                  Annuler
                </Button>
                <Button onClick={selectedReport ? handleUpdateReport : handleCreateReport}>
                  <Save className="h-4 w-4 mr-2" />
                  {selectedReport ? "Mettre à jour" : "Enregistrer"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Liste des rapports */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Liste des rapports</CardTitle>
        </CardHeader>
        <CardContent>
          {savedReports.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Sources</TableHead>
                  <TableHead>Créé par</TableHead>
                  <TableHead>Mise à jour</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                          title="Exécuter"
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => openEditReport(report)}
                          title="Modifier"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDeleteReport(report.id)}
                          title="Supprimer"
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
              <p className="text-muted-foreground">Aucun rapport créé</p>
              <p className="text-sm text-muted-foreground mt-1">
                Cliquez sur "Nouveau rapport" pour créer votre premier rapport
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
