import { useState, useCallback, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useUserTenant } from "@/hooks/useUserTenant";
import { supabase } from "@/integrations/supabase/client";
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
};

type Step = "upload" | "mapping" | "preview" | "result";

type DuplicateStrategy = "skip" | "update" | "duplicate";

type FieldKey =
  | "first_name"
  | "last_name"
  | "email"
  | "phone"
  | "mobile"
  | "address"
  | "postal_code"
  | "city"
  | "country"
  | "birthdate"
  | "profession"
  | "civil_status"
  | "nationality"
  | "company_name"
  | "notes";

const FIELD_LABELS: Record<FieldKey, string> = {
  first_name: "Prénom",
  last_name: "Nom",
  email: "Email",
  phone: "Téléphone fixe",
  mobile: "Mobile",
  address: "Adresse",
  postal_code: "Code postal",
  city: "Ville",
  country: "Pays",
  birthdate: "Date de naissance",
  profession: "Profession",
  civil_status: "État civil",
  nationality: "Nationalité",
  company_name: "Société",
  notes: "Notes",
};

const REQUIRED_FIELDS: FieldKey[] = ["first_name", "last_name"];

const HEADER_ALIASES: Record<FieldKey, string[]> = {
  first_name: ["prenom", "prénom", "firstname", "first_name", "first name"],
  last_name: ["nom", "lastname", "last_name", "last name", "surname", "famille"],
  email: ["email", "e-mail", "mail", "courriel", "adresse email"],
  phone: ["telephone", "téléphone", "phone", "tel", "fixe", "telephone fixe"],
  mobile: ["mobile", "portable", "gsm", "cellulaire", "natel"],
  address: ["adresse", "address", "rue", "street"],
  postal_code: ["code postal", "cp", "postal", "postal code", "zip", "zipcode", "npa"],
  city: ["ville", "city", "localite", "localité"],
  country: ["pays", "country"],
  birthdate: ["date de naissance", "naissance", "birthdate", "dob", "date naissance", "birth"],
  profession: ["profession", "job", "metier", "métier", "occupation"],
  civil_status: ["etat civil", "état civil", "civil status", "marital", "marital status"],
  nationality: ["nationalite", "nationalité", "nationality"],
  company_name: ["societe", "société", "entreprise", "company", "company name", "raison sociale"],
  notes: ["notes", "note", "commentaire", "comment", "remarques", "source"],
};

function normalizeHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ");
}

function autoDetectMapping(headers: string[]): Record<string, FieldKey | "ignore"> {
  const result: Record<string, FieldKey | "ignore"> = {};
  for (const header of headers) {
    const normalized = normalizeHeader(header);
    let matched: FieldKey | null = null;
    for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [FieldKey, string[]][]) {
      if (aliases.includes(normalized)) {
        matched = field;
        break;
      }
    }
    result[header] = matched ?? "ignore";
  }
  return result;
}

function isValidYMD(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() + 1 === month &&
    d.getUTCDate() === day
  );
}

function buildYMD(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDate(value: string): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const serial = parseFloat(trimmed);
    if (serial > 25569 && serial < 73415) {
      const ms = (serial - 25569) * 86400 * 1000;
      const d = new Date(ms);
      if (!isNaN(d.getTime())) {
        return buildYMD(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      }
    }
  }

  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(trimmed);
  if (iso) {
    const [, y, a, b] = iso;
    const year = parseInt(y, 10);
    const aN = parseInt(a, 10);
    const bN = parseInt(b, 10);
    if (isValidYMD(year, aN, bN)) return buildYMD(year, aN, bN);
    if (isValidYMD(year, bN, aN)) return buildYMD(year, bN, aN);
    return null;
  }

  const dmy = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(trimmed);
  if (dmy) {
    const [, a, b, y] = dmy;
    const aN = parseInt(a, 10);
    const bN = parseInt(b, 10);
    let year = parseInt(y, 10);
    if (y.length === 2) year = year > 30 ? 1900 + year : 2000 + year;
    if (isValidYMD(year, bN, aN)) return buildYMD(year, bN, aN);
    if (isValidYMD(year, aN, bN)) return buildYMD(year, aN, bN);
    return null;
  }

  const d = new Date(trimmed);
  if (!isNaN(d.getTime()) && d.getUTCFullYear() >= 1900 && d.getUTCFullYear() <= 2100) {
    return buildYMD(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }

  return null;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Lowercased + trimmed email for case-insensitive duplicate detection. */
function normalizeEmail(value: string | null | undefined): string {
  if (!value) return "";
  return String(value).toLowerCase().trim();
}

/** Strip all non-digit characters except a leading + so different formats
 *  like "+41 79 123 45 67", "0041791234567", "079 123 45 67" can match. */
function normalizePhone(value: string | null | undefined): string {
  if (!value) return "";
  let p = String(value).trim();
  // Remove anything that is not digit or leading +
  p = p.replace(/[^\d+]/g, "");
  // Convert leading 00 to +
  if (p.startsWith("00")) p = "+" + p.slice(2);
  // Remove leading + only at this point so internal + (very unlikely) stays consistent
  // Actually keep the +, just remove spaces and separators (already done above).
  // For Swiss numbers: "079..." (8 digits) and "+4179..." (11 digits with +) should match.
  // We strip the country code if present:
  if (p.startsWith("+41")) p = "0" + p.slice(3);
  if (p.startsWith("+33")) p = "0" + p.slice(3);
  // Keep only the last 9-10 digits as a stable key (handles country code variants)
  const digits = p.replace(/\D/g, "");
  if (digits.length >= 9) {
    return digits.slice(-9);
  }
  return digits;
}

async function readFile(file: File): Promise<{ headers: string[]; rows: string[][] }> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  const buffer = await file.arrayBuffer();

  if (ext === "csv") {
    const text = new TextDecoder("utf-8").decode(buffer);
    return parseCSV(text);
  }

  if (ext === "xlsx" || ext === "xls") {
    const wb = XLSX.read(buffer, { type: "array", cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "" });
    if (json.length === 0) return { headers: [], rows: [] };
    const [headers, ...rows] = json;
    const stringify = (c: unknown): string => {
      if (c == null) return "";
      if (c instanceof Date) {
        return buildYMD(c.getUTCFullYear(), c.getUTCMonth() + 1, c.getUTCDate());
      }
      return String(c).trim();
    };
    return {
      headers: (headers as unknown[]).map((h) => String(h ?? "").trim()),
      rows: rows.map((r) => (r as unknown[]).map(stringify)),
    };
  }

  throw new Error("Format non supporté. Utilisez CSV ou XLSX.");
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines: string[][] = [];
  let current: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === "," || ch === ";") {
        current.push(cell);
        cell = "";
      } else if (ch === "\n") {
        current.push(cell);
        lines.push(current);
        current = [];
        cell = "";
      } else if (ch === "\r") {
        // skip
      } else {
        cell += ch;
      }
    }
  }
  if (cell.length > 0 || current.length > 0) {
    current.push(cell);
    lines.push(current);
  }

  const filtered = lines.filter((l) => l.some((c) => c.trim().length > 0));
  if (filtered.length === 0) return { headers: [], rows: [] };
  const [headers, ...rows] = filtered;
  return {
    headers: headers.map((h) => h.trim()),
    rows: rows.map((r) => r.map((c) => c.trim())),
  };
}

function downloadTemplate() {
  const headers = [
    "Prénom",
    "Nom",
    "Email",
    "Téléphone",
    "Mobile",
    "Adresse",
    "Code postal",
    "Ville",
    "Pays",
    "Date de naissance",
    "Profession",
    "Notes",
  ];
  const sample = [
    "Jean",
    "Dupont",
    "jean.dupont@exemple.ch",
    "+41 22 123 45 67",
    "+41 79 123 45 67",
    "Rue du Lac 12",
    "1200",
    "Genève",
    "Suisse",
    "1985-04-15",
    "Ingénieur",
    "Recommandation - événement Q1",
  ];
  const csv = [headers, sample]
    .map((row) => row.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modele-import-prospects.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const MAX_ROWS = 1000;

export function ProspectImportDialog({ open, onOpenChange, onImported }: Props) {
  const { tenantId } = useUserTenant();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState<string>("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, FieldKey | "ignore">>({});
  const [globalStrategy, setGlobalStrategy] = useState<DuplicateStrategy>("skip");
  const [duplicates, setDuplicates] = useState<Map<number, { existingId: string; matchOn: "email" | "phone" }>>(new Map());
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number; failed: { row: number; reason: string }[] }>({
    created: 0,
    updated: 0,
    skipped: 0,
    failed: [],
  });

  const reset = useCallback(() => {
    setStep("upload");
    setFileName("");
    setHeaders([]);
    setRows([]);
    setMapping({});
    setGlobalStrategy("skip");
    setDuplicates(new Map());
    setImporting(false);
    setProgress(0);
    setResult({ created: 0, updated: 0, skipped: 0, failed: [] });
  }, []);

  const handleClose = useCallback(() => {
    if (importing) return;
    onOpenChange(false);
    setTimeout(reset, 200);
  }, [importing, onOpenChange, reset]);

  const handleFile = useCallback(
    async (file: File) => {
      try {
        const { headers, rows } = await readFile(file);
        if (headers.length === 0) {
          toast({ title: "Fichier vide", description: "Aucune donnée détectée.", variant: "destructive" });
          return;
        }
        if (rows.length === 0) {
          toast({ title: "Aucune ligne", description: "Le fichier ne contient que des en-têtes.", variant: "destructive" });
          return;
        }
        if (rows.length > MAX_ROWS) {
          toast({
            title: "Trop de lignes",
            description: `Maximum ${MAX_ROWS} lignes par import. Votre fichier en contient ${rows.length}.`,
            variant: "destructive",
          });
          return;
        }
        setFileName(file.name);
        setHeaders(headers);
        setRows(rows);
        setMapping(autoDetectMapping(headers));
        setStep("mapping");
      } catch (e: any) {
        toast({ title: "Erreur lecture", description: e.message, variant: "destructive" });
      }
    },
    [toast]
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [handleFile]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const mappingErrors = useMemo(() => {
    const mapped = Object.values(mapping).filter((v) => v !== "ignore") as FieldKey[];
    const missing = REQUIRED_FIELDS.filter((f) => !mapped.includes(f));
    return missing;
  }, [mapping]);

  const goToPreview = useCallback(async () => {
    if (mappingErrors.length > 0) return;
    if (!tenantId) {
      toast({ title: "Tenant manquant", description: "Aucun cabinet détecté.", variant: "destructive" });
      return;
    }

    setImporting(true);
    setProgress(0);

    const headerToField = mapping;

    // Fetch all existing clients of this tenant (only the fields we need to
    // detect duplicates). This is more reliable than `.in("email", [...])`
    // because we want case-insensitive email match AND phone match, neither
    // of which work cleanly via Supabase filters on possibly-mixed-case data.
    const { data: existing, error: existErr } = await supabase
      .from("clients")
      .select("id, email, mobile, phone")
      .eq("tenant_id", tenantId);

    if (existErr) {
      toast({
        title: "Erreur",
        description: "Impossible de vérifier les doublons : " + existErr.message,
        variant: "destructive",
      });
      setImporting(false);
      return;
    }

    const byEmail = new Map<string, string>();
    const byPhone = new Map<string, string>();
    for (const c of existing ?? []) {
      if (c.email) {
        const e = normalizeEmail(c.email);
        if (e) byEmail.set(e, c.id);
      }
      if (c.mobile) {
        const p = normalizePhone(c.mobile);
        if (p) byPhone.set(p, c.id);
      }
      if (c.phone) {
        const p = normalizePhone(c.phone);
        if (p) byPhone.set(p, c.id);
      }
    }

    const dups = new Map<number, { existingId: string; matchOn: "email" | "phone" }>();
    rows.forEach((row, i) => {
      let email = "";
      let mobile = "";
      let phone = "";
      headers.forEach((h, idx) => {
        const field = headerToField[h];
        const cell = row[idx]?.trim() ?? "";
        if (field === "email") email = cell;
        if (field === "mobile") mobile = cell;
        if (field === "phone") phone = cell;
      });

      // Priority 1: email match (case-insensitive)
      if (email) {
        const e = normalizeEmail(email);
        if (e && byEmail.has(e)) {
          dups.set(i, { existingId: byEmail.get(e)!, matchOn: "email" });
          return;
        }
      }
      // Priority 2: phone match (normalized: digits + leading + only)
      for (const candidate of [mobile, phone]) {
        if (!candidate) continue;
        const p = normalizePhone(candidate);
        if (p && byPhone.has(p)) {
          dups.set(i, { existingId: byPhone.get(p)!, matchOn: "phone" });
          return;
        }
      }
    });

    setDuplicates(dups);
    setImporting(false);
    setStep("preview");
  }, [headers, mapping, mappingErrors, rows, tenantId, toast]);

  const buildPayload = useCallback(
    (rowIndex: number) => {
      const row = rows[rowIndex];
      const payload: any = {
        tenant_id: tenantId,
        type_adresse: "client",
        status: "prospect",
        is_company: false,
      };
      const errors: string[] = [];

      headers.forEach((h, idx) => {
        const field = mapping[h];
        if (!field || field === "ignore") return;
        const raw = row[idx]?.trim() ?? "";
        if (!raw) return;

        if (field === "email") {
          const email = raw.toLowerCase();
          if (!isValidEmail(email)) {
            errors.push(`Email invalide: ${raw}`);
            return;
          }
          payload.email = email;
        } else if (field === "birthdate") {
          const d = parseDate(raw);
          if (!d) {
            errors.push(`Date invalide: ${raw}`);
            return;
          }
          payload.birthdate = d;
        } else if (field === "postal_code") {
          payload.postal_code = raw;
          payload.zip_code = raw;
        } else if (field === "notes") {
          payload.tags = [...(payload.tags ?? []), raw];
        } else if (field === "company_name") {
          payload.company_name = raw;
          payload.is_company = true;
        } else {
          payload[field] = raw;
        }
      });

      payload.tags = [
        ...(payload.tags ?? []),
        `Importé le ${new Date().toLocaleDateString("fr-CH")}`,
      ];

      const missing = REQUIRED_FIELDS.filter((f) => !payload[f]);
      if (missing.length > 0) {
        errors.push(`Champ(s) requis manquant(s): ${missing.map((f) => FIELD_LABELS[f]).join(", ")}`);
      }

      return { payload, errors };
    },
    [headers, mapping, rows, tenantId]
  );

  const runImport = useCallback(async () => {
    if (!tenantId) return;
    setImporting(true);
    setProgress(0);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const failed: { row: number; reason: string }[] = [];

    const toInsert: any[] = [];
    const toUpdate: { id: string; payload: any }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const dup = duplicates.get(i);
      const { payload, errors } = buildPayload(i);

      if (errors.length > 0) {
        failed.push({ row: i + 2, reason: errors.join(" ; ") });
        continue;
      }

      if (dup) {
        if (globalStrategy === "skip") {
          skipped++;
          continue;
        }
        if (globalStrategy === "update") {
          const { tenant_id, type_adresse, status, ...rest } = payload;
          toUpdate.push({ id: dup.existingId, payload: rest });
          continue;
        }
      }
      toInsert.push(payload);
    }

    const CHUNK = 100;
    let processed = 0;
    const total = toInsert.length + toUpdate.length;

    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const chunk = toInsert.slice(i, i + CHUNK);
      const { data, error } = await supabase.from("clients").insert(chunk).select("id");
      if (error) {
        chunk.forEach((_, idx) => {
          failed.push({ row: i + idx + 2, reason: error.message });
        });
      } else {
        created += data?.length ?? 0;
      }
      processed += chunk.length;
      setProgress(total > 0 ? Math.round((processed / total) * 100) : 100);
    }

    for (const { id, payload } of toUpdate) {
      const { error } = await supabase.from("clients").update(payload).eq("id", id);
      if (error) {
        failed.push({ row: 0, reason: `Mise à jour ${id}: ${error.message}` });
      } else {
        updated++;
      }
      processed++;
      setProgress(total > 0 ? Math.round((processed / total) * 100) : 100);
    }

    setResult({ created, updated, skipped, failed });
    setImporting(false);
    setStep("result");
    onImported?.();
  }, [buildPayload, duplicates, globalStrategy, onImported, rows, tenantId]);

  const previewRows = rows.slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importer des prospects
          </DialogTitle>
          <DialogDescription>
            Importez vos prospects depuis un fichier CSV ou Excel. Les fiches seront créées avec le statut « prospect ».
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 px-1 py-2 text-xs">
          {[
            { id: "upload", label: "Fichier" },
            { id: "mapping", label: "Colonnes" },
            { id: "preview", label: "Aperçu" },
            { id: "result", label: "Résultat" },
          ].map((s, i, arr) => (
            <div key={s.id} className="flex items-center gap-2 flex-1">
              <div
                className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center font-semibold transition-colors",
                  step === s.id
                    ? "bg-primary text-primary-foreground"
                    : arr.findIndex((a) => a.id === step) > i
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {i + 1}
              </div>
              <span className={cn("font-medium", step === s.id ? "text-foreground" : "text-muted-foreground")}>{s.label}</span>
              {i < arr.length - 1 && <div className="flex-1 h-px bg-border" />}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-auto">
          {step === "upload" && (
            <div className="space-y-4">
              <div
                onDrop={onDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-12 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
              >
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="font-medium">Glissez votre fichier ici ou cliquez pour parcourir</p>
                <p className="text-sm text-muted-foreground mt-1">CSV ou Excel (.xlsx) — max {MAX_ROWS} lignes</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={onFileChange}
                  className="hidden"
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                <div>
                  <p className="font-medium text-sm">Pas de fichier prêt ?</p>
                  <p className="text-xs text-muted-foreground">Téléchargez le modèle et remplissez-le.</p>
                </div>
                <Button variant="outline" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Télécharger le modèle
                </Button>
              </div>
            </div>
          )}

          {step === "mapping" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Fichier: <strong>{fileName}</strong> — {rows.length} ligne(s)
                </span>
              </div>
              <Card>
                <CardContent className="p-4 space-y-2">
                  {headers.map((h) => (
                    <div key={h} className="grid grid-cols-2 gap-3 items-center">
                      <div className="text-sm font-medium truncate" title={h}>
                        {h}
                      </div>
                      <Select
                        value={mapping[h] ?? "ignore"}
                        onValueChange={(v) =>
                          setMapping((prev) => ({ ...prev, [h]: v as FieldKey | "ignore" }))
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ignore">— Ignorer cette colonne —</SelectItem>
                          {(Object.keys(FIELD_LABELS) as FieldKey[]).map((f) => (
                            <SelectItem key={f} value={f}>
                              {FIELD_LABELS[f]}
                              {REQUIRED_FIELDS.includes(f) && " *"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </CardContent>
              </Card>
              {mappingErrors.length > 0 && (
                <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    Champ(s) requis non mappé(s): {mappingErrors.map((f) => FIELD_LABELS[f]).join(", ")}.
                  </div>
                </div>
              )}
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Lignes à importer</p>
                    <p className="text-2xl font-bold">{rows.length - duplicates.size}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Doublons détectés</p>
                    <p className="text-2xl font-bold text-amber-600">{duplicates.size}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Total lignes</p>
                    <p className="text-2xl font-bold">{rows.length}</p>
                  </CardContent>
                </Card>
              </div>

              {duplicates.size > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Que faire des doublons (email déjà existant) ?</p>
                  <Select value={globalStrategy} onValueChange={(v) => setGlobalStrategy(v as DuplicateStrategy)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skip">Ignorer ces lignes (recommandé)</SelectItem>
                      <SelectItem value="update">Mettre à jour les fiches existantes</SelectItem>
                      <SelectItem value="duplicate">Créer un doublon quand même</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium">Aperçu (10 premières lignes)</p>
                <ScrollArea className="h-[300px] border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Statut</TableHead>
                        {headers.map((h) => {
                          const field = mapping[h];
                          if (!field || field === "ignore") return null;
                          return <TableHead key={h}>{FIELD_LABELS[field as FieldKey]}</TableHead>;
                        })}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map((row, i) => {
                        const dup = duplicates.get(i);
                        const { errors } = buildPayload(i);
                        return (
                          <TableRow key={i}>
                            <TableCell className="text-muted-foreground">{i + 2}</TableCell>
                            <TableCell>
                              {errors.length > 0 ? (
                                <Badge variant="destructive" className="text-xs">Erreur</Badge>
                              ) : dup ? (
                                <Badge className="text-xs bg-amber-100 text-amber-700">Doublon</Badge>
                              ) : (
                                <Badge className="text-xs bg-emerald-100 text-emerald-700">Nouveau</Badge>
                              )}
                            </TableCell>
                            {headers.map((h, idx) => {
                              const field = mapping[h];
                              if (!field || field === "ignore") return null;
                              return (
                                <TableCell key={h} className="text-sm">
                                  {row[idx] || "—"}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>

              {importing && (
                <div className="space-y-2">
                  <Progress value={progress} />
                  <p className="text-xs text-muted-foreground text-center">{progress}% — import en cours…</p>
                </div>
              )}
            </div>
          )}

          {step === "result" && (
            <div className="space-y-4">
              <div className="flex flex-col items-center text-center py-6">
                <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
                <h3 className="text-lg font-semibold">Import terminé</h3>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground">Créés</p>
                    <p className="text-2xl font-bold text-emerald-600">{result.created}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground">Mis à jour</p>
                    <p className="text-2xl font-bold text-blue-600">{result.updated}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground">Ignorés</p>
                    <p className="text-2xl font-bold text-amber-600">{result.skipped}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground">Échecs</p>
                    <p className="text-2xl font-bold text-destructive">{result.failed.length}</p>
                  </CardContent>
                </Card>
              </div>
              {result.failed.length > 0 && (
                <ScrollArea className="h-[200px] border rounded-lg p-3">
                  <p className="text-sm font-medium mb-2">Détails des échecs</p>
                  <ul className="space-y-1 text-sm">
                    {result.failed.map((f, i) => (
                      <li key={i} className="text-destructive">
                        Ligne {f.row}: {f.reason}
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 pt-4 border-t">
          <div>
            {step === "mapping" && (
              <Button variant="ghost" onClick={() => setStep("upload")} disabled={importing}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour
              </Button>
            )}
            {step === "preview" && (
              <Button variant="ghost" onClick={() => setStep("mapping")} disabled={importing}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} disabled={importing}>
              <X className="h-4 w-4 mr-2" />
              {step === "result" ? "Fermer" : "Annuler"}
            </Button>
            {step === "mapping" && (
              <Button onClick={goToPreview} disabled={mappingErrors.length > 0 || importing}>
                {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                Continuer
              </Button>
            )}
            {step === "preview" && (
              <Button onClick={runImport} disabled={importing}>
                {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Lancer l'import
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
