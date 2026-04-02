import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  FileText,
  Users,
  FolderArchive,
  Loader2,
  RotateCcw,
  Eye,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

// CSV Templates definitions
const CSV_TEMPLATES = {
  clients: {
    name: "Clients",
    icon: Users,
    filename: "lyta_import_clients.csv",
    headers: [
      "first_name", "last_name", "email", "phone", "mobile", 
      "address", "city", "postal_code", "country", "birthdate",
      "nationality", "civil_status", "profession", "employer",
      "iban", "bank_name", "company_name", "is_company", "external_ref"
    ],
    required: ["first_name", "last_name"],
    sample: [
      ["Jean", "Dupont", "jean.dupont@email.com", "+41 79 123 45 67", "", "Rue de Lausanne 12", "Genève", "1201", "Suisse", "1985-03-15", "Suisse", "married", "Ingénieur", "ABB", "CH93 0076 2011 6238 5295 7", "UBS", "", "false", "CLI-001"],
      ["Marie", "Martin", "marie.martin@email.com", "", "+41 78 987 65 43", "Avenue du Léman 45", "Lausanne", "1000", "Suisse", "1990-07-22", "France", "single", "Avocate", "Étude ABC", "", "", "", "false", "CLI-002"],
    ]
  },
  policies: {
    name: "Polices",
    icon: FileText,
    filename: "lyta_import_policies.csv",
    headers: [
      "policy_number", "client_email", "company_name", "product_name", "category",
      "premium", "payment_frequency", "start_date", "end_date", "status",
      "commission_rate", "notes", "external_ref"
    ],
    required: ["policy_number", "client_email", "company_name", "product_name", "premium"],
    sample: [
      ["POL-2024-001", "jean.dupont@email.com", "SwissLife", "Vie Classique", "vie", "1200.00", "annual", "2024-01-01", "2034-01-01", "active", "5.0", "Police principale", "EXT-001"],
      ["POL-2024-002", "marie.martin@email.com", "Groupe Mutuel", "Complémentaire Santé", "maladie", "350.00", "monthly", "2024-03-01", "", "active", "8.0", "", "EXT-002"],
    ]
  },
  commissions: {
    name: "Commissions",
    icon: FileSpreadsheet,
    filename: "lyta_import_commissions.csv",
    headers: [
      "policy_number", "amount", "date", "type", "status", "notes"
    ],
    required: ["policy_number", "amount", "date"],
    sample: [
      ["POL-2024-001", "60.00", "2024-01-15", "acquisition", "paid", "Commission initiale"],
      ["POL-2024-002", "28.00", "2024-03-01", "renewal", "pending", ""],
    ]
  },
};

// Field mapping for Lyta schema
const LYTA_FIELD_LABELS: Record<string, string> = {
  // Clients
  first_name: "Prénom",
  last_name: "Nom",
  email: "Email",
  phone: "Téléphone fixe",
  mobile: "Mobile",
  address: "Adresse",
  city: "Ville",
  postal_code: "Code postal",
  country: "Pays",
  birthdate: "Date de naissance",
  nationality: "Nationalité",
  civil_status: "Statut civil",
  profession: "Profession",
  employer: "Employeur",
  iban: "IBAN",
  bank_name: "Banque",
  company_name: "Nom entreprise",
  is_company: "Est une entreprise",
  external_ref: "Référence externe",
  // Policies
  policy_number: "N° Police",
  client_email: "Email client",
  product_name: "Produit",
  category: "Catégorie",
  premium: "Prime",
  payment_frequency: "Fréquence paiement",
  start_date: "Date début",
  end_date: "Date fin",
  status: "Statut",
  commission_rate: "Taux commission (%)",
  notes: "Notes",
  // Commissions
  amount: "Montant",
  date: "Date",
  type: "Type",
};

type ImportStep = "upload" | "mapping" | "preview" | "importing" | "complete";
type ImportType = "clients" | "policies" | "commissions";

interface ParsedData {
  headers: string[];
  rows: string[][];
}

interface MappingConfig {
  [sourceColumn: string]: string; // sourceColumn -> lytaField
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: ValidationError[];
}

interface TenantDataImportProps {
  tenantId: string;
  tenantName: string;
  onComplete?: () => void;
}

export function TenantDataImport({ tenantId, tenantName, onComplete }: TenantDataImportProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<ImportStep>("upload");
  const [importType, setImportType] = useState<ImportType>("clients");
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [mapping, setMapping] = useState<MappingConfig>({});
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  // Download CSV template
  const downloadTemplate = (type: ImportType) => {
    const template = CSV_TEMPLATES[type];
    const csvContent = [
      template.headers.join(","),
      ...template.sample.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");
    
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = template.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Template téléchargé",
      description: `${template.filename} a été téléchargé.`,
    });
  };

  // Parse CSV file
  const parseCSV = (content: string): ParsedData => {
    const lines = content.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return { headers: [], rows: [] };
    
    const parseRow = (line: string): string[] => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };
    
    const headers = parseRow(lines[0]);
    const rows = lines.slice(1).map(parseRow);
    
    return { headers, rows };
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.name.endsWith(".csv")) {
      toast({
        title: "Format invalide",
        description: "Veuillez sélectionner un fichier CSV.",
        variant: "destructive",
      });
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parsed = parseCSV(content);
      
      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        toast({
          title: "Fichier vide",
          description: "Le fichier ne contient pas de données.",
          variant: "destructive",
        });
        return;
      }
      
      setParsedData(parsed);
      
      // Auto-map matching columns
      const template = CSV_TEMPLATES[importType];
      const autoMapping: MappingConfig = {};
      parsed.headers.forEach(header => {
        const normalized = header.toLowerCase().trim().replace(/\s+/g, "_");
        if (template.headers.includes(normalized)) {
          autoMapping[header] = normalized;
        } else {
          // Try fuzzy matching
          const match = template.headers.find(h => 
            h.includes(normalized) || normalized.includes(h) ||
            LYTA_FIELD_LABELS[h]?.toLowerCase().includes(normalized)
          );
          if (match) autoMapping[header] = match;
        }
      });
      setMapping(autoMapping);
      setStep("mapping");
    };
    reader.readAsText(file);
  };

  // Validate data before import
  const validateData = (): ValidationError[] => {
    if (!parsedData) return [];
    
    const errors: ValidationError[] = [];
    const template = CSV_TEMPLATES[importType];
    const reversedMapping: Record<string, string> = {};
    Object.entries(mapping).forEach(([source, target]) => {
      reversedMapping[target] = source;
    });
    
    // Check required fields are mapped
    template.required.forEach(field => {
      if (!reversedMapping[field]) {
        errors.push({
          row: 0,
          field,
          message: `Le champ obligatoire "${LYTA_FIELD_LABELS[field] || field}" n'est pas mappé.`,
        });
      }
    });
    
    if (errors.length > 0) return errors;
    
    // Validate each row
    parsedData.rows.forEach((row, rowIndex) => {
      template.required.forEach(field => {
        const sourceCol = reversedMapping[field];
        if (sourceCol) {
          const colIndex = parsedData.headers.indexOf(sourceCol);
          const value = row[colIndex]?.trim();
          if (!value) {
            errors.push({
              row: rowIndex + 2, // +2 for header and 1-indexed
              field,
              message: `Valeur manquante pour "${LYTA_FIELD_LABELS[field] || field}".`,
            });
          }
        }
      });
      
      // Email validation
      const emailCol = reversedMapping["email"] || reversedMapping["client_email"];
      if (emailCol) {
        const colIndex = parsedData.headers.indexOf(emailCol);
        const email = row[colIndex]?.trim();
        if (email && !email.includes("@")) {
          errors.push({
            row: rowIndex + 2,
            field: "email",
            message: `Email invalide: "${email}".`,
          });
        }
      }
      
      // Date validation
      ["birthdate", "start_date", "end_date", "date"].forEach(dateField => {
        const sourceCol = reversedMapping[dateField];
        if (sourceCol) {
          const colIndex = parsedData.headers.indexOf(sourceCol);
          const dateValue = row[colIndex]?.trim();
          if (dateValue && isNaN(Date.parse(dateValue))) {
            errors.push({
              row: rowIndex + 2,
              field: dateField,
              message: `Date invalide: "${dateValue}". Format attendu: YYYY-MM-DD.`,
            });
          }
        }
      });
      
      // Number validation
      ["premium", "amount", "commission_rate"].forEach(numField => {
        const sourceCol = reversedMapping[numField];
        if (sourceCol) {
          const colIndex = parsedData.headers.indexOf(sourceCol);
          const numValue = row[colIndex]?.trim();
          if (numValue && isNaN(parseFloat(numValue))) {
            errors.push({
              row: rowIndex + 2,
              field: numField,
              message: `Nombre invalide: "${numValue}".`,
            });
          }
        }
      });
    });
    
    return errors;
  };

  // Proceed to preview step
  const proceedToPreview = () => {
    const errors = validateData();
    setValidationErrors(errors);
    setStep("preview");
  };

  // Execute import
  const executeImport = async () => {
    if (!parsedData) return;
    
    setImporting(true);
    setStep("importing");
    setImportProgress(0);
    
    const template = CSV_TEMPLATES[importType];
    const reversedMapping: Record<string, string> = {};
    Object.entries(mapping).forEach(([source, target]) => {
      reversedMapping[target] = source;
    });
    
    let success = 0;
    let failed = 0;
    const errors: ValidationError[] = [];
    
    for (let i = 0; i < parsedData.rows.length; i++) {
      const row = parsedData.rows[i];
      
      try {
        // Build record from mapping
        const record: Record<string, any> = {
          tenant_id: tenantId,
        };
        
        template.headers.forEach(field => {
          const sourceCol = reversedMapping[field];
          if (sourceCol) {
            const colIndex = parsedData.headers.indexOf(sourceCol);
            const rawValue = row[colIndex]?.trim();
            
            // Type conversions
            if (["is_company"].includes(field)) {
              record[field] = rawValue?.toLowerCase() === "true" || rawValue === "1";
            } else if (["premium", "amount", "commission_rate"].includes(field)) {
              if (rawValue) {
                record[field] = parseFloat(rawValue);
              }
            } else if (["birthdate", "start_date", "end_date", "date"].includes(field)) {
              if (rawValue && !isNaN(Date.parse(rawValue))) {
                record[field] = rawValue;
              }
            } else if (rawValue !== undefined && rawValue !== "") {
              record[field] = rawValue;
            }
          }
        });
        
        // Import based on type
        if (importType === "clients") {
          record.type_adresse = "client";
          const { error } = await supabase
            .from("clients")
            .insert([record]);
          if (error) throw error;
        } else if (importType === "policies") {
          // Find client by email
          const clientEmail = record.client_email;
          delete record.client_email;
          
          if (clientEmail) {
            const { data: clientData } = await supabase
              .from("clients")
              .select("id")
              .eq("tenant_id", tenantId)
              .eq("email", clientEmail)
              .maybeSingle();
            
            if (clientData) {
              record.client_id = clientData.id;
            }
          }
          
          // Find company
          const companyName = record.company_name;
          if (companyName) {
            const { data: companyData } = await supabase
              .from("insurance_companies")
              .select("id")
              .ilike("name", companyName)
              .maybeSingle();
            
            if (companyData) {
              record.company_id = companyData.id;
            }
            delete record.company_name;
          }
          
          // Find or skip product
          delete record.product_name;
          
          const { error } = await supabase
            .from("policies")
            .insert([record]);
          if (error) throw error;
        } else if (importType === "commissions") {
          // Find policy by number
          const policyNumber = record.policy_number;
          delete record.policy_number;
          
          if (policyNumber) {
            const { data: policyData } = await supabase
              .from("policies")
              .select("id")
              .eq("tenant_id", tenantId)
              .eq("policy_number", policyNumber)
              .maybeSingle();
            
            if (policyData) {
              record.policy_id = policyData.id;
            }
          }
          
          if (record.policy_id) {
            const { error } = await supabase
              .from("commissions")
              .insert([record]);
            if (error) throw error;
          } else {
            throw new Error("Police non trouvée");
          }
        }
        
        success++;
      } catch (error: any) {
        failed++;
        errors.push({
          row: i + 2,
          field: "general",
          message: error.message || "Erreur d'import",
        });
      }
      
      setImportProgress(Math.round(((i + 1) / parsedData.rows.length) * 100));
    }
    
    setImportResult({ success, failed, errors });
    setImporting(false);
    setStep("complete");
  };

  // Reset import
  const resetImport = () => {
    setParsedData(null);
    setMapping({});
    setValidationErrors([]);
    setImportResult(null);
    setStep("upload");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const template = CSV_TEMPLATES[importType];
  const TemplateIcon = template.icon;

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 text-sm">
        {["upload", "mapping", "preview", "importing", "complete"].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
              step === s ? "bg-primary text-primary-foreground" :
              ["upload", "mapping", "preview", "importing", "complete"].indexOf(step) > i 
                ? "bg-emerald-500 text-white" 
                : "bg-muted text-muted-foreground"
            }`}>
              {["upload", "mapping", "preview", "importing", "complete"].indexOf(step) > i ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                i + 1
              )}
            </div>
            {i < 4 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {/* Step: Upload */}
      {step === "upload" && (
        <div className="space-y-6">
          {/* Templates download */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                1. Télécharger un template
              </CardTitle>
              <CardDescription>
                Téléchargez un modèle CSV pré-formaté pour Lyta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {Object.entries(CSV_TEMPLATES).map(([key, tmpl]) => {
                  const Icon = tmpl.icon;
                  return (
                    <Button
                      key={key}
                      variant="outline"
                      className="h-auto py-4 flex-col gap-2"
                      onClick={() => downloadTemplate(key as ImportType)}
                    >
                      <Icon className="h-8 w-8 text-primary" />
                      <span className="font-medium">{tmpl.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {tmpl.headers.length} colonnes
                      </span>
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                2. Uploader votre fichier CSV
              </CardTitle>
              <CardDescription>
                Sélectionnez le type de données puis uploadez votre fichier
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Type de données à importer</Label>
                <Select value={importType} onValueChange={(v: ImportType) => setImportType(v)}>
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CSV_TEMPLATES).map(([key, tmpl]) => (
                      <SelectItem key={key} value={key}>
                        {tmpl.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div 
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <TemplateIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="font-medium">Cliquez ou glissez votre fichier CSV ici</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Format CSV, encodage UTF-8 recommandé
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step: Mapping */}
      {step === "mapping" && parsedData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Mapper les colonnes
            </CardTitle>
            <CardDescription>
              Associez vos colonnes aux champs Lyta. Les champs obligatoires sont marqués d'un *.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground mb-4">
              {parsedData.rows.length} lignes détectées
            </div>
            
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {parsedData.headers.map((header) => (
                  <div key={header} className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{header}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        Ex: {parsedData.rows[0]?.[parsedData.headers.indexOf(header)] || "-"}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <Select
                      value={mapping[header] || "skip"}
                      onValueChange={(value) => {
                        if (value === "skip") {
                          const newMapping = { ...mapping };
                          delete newMapping[header];
                          setMapping(newMapping);
                        } else {
                          setMapping({ ...mapping, [header]: value });
                        }
                      }}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Ignorer" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="skip">-- Ignorer --</SelectItem>
                        {template.headers.map((field) => (
                          <SelectItem key={field} value={field}>
                            {LYTA_FIELD_LABELS[field] || field}
                            {template.required.includes(field) && " *"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={resetImport}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Recommencer
              </Button>
              <Button onClick={proceedToPreview}>
                Continuer
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Preview */}
      {step === "preview" && parsedData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Prévisualisation & Validation
            </CardTitle>
            <CardDescription>
              Vérifiez les données avant l'import dans {tenantName}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Validation errors */}
            {validationErrors.length > 0 && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="flex items-center gap-2 text-destructive font-medium mb-2">
                  <XCircle className="h-5 w-5" />
                  {validationErrors.length} erreur(s) détectée(s)
                </div>
                <ScrollArea className="h-32">
                  <ul className="text-sm space-y-1">
                    {validationErrors.slice(0, 20).map((err, i) => (
                      <li key={i} className="text-destructive">
                        Ligne {err.row}: {err.message}
                      </li>
                    ))}
                    {validationErrors.length > 20 && (
                      <li className="text-muted-foreground">
                        ... et {validationErrors.length - 20} autres erreurs
                      </li>
                    )}
                  </ul>
                </ScrollArea>
              </div>
            )}
            
            {/* Data preview */}
            <div className="border rounded-lg overflow-hidden">
              <ScrollArea className="h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      {Object.entries(mapping).map(([source, target]) => (
                        <TableHead key={source}>
                          <div>
                            <p className="font-medium">{LYTA_FIELD_LABELS[target] || target}</p>
                            <p className="text-xs text-muted-foreground font-normal">{source}</p>
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.rows.slice(0, 10).map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        {Object.keys(mapping).map((source) => {
                          const colIndex = parsedData.headers.indexOf(source);
                          return (
                            <TableCell key={source} className="max-w-32 truncate">
                              {row[colIndex] || "-"}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
            
            {parsedData.rows.length > 10 && (
              <p className="text-sm text-muted-foreground text-center">
                Affichage des 10 premières lignes sur {parsedData.rows.length}
              </p>
            )}
            
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep("mapping")}>
                Retour au mapping
              </Button>
              <Button 
                onClick={() => setConfirmDialogOpen(true)}
                disabled={validationErrors.some(e => e.row === 0)} // Block if required field missing
              >
                Lancer l'import
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Importing */}
      {step === "importing" && (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
            <h3 className="text-lg font-medium mb-2">Import en cours...</h3>
            <p className="text-muted-foreground mb-4">
              Veuillez patienter, ne fermez pas cette fenêtre.
            </p>
            <Progress value={importProgress} className="max-w-md mx-auto" />
            <p className="text-sm text-muted-foreground mt-2">
              {importProgress}%
            </p>
          </CardContent>
        </Card>
      )}

      {/* Step: Complete */}
      {step === "complete" && importResult && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center mb-6">
              {importResult.failed === 0 ? (
                <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-emerald-500" />
              ) : importResult.success > 0 ? (
                <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-amber-500" />
              ) : (
                <XCircle className="h-16 w-16 mx-auto mb-4 text-destructive" />
              )}
              <h3 className="text-xl font-bold mb-2">Import terminé</h3>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 max-w-md mx-auto mb-6">
              <div className="p-4 bg-emerald-500/10 rounded-lg text-center">
                <p className="text-2xl font-bold text-emerald-600">{importResult.success}</p>
                <p className="text-sm text-muted-foreground">Importés</p>
              </div>
              <div className="p-4 bg-destructive/10 rounded-lg text-center">
                <p className="text-2xl font-bold text-destructive">{importResult.failed}</p>
                <p className="text-sm text-muted-foreground">Échoués</p>
              </div>
            </div>
            
            {importResult.errors.length > 0 && (
              <div className="max-w-lg mx-auto mb-6">
                <p className="text-sm font-medium mb-2">Erreurs d'import:</p>
                <ScrollArea className="h-32 border rounded-lg p-3">
                  <ul className="text-sm space-y-1">
                    {importResult.errors.map((err, i) => (
                      <li key={i} className="text-destructive">
                        Ligne {err.row}: {err.message}
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            )}
            
            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={resetImport}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Nouvel import
              </Button>
              {onComplete && (
                <Button onClick={onComplete}>
                  Terminer
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmation dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer l'import</AlertDialogTitle>
            <AlertDialogDescription>
              Vous êtes sur le point d'importer {parsedData?.rows.length || 0} {template.name.toLowerCase()} 
              dans le tenant <strong>{tenantName}</strong>.
              {validationErrors.length > 0 && (
                <span className="block mt-2 text-amber-600">
                  ⚠️ {validationErrors.length} avertissement(s) détectés. 
                  Les lignes avec erreurs seront ignorées.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={executeImport}>
              Confirmer l'import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
