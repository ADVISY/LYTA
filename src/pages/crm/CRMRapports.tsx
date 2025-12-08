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

// Types de rapports disponibles
const reportTypes = [
  { id: "adresses", label: "Liste d'adresses", icon: Users },
  { id: "contrats", label: "Liste des contrats", icon: FileCheck },
  { id: "suivis", label: "Liste des suivis", icon: MessageSquare },
];

// Champs disponibles par type
const fieldsByType: Record<string, { id: string; label: string; type: string }[]> = {
  adresses: [
    { id: "type_adresse", label: "Type d'adresse", type: "select" },
    { id: "first_name", label: "Prénom", type: "text" },
    { id: "last_name", label: "Nom", type: "text" },
    { id: "email", label: "Email", type: "text" },
    { id: "phone", label: "Téléphone", type: "text" },
    { id: "mobile", label: "Mobile", type: "text" },
    { id: "address", label: "Adresse", type: "text" },
    { id: "zip_code", label: "Code postal", type: "text" },
    { id: "city", label: "Ville", type: "text" },
    { id: "canton", label: "Canton", type: "text" },
    { id: "country", label: "Pays", type: "text" },
    { id: "birthdate", label: "Date de naissance", type: "date" },
    { id: "nationality", label: "Nationalité", type: "text" },
    { id: "civil_status", label: "État civil", type: "select" },
    { id: "permit_type", label: "Permis", type: "select" },
    { id: "profession", label: "Profession", type: "text" },
    { id: "employer", label: "Employeur", type: "text" },
    { id: "status", label: "Statut", type: "select" },
    { id: "created_at", label: "Date de création", type: "date" },
  ],
  contrats: [
    { id: "policy_number", label: "Numéro de police", type: "text" },
    { id: "company_name", label: "Compagnie", type: "text" },
    { id: "product_type", label: "Type de produit", type: "select" },
    { id: "status", label: "Statut", type: "select" },
    { id: "start_date", label: "Date de début", type: "date" },
    { id: "end_date", label: "Date de fin", type: "date" },
    { id: "premium_monthly", label: "Prime mensuelle", type: "number" },
    { id: "premium_yearly", label: "Prime annuelle", type: "number" },
    { id: "deductible", label: "Franchise", type: "number" },
    { id: "created_at", label: "Date de création", type: "date" },
  ],
  suivis: [
    { id: "title", label: "Titre", type: "text" },
    { id: "type", label: "Type", type: "select" },
    { id: "status", label: "Statut", type: "select" },
    { id: "description", label: "Description", type: "text" },
    { id: "reminder_date", label: "Date de rappel", type: "date" },
    { id: "created_at", label: "Date de création", type: "date" },
    { id: "updated_at", label: "Dernière mise à jour", type: "date" },
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
};

// Conditions additionnelles
const additionalConditions = [
  { id: "has_contract", label: "Doit avoir un contrat" },
  { id: "no_contract", label: "Ne doit pas avoir de contrat" },
  { id: "has_suivi", label: "Doit avoir un suivi" },
  { id: "no_suivi", label: "Ne doit pas avoir de suivi" },
];

interface SavedReport {
  id: string;
  name: string;
  type: string;
  selectedFields: string[];
  filters: ReportFilter[];
  conditions: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface ReportFilter {
  id: string;
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

  // État du nouveau rapport
  const [reportName, setReportName] = useState("");
  const [reportType, setReportType] = useState("adresses");
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [filters, setFilters] = useState<ReportFilter[]>([]);
  const [conditions, setConditions] = useState<string[]>([]);

  // Charger les rapports sauvegardés depuis localStorage
  useEffect(() => {
    const saved = localStorage.getItem("crm_reports");
    if (saved) {
      setSavedReports(JSON.parse(saved));
    }
  }, []);

  // Sauvegarder dans localStorage
  const saveReportsToStorage = (reports: SavedReport[]) => {
    localStorage.setItem("crm_reports", JSON.stringify(reports));
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
      type: reportType,
      selectedFields,
      filters,
      conditions,
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
        ? { ...r, name: reportName, selectedFields, filters, conditions, updatedAt: new Date().toISOString() }
        : r
    );
    saveReportsToStorage(updated);
    setSelectedReport(null);
    resetForm();
    toast.success("Rapport mis à jour");
  };

  const handleDeleteReport = (id: string) => {
    const updated = savedReports.filter(r => r.id !== id);
    saveReportsToStorage(updated);
    toast.success("Rapport supprimé");
  };

  const resetForm = () => {
    setReportName("");
    setReportType("adresses");
    setSelectedFields([]);
    setFilters([]);
    setConditions([]);
  };

  const toggleField = (fieldId: string) => {
    setSelectedFields(prev => 
      prev.includes(fieldId) 
        ? prev.filter(f => f !== fieldId)
        : [...prev, fieldId]
    );
  };

  const addFilter = () => {
    const availableFields = fieldsByType[reportType];
    if (availableFields.length > 0) {
      setFilters([...filters, {
        id: crypto.randomUUID(),
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

  const executeReport = async (report: SavedReport) => {
    setIsExecuting(true);
    setShowResults(true);
    
    try {
      let query;
      
      if (report.type === "adresses") {
        query = supabase.from("clients").select("*");
      } else if (report.type === "contrats") {
        query = supabase.from("policies").select(`
          *,
          client:clients(first_name, last_name, email)
        `);
      } else if (report.type === "suivis") {
        query = supabase.from("suivis").select(`
          *,
          client:clients(first_name, last_name, email)
        `);
      }

      if (!query) {
        throw new Error("Type de rapport non supporté");
      }

      // Appliquer les filtres
      for (const filter of report.filters) {
        if (!filter.value && filter.operator !== "is_empty" && filter.operator !== "is_not_empty") continue;
        
        switch (filter.operator) {
          case "equals":
            query = query.eq(filter.field, filter.value);
            break;
          case "not_equals":
            query = query.neq(filter.field, filter.value);
            break;
          case "contains":
            query = query.ilike(filter.field, `%${filter.value}%`);
            break;
          case "starts_with":
            query = query.ilike(filter.field, `${filter.value}%`);
            break;
          case "ends_with":
            query = query.ilike(filter.field, `%${filter.value}`);
            break;
          case "greater_than":
            query = query.gt(filter.field, filter.value);
            break;
          case "less_than":
            query = query.lt(filter.field, filter.value);
            break;
          case "before":
            query = query.lt(filter.field, filter.value);
            break;
          case "after":
            query = query.gt(filter.field, filter.value);
            break;
          case "is_empty":
            query = query.is(filter.field, null);
            break;
          case "is_not_empty":
            query = query.not(filter.field, "is", null);
            break;
        }
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      setReportResults(data || []);
      toast.success(`${data?.length || 0} résultats trouvés`);
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

    const headers = Object.keys(reportResults[0]).join(",");
    const rows = reportResults.map(row => 
      Object.values(row).map(v => 
        typeof v === "object" ? JSON.stringify(v) : `"${v}"`
      ).join(",")
    );
    const csv = [headers, ...rows].join("\n");
    
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
    setReportType(report.type);
    setSelectedFields(report.selectedFields);
    setFilters(report.filters);
    setConditions(report.conditions);
    setIsNewReportOpen(true);
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
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedReport ? "Modifier le rapport" : "Nouveau rapport"}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              {/* Nom et type */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nom du rapport</Label>
                  <Input 
                    value={reportName} 
                    onChange={(e) => setReportName(e.target.value)}
                    placeholder="Ex: Clients actifs 2025"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type de rapport</Label>
                  <Select value={reportType} onValueChange={(v) => {
                    setReportType(v);
                    setSelectedFields([]);
                    setFilters([]);
                  }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {reportTypes.map(type => (
                        <SelectItem key={type.id} value={type.id}>
                          <div className="flex items-center gap-2">
                            <type.icon className="h-4 w-4" />
                            {type.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Sélection des champs */}
              <div className="space-y-2">
                <Label>Champs à afficher</Label>
                <div className="grid grid-cols-3 gap-2 p-4 border rounded-lg bg-muted/30 max-h-48 overflow-y-auto">
                  {fieldsByType[reportType]?.map(field => (
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

              {/* Conditions additionnelles */}
              {reportType === "adresses" && (
                <div className="space-y-2">
                  <Label>Conditions</Label>
                  <div className="flex flex-wrap gap-2">
                    {additionalConditions.map(cond => (
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
              )}

              {/* Filtres */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Filtres</Label>
                  <Button variant="outline" size="sm" onClick={addFilter}>
                    <Plus className="h-4 w-4 mr-1" />
                    Ajouter un filtre
                  </Button>
                </div>
                
                {filters.length > 0 ? (
                  <div className="space-y-2">
                    {filters.map(filter => {
                      const fieldDef = fieldsByType[reportType]?.find(f => f.id === filter.field);
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
                              {fieldsByType[reportType]?.map(f => (
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
                            <Input 
                              value={filter.value}
                              onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                              placeholder="Valeur..."
                              className="flex-1"
                            />
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
                  <p className="text-sm text-muted-foreground p-4 border rounded-lg bg-muted/30 text-center">
                    Aucun filtre défini. Le rapport affichera tous les enregistrements.
                  </p>
                )}
              </div>

              {/* Aperçu des champs sélectionnés */}
              {selectedFields.length > 0 && (
                <div className="space-y-2">
                  <Label>Champs sélectionnés ({selectedFields.length})</Label>
                  <div className="flex flex-wrap gap-1">
                    {selectedFields.map(fieldId => {
                      const field = fieldsByType[reportType]?.find(f => f.id === fieldId);
                      return (
                        <Badge key={fieldId} variant="secondary" className="gap-1">
                          {field?.label}
                          <X 
                            className="h-3 w-3 cursor-pointer" 
                            onClick={() => toggleField(fieldId)}
                          />
                        </Badge>
                      );
                    })}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Liste des rapports */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Liste des rapports</CardTitle>
          </CardHeader>
          <CardContent>
            {savedReports.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Créé par</TableHead>
                    <TableHead>Mise à jour</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {savedReports.map(report => {
                    const typeInfo = reportTypes.find(t => t.id === report.type);
                    return (
                      <TableRow key={report.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {typeInfo && <typeInfo.icon className="h-4 w-4 text-muted-foreground" />}
                            {report.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{typeInfo?.label}</Badge>
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
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => openEditReport(report)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleDeleteReport(report.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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

        {/* Types de rapports rapides */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Rapports rapides</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {reportTypes.map(type => (
              <Button 
                key={type.id}
                variant="outline" 
                className="w-full justify-start gap-3"
                onClick={() => {
                  setReportType(type.id);
                  setSelectedFields(fieldsByType[type.id]?.slice(0, 5).map(f => f.id) || []);
                  setIsNewReportOpen(true);
                }}
              >
                <type.icon className="h-4 w-4" />
                {type.label}
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>

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
                      {Object.keys(reportResults[0]).filter(k => k !== "client" && !k.includes("_id")).slice(0, 8).map(key => (
                        <TableHead key={key} className="whitespace-nowrap">
                          {fieldsByType.adresses?.find(f => f.id === key)?.label || 
                           fieldsByType.contrats?.find(f => f.id === key)?.label ||
                           fieldsByType.suivis?.find(f => f.id === key)?.label ||
                           key}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportResults.slice(0, 50).map((row, idx) => (
                      <TableRow key={idx}>
                        {Object.entries(row).filter(([k]) => k !== "client" && !k.includes("_id")).slice(0, 8).map(([key, value]) => (
                          <TableCell key={key} className="whitespace-nowrap">
                            {value === null ? "-" : 
                             typeof value === "object" ? JSON.stringify(value) :
                             String(value).length > 30 ? String(value).slice(0, 30) + "..." :
                             String(value)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {reportResults.length > 50 && (
                  <p className="text-sm text-muted-foreground text-center mt-4">
                    Affichage des 50 premiers résultats sur {reportResults.length}
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
