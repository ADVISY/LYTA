import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserTenant } from "@/hooks/useUserTenant";
import { PendingScan, ScanField, WorkflowAction, ProductDetected, FamilyMemberDetected } from "@/hooks/usePendingScans";
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  User,
  FileText,
  CreditCard,
  Shield,
  Edit2,
  Check,
  Loader2,
  Sparkles,
  FolderPlus,
  CalendarCheck,
  FileCheck,
  Clock,
  XCircle,
  ArrowRightLeft,
  IdCard,
  FileWarning,
  AlertOctagon,
  Users,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { recordAuditLog } from "@/lib/audit";
import { savePolicy } from "@/lib/policiesApi";
import { ProductBranchEditor } from "@/components/crm/ia-scan/ProductBranchEditor";
import { IAScanContractsWizard } from "@/components/crm/ia-scan/IAScanContractsWizard";
import { Sparkles } from "lucide-react";

/** Extended primary_holder type that allows arbitrary string field access from AI snapshots */
interface PrimaryHolderData {
  last_name: string;
  first_name: string;
  birthdate?: string;
  gender?: string;
  [key: string]: string | undefined;
}

/** Supabase error shape for typed error handling */
interface SupabaseErrorShape {
  code?: string;
  status?: number;
  message?: string;
  hint?: string;
  details?: string;
}

/** Narrow an unknown catch value to a SupabaseErrorShape */
function toSupabaseError(e: unknown): SupabaseErrorShape {
  if (e !== null && typeof e === 'object') return e as SupabaseErrorShape;
  return {};
}

/** Mask AVS number for display: show first 4 and last 2 chars, e.g. "756.****.**.**" → "756.*****.**" */
const maskAvs = (avs: string): string => {
  if (!avs || avs.length < 6) return avs;
  return avs.slice(0, 4) + '*'.repeat(avs.length - 6) + avs.slice(-2);
};

interface ScanValidationDialogProps {
  scan: PendingScan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onValidated: () => void;
}

const FIELD_LABELS: Record<string, string> = {
  // Client fields
  nom: 'Nom',
  prenom: 'Prénom',
  date_naissance: 'Date de naissance',
  email: 'Email',
  telephone: 'Téléphone',
  adresse: 'Adresse',
  npa: 'NPA',
  localite: 'Localité',
  canton: 'Canton',
  nationalite: 'Nationalité',
  etat_civil: 'État civil',
  numero_avs: 'N° AVS',
  profession: 'Profession',
  employeur: 'Employeur',
  // Old contract fields
  ancienne_compagnie: 'Ancienne compagnie',
  ancien_numero_police: 'Ancien N° police',
  ancien_type_produit: 'Ancien type produit',
  ancienne_date_debut: 'Ancienne date début',
  ancienne_date_fin: 'Ancienne date fin',
  ancienne_prime_mensuelle: 'Ancienne prime/mois',
  ancienne_prime_annuelle: 'Ancienne prime/an',
  ancienne_franchise: 'Ancienne franchise',
  // New contract fields
  nouvelle_compagnie: 'Nouvelle compagnie',
  nouveau_numero_police: 'Nouveau N° police',
  nouveau_type_produit: 'Nouveau type produit',
  nouvelle_date_debut: 'Nouvelle date début',
  nouvelle_date_fin: 'Nouvelle date fin',
  nouvelle_prime_mensuelle: 'Nouvelle prime/mois',
  nouvelle_prime_annuelle: 'Nouvelle prime/an',
  nouvelle_franchise: 'Nouvelle franchise',
  duree_engagement: 'Durée engagement',
  // Standard contract fields
  compagnie: 'Compagnie',
  numero_police: 'N° Police',
  type_produit: 'Type de produit',
  categorie: 'Catégorie',
  date_debut: 'Date début',
  date_fin: 'Date fin',
  duree_contrat: 'Durée contrat',
  prime_mensuelle: 'Prime mensuelle',
  prime_annuelle: 'Prime annuelle',
  franchise: 'Franchise',
  garanties_principales: 'Garanties',
  statut_contrat: 'Statut contrat',
  // Termination fields
  date_resiliation: 'Date résiliation',
  motif_resiliation: 'Motif résiliation',
  compagnie_resiliee: 'Compagnie résiliée',
};

const CATEGORY_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  client: { label: 'Informations client', icon: User, color: 'text-blue-500' },
  identity: { label: 'Pièce d\'identité', icon: IdCard, color: 'text-indigo-500' },
  contract: { label: 'Contrat', icon: FileText, color: 'text-violet-500' },
  old_contract: { label: 'Ancienne police', icon: FileWarning, color: 'text-orange-500' },
  new_contract: { label: 'Nouvelle police', icon: FileCheck, color: 'text-emerald-500' },
  premium: { label: 'Primes & Franchise', icon: CreditCard, color: 'text-cyan-500' },
  guarantees: { label: 'Garanties', icon: Shield, color: 'text-amber-500' },
  termination: { label: 'Résiliation', icon: XCircle, color: 'text-red-500' },
};

const DOC_TYPE_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  police_active: { label: 'Police active', icon: FileCheck, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  ancienne_police: { label: 'Ancienne police', icon: FileWarning, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  nouvelle_police: { label: 'Nouvelle police', icon: FileText, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  resiliation: { label: 'Résiliation', icon: XCircle, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  piece_identite: { label: 'Pièce d\'identité', icon: IdCard, color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
  attestation: { label: 'Attestation', icon: FileCheck, color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
  offre: { label: 'Offre', icon: FileText, color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  avenant: { label: 'Avenant', icon: ArrowRightLeft, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  autre: { label: 'Autre', icon: FileText, color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400' },
};

export default function ScanValidationDialog({
  scan,
  open,
  onOpenChange,
  onValidated,
}: ScanValidationDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tenantId: tenantIdFromHook, loading: tenantLoading } = useUserTenant();
  const queryClient = useQueryClient();

  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [editingField, setEditingField] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Creation options
  const [createOldContract, setCreateOldContract] = useState(true);
  const [createNewContract, setCreateNewContract] = useState(true);
  const [createSuivis, setCreateSuivis] = useState(true);
  const [linkDocuments, setLinkDocuments] = useState(true);
  const [createFamilyMembers, setCreateFamilyMembers] = useState(true);

  // F5 — Unified-form wizard (Beta): opens the SAME ContractForm as manual
  // creation, pre-filled from the scan. Strict mandat gate, sequential
  // multi-policy support. Lives next to the legacy "Valider & créer" so we
  // can A/B test before removing the old path.
  const [betaWizardOpen, setBetaWizardOpen] = useState(false);
  const [betaWizardClientId, setBetaWizardClientId] = useState<string | null>(null);
  const [betaResolvingClient, setBetaResolvingClient] = useState(false);
  const [betaFamilyClientMap, setBetaFamilyClientMap] = useState<Record<string, string>>({});
  // Lazy creation state: prepared in openBetaWizard, executed only when the
  // broker confirms by starting the first contract group. If they close the
  // wizard before that, NOTHING is written to the DB.
  const [pendingCreates, setPendingCreates] = useState<{
    existingClientId: string | null;
    primaryPayload: Record<string, unknown> | null;
    familyPayloads: Array<{ payload: Record<string, unknown>; relation: string; fullNameLower: string }>;
    primaryFullNameLower: string;
  } | null>(null);

  const logAudit = async (
    tenantId: string | null,
    action: string,
    entity: string,
    entityId?: string | null,
    metadata?: Record<string, unknown>
  ) => {
    await recordAuditLog({
      action,
      entity,
      entityId,
      tenantId,
      userId: user?.id ?? null,
      metadata: {
        source: "ia_scan",
        scan_id: scan?.id ?? null,
        ...metadata,
      },
    });
  };

  // Initialize edited values when scan changes
  useEffect(() => {
    if (scan) {
      const initial: Record<string, string> = {};
      scan.fields.forEach(field => {
        initial[field.field_name] = field.extracted_value || '';
      });
      setEditedValues(initial);
    }
  }, [scan]);

  if (!scan) return null;

  // Map of alternative field names (AI may return different naming conventions)
  const FIELD_NAME_ALIASES: Record<string, string[]> = {
    nom: ['nom', 'last_name', 'lastname', 'family_name'],
    prenom: ['prenom', 'first_name', 'firstname', 'given_name'],
    date_naissance: ['date_naissance', 'birthdate', 'birth_date', 'date_of_birth'],
    email: ['email', 'e-mail', 'courriel'],
    telephone: ['telephone', 'phone', 'tel'],
    mobile: ['mobile', 'portable', 'cell_phone'],
    adresse: ['adresse', 'address', 'rue'],
    npa: ['npa', 'postal_code', 'zip_code', 'code_postal'],
    localite: ['localite', 'city', 'ville', 'locality'],
    canton: ['canton', 'state', 'region'],
    nationalite: ['nationalite', 'nationality', 'nation'],
    etat_civil: ['etat_civil', 'civil_status', 'marital_status'],
    profession: ['profession', 'job', 'occupation'],
    employeur: ['employeur', 'employer', 'company'],
    permis: ['permis', 'permit', 'permit_type', 'type_permis'],
    numero_avs: ['numero_avs', 'avs_number', 'ahv_number', 'social_security'],
  };

  const getValue = (fieldName: string) => {
    // Check editedValues first
    if (editedValues[fieldName] !== undefined && editedValues[fieldName] !== '') {
      return editedValues[fieldName];
    }
    
    // Check for alternative names
    const aliases = FIELD_NAME_ALIASES[fieldName] || [fieldName];
    for (const alias of aliases) {
      if (editedValues[alias] !== undefined && editedValues[alias] !== '') {
        return editedValues[alias];
      }
      const field = scan.fields.find(f => f.field_name === alias);
      if (field?.extracted_value) {
        return field.extracted_value;
      }
    }
    
    return '';
  };

  const handleFieldChange = (fieldName: string, value: string) => {
    setEditedValues(prev => ({ ...prev, [fieldName]: value }));
  };

  const getConfidenceIcon = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high':
        return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
      case 'medium':
        return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
      case 'low':
        return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
    }
  };

  const getConfidenceBadge = (confidence: 'high' | 'medium' | 'low') => {
    const variants = {
      high: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      low: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };
    const labels = {
      high: 'Haute',
      medium: 'Moyenne',
      low: 'À vérifier',
    };
    return (
      <Badge variant="secondary" className={cn("text-xs", variants[confidence])}>
        {labels[confidence]}
      </Badge>
    );
  };

  // Group fields by category
  const fieldsByCategory = scan.fields.reduce((acc, field) => {
    if (!acc[field.field_category]) {
      acc[field.field_category] = [];
    }
    acc[field.field_category].push(field);
    return acc;
  }, {} as Record<string, ScanField[]>);

  // Check what data we have - including new multi-product arrays
  const hasOldContractData = scan.has_old_policy || scan.fields.some(f => f.field_category === 'old_contract') || (scan.old_products_detected && scan.old_products_detected.length > 0);
  const hasNewContractData = scan.has_new_policy || scan.fields.some(f => f.field_category === 'new_contract') || (scan.new_products_detected && scan.new_products_detected.length > 0);
  const hasContractData = scan.fields.some(f => f.field_category === 'contract' || f.field_category === 'premium');
  const hasTermination = scan.has_termination || scan.fields.some(f => f.field_category === 'termination');
  const hasMultipleProducts = scan.has_multiple_products || (scan.new_products_detected && scan.new_products_detected.length > 1);
  const hasFamilyMembers = scan.has_family_members || (scan.family_members_detected && scan.family_members_detected.length > 0);
  const oldProductsCount = scan.old_products_detected?.length || 0;
  const newProductsCount = scan.new_products_detected?.length || 0;
  
  // Calculate unique companies (contracts will be grouped by company)
  const oldCompaniesCount = new Set(scan.old_products_detected?.map(p => (p.company || '').toLowerCase().trim()).filter(Boolean)).size;
  const newCompaniesCount = new Set(scan.new_products_detected?.map(p => (p.company || '').toLowerCase().trim()).filter(Boolean)).size;

  const parseAmount = (value: string | null | undefined): number | null => {
    if (!value) return null;
    const cleaned = value.replace(/[^0-9.,]/g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  };

  // Parse European date format (DD.MM.YYYY or DD/MM/YYYY) to ISO format (YYYY-MM-DD)
  const parseDate = (value: string | null | undefined): string | null => {
    if (!value) return null;
    
    // If already in ISO format (YYYY-MM-DD), return as-is
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    
    // Parse European format: DD.MM.YYYY or DD/MM/YYYY
    const europeanMatch = value.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
    if (europeanMatch) {
      const [, day, month, year] = europeanMatch;
      const paddedDay = day.padStart(2, '0');
      const paddedMonth = month.padStart(2, '0');
      return `${year}-${paddedMonth}-${paddedDay}`;
    }
    
    // Try parsing as a date string
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
    
    return null;
  };

  const createPolicyRecord = async (tenantId: string, policyData: Record<string, unknown>) =>
    savePolicy({
      action: "create",
      tenantId,
      policyData,
    });

  /**
   * F5 — Open the unified ContractForm wizard.
   * Tries to resolve an existing client (by email/phone/name) so the wizard
   * has a clientId. If none is found, the wizard's own gates show a clear
   * message ("Fiche client manquante") and the broker can fall back to the
   * legacy "Valider & créer" path which creates the client itself.
   */
  const openBetaWizard = async () => {
    if (!scan || !tenantIdFromHook) return;
    setBetaResolvingClient(true);
    try {
      // ============================================================
      // LAZY: this function NEVER inserts into the DB. It only
      // prepares the payloads and resolves existing matches. The
      // actual inserts happen at the first 'Démarrer' click in the
      // wizard via materialiseBetaPendingCreates(). If the broker
      // closes the wizard before that, NOTHING is written.
      // ============================================================
      const getField = (names: string[]): string | null => {
        for (const n of names) {
          const f = scan.fields.find(
            (ff) => ff.name?.toLowerCase() === n.toLowerCase() && ff.value,
          );
          if (f?.value) return f.value.trim();
        }
        return null;
      };
      const email = getField(["email", "e-mail", "courriel"]);
      const phone = getField(["telephone", "téléphone", "phone", "mobile"]);
      const lastName = getField(["nom", "last_name"]);
      const firstName = getField(["prenom", "prénom", "first_name"]);

      // 1. Resolve an EXISTING client (no insert)
      let existingClientId: string | null = null;
      if (email) {
        const { data } = await supabase
          .from("clients").select("id")
          .eq("tenant_id", tenantIdFromHook).ilike("email", email)
          .limit(1).maybeSingle();
        if (data?.id) existingClientId = data.id;
      }
      if (!existingClientId && lastName && firstName) {
        const { data } = await supabase
          .from("clients").select("id")
          .eq("tenant_id", tenantIdFromHook)
          .ilike("last_name", lastName).ilike("first_name", firstName)
          .limit(1).maybeSingle();
        if (data?.id) existingClientId = data.id;
      }
      if (!existingClientId && phone) {
        const phoneClean = phone.replace(/\s+/g, "");
        const { data } = await supabase
          .from("clients").select("id")
          .eq("tenant_id", tenantIdFromHook)
          .ilike("phone", `%${phoneClean.slice(-8)}%`)
          .limit(1).maybeSingle();
        if (data?.id) existingClientId = data.id;
      }

      // 2. Build the primary client payload (no insert yet)
      const rawGender = getField(["genre", "sexe", "gender"]);
      const normalizedGender =
        rawGender && /^(m|h|homme|male|masculin)$/i.test(rawGender) ? "male"
          : rawGender && /^(f|femme|female|feminin|féminin)$/i.test(rawGender) ? "female"
          : null;
      const birthRaw = getField(["date_naissance", "birthdate", "ddn"]);
      const birthIso = (() => {
        if (!birthRaw) return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(birthRaw)) return birthRaw;
        const m = birthRaw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
        if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
        return null;
      })();
      const willHaveActiveContract =
        (scan.new_products_detected && scan.new_products_detected.length > 0) || false;

      const primaryPayload = existingClientId ? null : {
        tenant_id: tenantIdFromHook,
        last_name: lastName,
        first_name: firstName,
        email,
        phone,
        mobile: getField(["mobile"]),
        address: getField(["adresse", "address"]),
        postal_code: getField(["npa", "code_postal", "postal_code"]),
        city: getField(["localite", "localité", "city", "ville"]),
        canton: getField(["canton"]),
        nationality: getField(["nationalite", "nationalité", "nationality"]),
        civil_status: getField(["etat_civil", "civil_status"]),
        profession: getField(["profession"]),
        employer: getField(["employeur", "employer"]),
        permit_type: getField(["permis", "permit_type"]),
        gender: normalizedGender,
        birthdate: birthIso,
        status: willHaveActiveContract ? "actif" : "prospect",
      };

      // 3. Build family member payloads (no insert) with strict dedup
      const canonName = (first?: string | null, last?: string | null) => {
        return `${first ?? ""} ${last ?? ""}`
          .toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
          .replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean)
          .sort().join(" ");
      };
      const primaryFullNameLower = canonName(firstName, lastName);
      const familyMembersRaw = (scan.family_members_detected || []) as any[];
      const seen = new Set<string>([primaryFullNameLower].filter(Boolean));
      const familyPayloads: Array<{ payload: Record<string, unknown>; relation: string; fullNameLower: string }> = [];

      for (const fm of familyMembersRaw) {
        const f = String(fm?.first_name || "").trim();
        const l = String(fm?.last_name || "").trim();
        if (!f || !l) continue;  // skip nameless
        const key = canonName(f, l);
        if (seen.has(key)) continue;  // dedup + skip primary clone
        seen.add(key);

        const fmBirthIso = (() => {
          const raw = fm.birthdate || fm.birth_date;
          if (!raw) return null;
          if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
          const m = String(raw).match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
          if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
          return null;
        })();
        const fmGender = (() => {
          const g = (fm.gender || fm.sexe || "").toString().toLowerCase();
          if (/^(m|h|homme|male|masculin)$/i.test(g)) return "male";
          if (/^(f|femme|female|feminin|féminin)$/i.test(g)) return "female";
          return null;
        })();
        const relation = (() => {
          const r = (fm.relationship || fm.relation_type || "").toString().toLowerCase();
          if (/conjoint|époux|epouse|partenaire|spouse/i.test(r)) return "conjoint";
          if (/enfant|fils|fille|child/i.test(r)) return "enfant";
          if (/parent|père|pere|mère|mere/i.test(r)) return "parent";
          return "autre";
        })();

        familyPayloads.push({
          payload: {
            tenant_id: tenantIdFromHook,
            first_name: f,
            last_name: l,
            birthdate: fmBirthIso,
            gender: fmGender,
            nationality: fm.nationality ?? null,
            status: "actif",
            __fmBirthIso: fmBirthIso,  // for the family_members link row
          } as any,
          relation,
          fullNameLower: key,
        });
      }

      // 4. Stash the prepared payloads — DB inserts deferred until first 'Démarrer'.
      setPendingCreates({
        existingClientId,
        primaryPayload,
        familyPayloads,
        primaryFullNameLower,
      });
      setBetaWizardClientId(existingClientId);  // null if not yet created
      setBetaFamilyClientMap({});  // filled at materialise time
      setBetaWizardOpen(true);
    } finally {
      setBetaResolvingClient(false);
    }
  };

  /** Lazy insert: runs at first 'Démarrer' click in the wizard. Idempotent. */
  const materialiseBetaPendingCreates = async (): Promise<{ clientId: string | null; familyMap: Record<string, string> }> => {
    if (!pendingCreates || !tenantIdFromHook) {
      return { clientId: betaWizardClientId, familyMap: betaFamilyClientMap };
    }
    const { existingClientId, primaryPayload, familyPayloads, primaryFullNameLower } = pendingCreates;
    let clientId = existingClientId;

    // Already materialised?
    if (!primaryPayload && existingClientId && Object.keys(betaFamilyClientMap).length >= (familyPayloads.length + (primaryFullNameLower ? 1 : 0))) {
      return { clientId: existingClientId, familyMap: betaFamilyClientMap };
    }

    if (!clientId && primaryPayload) {
      const { data: created, error } = await supabase.from("clients").insert(primaryPayload).select("id").single();
      if (error || !created?.id) {
        toast({ title: "Échec de création du client", description: error?.message || "", variant: "destructive" });
        return { clientId: null, familyMap: {} };
      }
      clientId = created.id;
      await logAudit(tenantIdFromHook, "create", "client", clientId, { source: "ia_scan_wizard", scan_id: scan!.id });
      toast({ title: "Fiche client créée", description: `${primaryPayload.first_name ?? ""} ${primaryPayload.last_name ?? ""}`.trim() });
    }

    const familyMap: Record<string, string> = {};
    if (clientId && primaryFullNameLower) familyMap[primaryFullNameLower] = clientId;

    for (const fp of familyPayloads) {
      const { payload, relation, fullNameLower } = fp;
      const { __fmBirthIso, ...cleanPayload } = payload as any;
      const { data: fmClient, error: fmErr } = await supabase.from("clients").insert(cleanPayload).select("id").single();
      if (fmErr || !fmClient?.id) {
        console.warn("[scan] family member client create failed", fmErr);
        continue;
      }
      await supabase.from("family_members").insert({
        client_id: clientId,
        linked_client_id: fmClient.id,
        first_name: cleanPayload.first_name,
        last_name: cleanPayload.last_name,
        birth_date: __fmBirthIso ?? null,
        relation_type: relation,
        nationality: cleanPayload.nationality ?? null,
      });
      familyMap[fullNameLower] = fmClient.id;
    }

    if (familyPayloads.length > 0) {
      toast({
        title: `${familyPayloads.length} membre${familyPayloads.length > 1 ? "s" : ""} de famille créé${familyPayloads.length > 1 ? "s" : ""}`,
        description: "Chacun aura sa propre fiche et ses propres contrats.",
      });
    }

    // === DOCUMENTS — attach every scanned file to the primary client =======
    // The broker can re-attach individual files to specific policies later
    // from the contract form, but auto-attaching to the client guarantees
    // they're not lost.
    if (clientId && Array.isArray(scan?.documents_detected)) {
      const docRows = (scan.documents_detected as any[])
        .filter((d) => d?.file_key && d?.file_name)
        .map((d) => ({
          owner_id: clientId,
          owner_type: "client",
          tenant_id: tenantIdFromHook,
          file_key: d.file_key,
          file_name: d.file_name,
          mime_type: "application/pdf",
          doc_kind: (() => {
            const t = (d.doc_type || "").toLowerCase();
            if (t === "police_active" || t === "nouvelle_police" || t === "ancienne_police") return "police";
            if (t === "resiliation") return "resiliation";
            if (t === "mandat_gestion") return "mandat_gestion";
            if (t === "piece_identite") return "piece_identite";
            if (t === "justificatif_domicile") return "justificatif_domicile";
            if (t === "bulletin_salaire") return "bulletin_salaire";
            if (t === "attestation") return "attestation";
            if (t === "offre") return "offre";
            if (t === "avenant") return "avenant";
            return "autre";
          })(),
        }));

      if (docRows.length > 0) {
        const { error: docErr } = await supabase.from("documents").insert(docRows);
        if (docErr) console.warn("[scan] docs attach failed", docErr);
      }
    }

    // === SUIVIS — auto-create from suggested_followups / résiliation ======
    if (clientId) {
      const followups: Array<{ kind?: string; label?: string; due_date?: string; notes?: string }> =
        ((scan as any)?.workflow_actions as any[] | undefined) || [];

      // Also fire a default résiliation suivi if has_termination flag is true
      const hasTerm = !!(scan as any)?.has_termination;
      const allSuivis: typeof followups = [...followups];
      if (hasTerm && !followups.some((f) => /resil/i.test(f.kind || ""))) {
        allSuivis.push({
          kind: "resiliation",
          label: "Suivi résiliation — vérifier ancien contrat",
          due_date: undefined,
          notes: "Créé automatiquement depuis Smartflow (résiliation détectée dans le scan)",
        });
      }

      if (allSuivis.length > 0) {
        // Schema constraints on suivis: status ∈ {ouvert, en_cours, fermé},
        // date column is reminder_date (not due_date).
        const suiviRows = allSuivis
          .filter((f) => f.label || f.kind)
          .map((f) => ({
            tenant_id: tenantIdFromHook,
            client_id: clientId,
            title: f.label || f.kind || "Suivi Smartflow",
            description: f.notes || null,
            type: f.kind === "resiliation" ? "resiliation"
              : f.kind === "renouvellement" ? "renouvellement"
              : f.kind === "anniversaire" ? "anniversaire"
              : "rappel",
            status: "ouvert",
            reminder_date: f.due_date || null,
          }));
        if (suiviRows.length > 0) {
          const { error: suErr } = await supabase.from("suivis").insert(suiviRows);
          if (suErr) {
            console.warn("[scan] suivis create failed", suErr);
          } else {
            toast({
              title: `${suiviRows.length} suivi${suiviRows.length > 1 ? "s" : ""} créé${suiviRows.length > 1 ? "s" : ""}`,
              description: "Visible dans la fiche client → onglet Suivis.",
            });
          }
        }
      }
    }

    setBetaWizardClientId(clientId);
    setBetaFamilyClientMap(familyMap);
    setPendingCreates(null);  // mark as materialised → won't re-run

    // Refresh every list that may now show the new client / family /
    // documents / suivis so the broker sees them right away (without a
    // page reload).
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["clients"] }),
      queryClient.invalidateQueries({ queryKey: ["family_members"] }),
      queryClient.invalidateQueries({ queryKey: ["documents"] }),
      queryClient.invalidateQueries({ queryKey: ["suivis"] }),
    ]);

    return { clientId, familyMap };
  };

  const handleBetaWizardDone = (createdPolicyIds: string[]) => {
    setBetaWizardOpen(false);
    toast({
      title: "Contrats créés",
      description: `${createdPolicyIds.length} contrat${createdPolicyIds.length > 1 ? "s" : ""} créé${createdPolicyIds.length > 1 ? "s" : ""} via le formulaire pré-rempli.`,
    });
    onValidated();
    onOpenChange(false);
  };

  const handleValidate = async () => {
    console.log('[ScanValidation] Starting validation...', { userId: user?.id, tenantId: tenantIdFromHook });

    if (!user) {
      console.error('[ScanValidation] Missing user');
      toast({
        title: "Session expirée",
        description: "Veuillez vous reconnecter.",
        variant: "destructive",
      });
      navigate('/connexion');
      return;
    }

    // Resolve tenantId reliably (useUserTenant can be briefly empty right after login)
    let effectiveTenantId = tenantIdFromHook;
    if (!effectiveTenantId) {
      if (tenantLoading) {
        toast({
          title: "Chargement en cours",
          description: "Votre cabinet est en cours de chargement. Réessayez dans 2 secondes.",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase
        .from('user_tenant_assignments')
        .select('tenant_id')
        .eq('user_id', user.id)
        .not('tenant_id', 'is', null)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('[ScanValidation] Failed to resolve tenantId from assignments:', error);
      }

      effectiveTenantId = data?.tenant_id ?? null;
    }

    if (!effectiveTenantId) {
      toast({
        title: "Cabinet introuvable",
        description: "Aucun cabinet n'est associé à votre compte. Contactez un administrateur.",
        variant: "destructive",
      });
      return;
    }

    // Shadow tenantId inside this handler so the rest of the function remains unchanged
    const tenantId = effectiveTenantId;

    setIsSubmitting(true);
    try {
      // Non-blocking audit: mark validation started (helps debugging when UI goes blank)
      try {
        await supabase.from('document_scan_audit').insert({
          scan_id: scan.id,
          action: 'validation_started',
          performed_by: user.id,
          ai_response_snapshot: {
            at: new Date().toISOString(),
            tenant_id: tenantId,
          },
        });
      } catch (e) {
        console.warn('[ScanValidation] audit(validation_started) failed (non-critical):', e);
      }

      // 1. Create the client - PRIORITIZE primary_holder from AI analysis, then fall back to fields
      const primaryHolder = scan.primary_holder;
      
      // Helper to get value with primary_holder as priority source
      const getClientValue = (fieldName: string, primaryHolderKey?: string): string | null => {
        // First check if we have a value from primary_holder
        const typedHolder = primaryHolder as PrimaryHolderData | undefined;
        if (primaryHolderKey && typedHolder && typedHolder[primaryHolderKey]) {
          return typedHolder[primaryHolderKey] ?? null;
        }
        // Then check editedValues (user corrections)
        if (editedValues[fieldName]) {
          return editedValues[fieldName];
        }
        // Finally check extracted fields
        return getValue(fieldName) || null;
      };

      // Normalize gender value to database allowed values: 'homme', 'femme', 'enfant'
      const normalizeGender = (rawGender: string | null): string | null => {
        if (!rawGender) return null;
        const lowerGender = rawGender.toLowerCase().trim();
        
        // Map various gender inputs to allowed values
        if (['homme', 'male', 'masculin', 'h', 'm', 'mr', 'monsieur', 'herr', 'männlich'].includes(lowerGender)) {
          return 'homme';
        }
        if (['femme', 'female', 'féminin', 'f', 'mme', 'madame', 'frau', 'weiblich', 'mademoiselle'].includes(lowerGender)) {
          return 'femme';
        }
        if (['enfant', 'child', 'kid', 'e', 'kind'].includes(lowerGender)) {
          return 'enfant';
        }
        
        // If not a valid value, return null rather than an invalid value
        return null;
      };

      const rawGender = getClientValue('genre', 'gender');
      const normalizedGender = normalizeGender(rawGender);

      // Determine client status: if we're creating active policies, set as 'actif'
      const willHaveActiveContract = (createNewContract && (hasNewContractData || (scan.new_products_detected && scan.new_products_detected.length > 0))) 
        || (!hasNewContractData && createOldContract && hasOldContractData && !hasTermination);
      
      const clientData = {
        tenant_id: tenantId,
        last_name: getClientValue('nom', 'last_name'),
        first_name: getClientValue('prenom', 'first_name'),
        birthdate: parseDate(getClientValue('date_naissance', 'birthdate')),
        email: getClientValue('email', 'email'),
        phone: getClientValue('telephone', 'phone'),
        mobile: getClientValue('mobile', 'mobile'),
        address: getClientValue('adresse', 'address'),
        postal_code: getClientValue('npa', 'npa'),
        city: getClientValue('localite', 'localite'),
        canton: getClientValue('canton', 'canton'),
        nationality: getClientValue('nationalite', 'nationality'),
        civil_status: getClientValue('etat_civil', 'civil_status'),
        profession: getClientValue('profession', 'profession'),
        employer: getClientValue('employeur', 'employeur'),
        permit_type: getClientValue('permis', 'permit_type'),
        gender: normalizedGender,
        status: willHaveActiveContract ? 'actif' : 'prospect',
      };

      console.log('[ScanValidation] Creating client with data:', clientData);

      const { data: newClient, error: clientError } = await supabase
        .from('clients')
        .insert(clientData)
        .select()
        .single();

      console.log('[ScanValidation] Client creation result:', { newClient, clientError });

      if (clientError) {
        console.error('[ScanValidation] Client creation failed:', clientError);
        throw clientError;
      }

      if (!newClient || !newClient.id) {
        throw new Error("Le client n'a pas pu être créé. Veuillez réessayer.");
      }

      await logAudit(tenantId, 'create', 'client', newClient.id, {
        first_name: newClient.first_name,
        last_name: newClient.last_name,
        status: newClient.status,
      });

      const createdPolicies: { id: string; type: 'old' | 'new' | 'standard'; productName?: string }[] = [];
      const createdSuivis: string[] = [];
      const createdFamilyMembers: { id: string; name: string }[] = [];
      const documentSizeCache = new Map<string, number>();
      type LinkedPerson = {
        clientId: string;
        firstName: string;
        lastName: string;
        birthdate: string | null;
        label: string;
      };

      const linkedPeople = new Map<string, LinkedPerson>();

      const getStoredFileSize = async (fileKey?: string | null): Promise<number | null> => {
        if (!fileKey) return null;
        if (documentSizeCache.has(fileKey)) {
          return documentSizeCache.get(fileKey) ?? null;
        }

        try {
          const { data, error } = await supabase.storage.from('documents').download(fileKey);
          if (error || !data) return null;

          documentSizeCache.set(fileKey, data.size);
          return data.size;
        } catch (error) {
          console.warn('[ScanValidation] Failed to resolve document size:', fileKey, error);
          return null;
        }
      };

      const normalizeTextValue = (value?: string | null): string =>
        (value || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim()
          .toLowerCase();

      const buildPersonKey = (
        firstName?: string | null,
        lastName?: string | null,
        birthdate?: string | null
      ): string => {
        const normalizedFirstName = normalizeTextValue(firstName);
        const normalizedLastName = normalizeTextValue(lastName);
        const normalizedBirthdate = birthdate || '';
        return `${normalizedFirstName}::${normalizedLastName}::${normalizedBirthdate}`;
      };

      const registerLinkedPerson = (person: LinkedPerson) => {
        linkedPeople.set(buildPersonKey(person.firstName, person.lastName, person.birthdate), person);
        linkedPeople.set(buildPersonKey(person.firstName, person.lastName, null), person);
      };

      const normalizeRelationship = (
        relationship?: string | null
      ): 'conjoint' | 'enfant' | 'parent' | 'autre' => {
        const normalized = normalizeTextValue(relationship);

        if (['conjoint', 'spouse', 'epoux', 'epouse', 'mari', 'femme', 'partner', 'partenaire'].includes(normalized)) {
          return 'conjoint';
        }
        if (['enfant', 'child', 'kid', 'fils', 'fille'].includes(normalized)) {
          return 'enfant';
        }
        if (['parent', 'pere', 'mere', 'father', 'mother'].includes(normalized)) {
          return 'parent';
        }

        return 'autre';
      };

      const inverseRelationship = (
        relationship: 'conjoint' | 'enfant' | 'parent' | 'autre'
      ): 'conjoint' | 'enfant' | 'parent' | 'autre' => {
        if (relationship === 'conjoint') return 'conjoint';
        if (relationship === 'enfant') return 'parent';
        if (relationship === 'parent') return 'enfant';
        return 'autre';
      };

      const parseInsuredPersonName = (fullName?: string | null) => {
        const trimmed = (fullName || '').trim();
        if (!trimmed) return { firstName: '', lastName: '' };

        const parts = trimmed.split(/\s+/).filter(Boolean);
        if (parts.length === 1) {
          return { firstName: parts[0], lastName: primaryHolder?.last_name || getValue('nom') || '' };
        }

        return {
          firstName: parts.slice(0, -1).join(' '),
          lastName: parts.slice(-1).join(' '),
        };
      };

      const getInsuredIdentity = (product?: ProductDetected) => {
        const parsedName = parseInsuredPersonName(product?.insured_person_name);
        return {
          firstName:
            product?.insured_person_first_name ||
            parsedName.firstName ||
            getClientValue('prenom', 'first_name') ||
            '',
          lastName:
            product?.insured_person_last_name ||
            parsedName.lastName ||
            getClientValue('nom', 'last_name') ||
            '',
          birthdate:
            parseDate(product?.insured_person_birthdate) ||
            null,
        };
      };

      const resolveLinkedPerson = (product?: ProductDetected): LinkedPerson => {
        const insured = getInsuredIdentity(product);
        const fullKey = buildPersonKey(insured.firstName, insured.lastName, insured.birthdate);
        const looseKey = buildPersonKey(insured.firstName, insured.lastName, null);

        return (
          linkedPeople.get(fullKey) ||
          linkedPeople.get(looseKey) || {
            clientId: newClient.id,
            firstName: getClientValue('prenom', 'first_name') || '',
            lastName: getClientValue('nom', 'last_name') || '',
            birthdate: parseDate(getClientValue('date_naissance', 'birthdate')),
            label: `${getClientValue('prenom', 'first_name') || ''} ${getClientValue('nom', 'last_name') || ''}`.trim(),
          }
        );
      };

      const deduplicateProducts = (products: ProductDetected[]): ProductDetected[] => {
        const seen = new Set<string>();
        const uniqueProducts: ProductDetected[] = [];

        for (const product of products) {
          const insured = getInsuredIdentity(product);
          const dedupeKey = [
            normalizeTextValue(product.company),
            normalizeTextValue(product.product_name),
            normalizeTextValue(product.policy_number),
            parseDate(product.start_date) || '',
            parseDate(product.end_date) || '',
            buildPersonKey(insured.firstName, insured.lastName, insured.birthdate),
          ].join('::');

          if (seen.has(dedupeKey)) continue;
          seen.add(dedupeKey);
          uniqueProducts.push(product);
        }

        return uniqueProducts;
      };

      const groupProductsByCompanyAndInsured = (products: ProductDetected[]) => {
        const grouped = new Map<
          string,
          { clientId: string; personLabel: string; products: ProductDetected[] }
        >();

        for (const product of deduplicateProducts(products)) {
          const person = resolveLinkedPerson(product);
          const companyKey = normalizeTextValue(product.company) || 'unknown';
          const groupKey = `${person.clientId}::${companyKey}`;

          if (!grouped.has(groupKey)) {
            grouped.set(groupKey, {
              clientId: person.clientId,
              personLabel: person.label,
              products: [],
            });
          }

          grouped.get(groupKey)!.products.push(product);
        }

        return grouped;
      };

      registerLinkedPerson({
        clientId: newClient.id,
        firstName: getClientValue('prenom', 'first_name') || '',
        lastName: getClientValue('nom', 'last_name') || '',
        birthdate: parseDate(getClientValue('date_naissance', 'birthdate')),
        label: `${getClientValue('prenom', 'first_name') || ''} ${getClientValue('nom', 'last_name') || ''}`.trim(),
      });

      if (createFamilyMembers && scan.family_members_detected && scan.family_members_detected.length > 0) {
        for (const member of scan.family_members_detected) {
          const firstName = (member.first_name || '').trim();
          const lastName = (member.last_name || getClientValue('nom', 'last_name') || '').trim();
          const birthdate = parseDate(member.birthdate);

          if (!firstName) continue;

          const memberKey = buildPersonKey(firstName, lastName, birthdate);
          const looseMemberKey = buildPersonKey(firstName, lastName, null);
          if (linkedPeople.has(memberKey) || linkedPeople.has(looseMemberKey)) continue;

          const relationType = normalizeRelationship(member.relationship);
          const familyClientData = {
            tenant_id: tenantId,
            last_name: lastName,
            first_name: firstName,
            birthdate,
            gender: normalizeGender(member.gender || null),
            address: getValue('adresse') || null,
            postal_code: getValue('npa') || null,
            city: getValue('localite') || null,
            canton: getValue('canton') || null,
            nationality: getValue('nationalite') || null,
            status: member.has_own_policy ? 'actif' : 'prospect',
          };

          const { data: familyClient, error: familyError } = await supabase
            .from('clients')
            .insert(familyClientData)
            .select()
            .single();

          if (familyError || !familyClient) {
            console.error('[ScanValidation] Failed to create family client:', familyError);
            continue;
          }

          createdFamilyMembers.push({
            id: familyClient.id,
            name: `${firstName} ${lastName}`.trim(),
          });

          await logAudit(tenantId, 'create', 'client', familyClient.id, {
            linked_parent_client_id: newClient.id,
            first_name: firstName,
            last_name: lastName,
            relation_type: relationType,
          });

          const { data: directRelation } = await supabase.from('family_members').insert({
            client_id: newClient.id,
            linked_client_id: familyClient.id,
            first_name: firstName,
            last_name: lastName,
            birth_date: birthdate,
            relation_type: relationType,
            nationality: getValue('nationalite') || null,
          } as any).select('id').single();

          if (directRelation?.id) {
            await logAudit(tenantId, 'create', 'family_member', directRelation.id, {
              client_id: newClient.id,
              linked_client_id: familyClient.id,
              relation_type: relationType,
            });
          }

          const { data: reverseRelation } = await supabase.from('family_members').insert({
            client_id: familyClient.id,
            linked_client_id: newClient.id,
            first_name: getClientValue('prenom', 'first_name') || '',
            last_name: getClientValue('nom', 'last_name') || '',
            birth_date: parseDate(getClientValue('date_naissance', 'birthdate')),
            relation_type: inverseRelationship(relationType),
            nationality: getValue('nationalite') || null,
          } as any).select('id').single();

          if (reverseRelation?.id) {
            await logAudit(tenantId, 'create', 'family_member', reverseRelation.id, {
              client_id: familyClient.id,
              linked_client_id: newClient.id,
              relation_type: inverseRelationship(relationType),
            });
          }

          registerLinkedPerson({
            clientId: familyClient.id,
            firstName,
            lastName,
            birthdate,
            label: `${firstName} ${lastName}`.trim(),
          });
        }
      }

      // Helper to resolve product using RPC or auto-create if not found
      // Returns the product's catalog category (health, life, auto, etc.) for proper display
      const resolveOrCreateProduct = async (
        productName: string | null,
        companyName: string | null,
        categoryHint?: string
      ): Promise<{ productId: string; wasCreated: boolean; category: string }> => {
        // Helper to normalize AI category to catalog category values (health, life, auto, home, legal, other)
        const normalizeCategoryToDisplay = (rawCategory: string | null): string => {
          if (!rawCategory) return 'health';
          const lower = rawCategory.toLowerCase().trim();
          
          // Map various AI/scan category values to display values
          if (['health', 'santé', 'sante', 'maladie', 'lamal', 'lca', 'kranken', 'malattia'].includes(lower)) {
            return 'health';
          }
          if (['life', 'vie', 'leben', 'vita', '3e pilier', '3a', '3b', 'pilier', 'prévoyance', 'prevoyance'].includes(lower)) {
            return 'life';
          }
          if (['auto', 'voiture', 'véhicule', 'vehicule', 'fahrzeug', 'automobile', 'rc auto'].includes(lower)) {
            return 'auto';
          }
          if (['home', 'ménage', 'menage', 'habitation', 'haushalt', 'rc privée', 'rc privee', 'economia domestica'].includes(lower)) {
            return 'home';
          }
          if (['legal', 'juridique', 'protection juridique', 'rechtsschutz', 'protezione giuridica'].includes(lower)) {
            return 'legal';
          }
          if (['property', 'immobilier', 'bâtiment', 'batiment', 'gebäude', 'edificio'].includes(lower)) {
            return 'property';
          }
          // Default to health for Swiss insurance context (most common)
          return 'health';
        };

        // 1. Try the RPC function first
        if (productName) {
          const { data: matches, error: rpcError } = await supabase.rpc('find_product_by_alias', {
            search_term: productName,
            company_name: companyName || null,
            category_hint: categoryHint || null
          });

          if (!rpcError && matches && matches.length > 0) {
            // Return the best match (first result, highest score)
            const bestMatch = matches.sort((a: any, b: any) => b.match_score - a.match_score)[0];
            console.log(`[resolveOrCreateProduct] Found match for "${productName}": ${bestMatch.product_name} (score: ${bestMatch.match_score})`);
            
            // Fetch the actual product to get its category from the catalog
            const { data: productData } = await supabase
              .from('insurance_products')
              .select('category')
              .eq('id', bestMatch.product_id)
              .single();
            
            // Always normalize the category to ensure consistency (catalog may have legacy values)
            const rawCatalogCategory = productData?.category || categoryHint;
            const catalogCategory = normalizeCategoryToDisplay(rawCatalogCategory);
            return { productId: bestMatch.product_id, wasCreated: false, category: catalogCategory };
          }
        }

        // 2. No match found - resolve or create company first
        let companyId: string | null = null;
        if (companyName) {
          const { data: companies } = await supabase
            .from('insurance_companies')
            .select('id')
            .ilike('name', `%${companyName}%`)
            .limit(1);

          if (companies && companies.length > 0) {
            companyId = companies[0].id;
          } else {
            // Create the company
            const { data: newCompany, error: companyError } = await supabase
              .from('insurance_companies')
              .insert({
                name: companyName,
                status: 'active',
                category: 'health',
              })
              .select('id')
              .single();
            
            if (!companyError && newCompany) {
              companyId = newCompany.id;
              console.log(`[resolveOrCreateProduct] Created new company: ${companyName}`);
            }
          }
        }

        // 3. Auto-create the product (status='active' as requested)
        const normalizedCategory = normalizeCategoryToDisplay(categoryHint);
        const finalProductName = productName || `Produit ${companyName || 'Inconnu'}`;
        const { data: newProduct, error: productError } = await supabase
          .from('insurance_products')
          .insert({
            name: finalProductName,
            company_id: companyId,
            status: 'active',
            source: 'ia_scan',
            category: normalizedCategory,
            subcategory: categoryHint || 'base',
          })
          .select('id')
          .single();

        if (!productError && newProduct) {
          console.log(`[resolveOrCreateProduct] Created new product: ${finalProductName} with category: ${normalizedCategory}`);
          return { productId: newProduct.id, wasCreated: true, category: normalizedCategory };
        }

        // 4. Ultimate fallback - get any existing product
        const { data: anyProduct } = await supabase
          .from('insurance_products')
          .select('id, category')
          .eq('status', 'active')
          .limit(1)
          .single();

        if (anyProduct) {
          console.warn(`[resolveOrCreateProduct] Using fallback product for "${productName}"`);
          return { productId: anyProduct.id, wasCreated: false, category: anyProduct.category || 'health' };
        }

        throw new Error(`Impossible de créer ou trouver un produit pour "${productName || companyName}"`);
      };

      // Helper for legacy single-product logic (uses new resolveOrCreateProduct)
      const findProductId = async (companyName: string | null, productCategory?: string): Promise<string | null> => {
        if (!companyName) return null;
        try {
          const result = await resolveOrCreateProduct(null, companyName, productCategory);
          return result.productId;
        } catch {
          return null;
        }
      };

      // 2. CREATE OLD POLICIES - Group by insured person and company for multi-product contracts
      if (createOldContract && scan.old_products_detected && scan.old_products_detected.length > 0) {
        const groupedOldProducts = groupProductsByCompanyAndInsured(scan.old_products_detected);
        
        for (const [companyKey, group] of groupedOldProducts) {
          const { clientId, personLabel, products } = group;
          const firstProduct = products[0];
          
          // Build products_data array EXACTLY like ContractForm (same structure)
          const productsData = await Promise.all(products.map(async (p) => {
            const productNameToSearch = p.product_name || `Produit ${p.product_category || 'Assurance'}`;
            try {
              const result = await resolveOrCreateProduct(productNameToSearch, firstProduct.company, p.product_category);
              return {
                productId: result.productId,  // camelCase like ContractForm
                name: p.product_name || 'Produit',
                category: result.category,  // Use catalog category for proper display (health, life, auto, etc.)
                premium: p.premium_monthly || 0,  // monthly premium like ContractForm
                deductible: p.franchise || null,
                durationYears: null,  // For life insurance compatibility with ContractForm
              };
            } catch (e) {
              console.warn(`Could not resolve product ${productNameToSearch}:`, e);
              return {
                productId: '',
                name: p.product_name || 'Produit',
                category: 'health',  // Default to health on error
                premium: p.premium_monthly || 0,
                deductible: p.franchise || null,
                durationYears: null,
              };
            }
          }));

          // Use the first resolved product's ID as the main policy product_id
          const mainProductId = productsData.find(p => p.productId)?.productId;
          
          if (!mainProductId) {
            console.warn(`[ScanValidation] No valid product ID found for old policy group: ${companyKey}`);
            continue;
          }

          // Calculate totals like ContractForm
          const totalPremiumMonthly = products.reduce((sum, p) => sum + (p.premium_monthly || 0), 0);
          const totalPremiumYearly = products.some(p => p.premium_yearly)
            ? products.reduce((sum, p) => sum + (p.premium_yearly || 0), 0)
            : totalPremiumMonthly * 12;
          
          // Get product names for display
          const productNames = products.map(p => p.product_name).filter(Boolean).join(' + ');
          
          // Determine product_type EXACTLY like ContractForm: 'multi' for multiple, category for single
          // Use the resolved category from catalog, not the raw AI value
          const firstResolvedCategory = productsData.find(p => p.category)?.category || 'health';
          const mainCategory = products.length === 1 
            ? firstResolvedCategory
            : 'multi';

          // Build notes similar to ContractForm format
          const notesParts: string[] = [];
          if (productNames) notesParts.push(productNames);
          if (personLabel) notesParts.push(`Assuré: ${personLabel}`);
          notesParts.push(`Ancienne police importée via IA Scan le ${new Date().toLocaleDateString('fr-CH')}`);
          if (hasTermination) notesParts.push('À RÉSILIER');

          const policyData = {
            tenant_id: tenantId,
            client_id: clientId,
            product_id: mainProductId,
            policy_number: firstProduct.policy_number || null,
            status: hasTermination ? 'cancelled' : 'active',
            start_date: parseDate(firstProduct.start_date) || new Date().toISOString().split('T')[0],
            end_date: parseDate(firstProduct.end_date),
            premium_monthly: totalPremiumMonthly || null,
            premium_yearly: totalPremiumYearly || null,
            deductible: products.find(p => p.franchise != null)?.franchise || null,
            currency: 'CHF',
            company_name: firstProduct.company || null,
            product_type: mainCategory,  // 'multi' for multiple products, like ContractForm
            products_data: productsData,
            notes: notesParts.join(' - '),
          };

          try {
            const oldPolicy = await createPolicyRecord(tenantId, policyData);
            await logAudit(tenantId, 'import', 'policy', oldPolicy.id, {
              policy_type: 'old',
              client_id: clientId,
              company_name: firstProduct.company || null,
              insured_person: personLabel || null,
              product_names: productNames || null,
            });
            createdPolicies.push({ 
              id: oldPolicy.id, 
              type: 'old', 
              productName: productNames || firstProduct.company 
            });
          } catch (policyError) {
            console.error(`[ScanValidation] Failed to create old policy for ${companyKey}:`, policyError);
          }
        }
      } else if (createOldContract && hasOldContractData) {
        // Fallback to old single-product logic if no old_products_detected array
        const companyName = getValue('ancienne_compagnie') || getValue('compagnie');
        const productId = await findProductId(companyName);

        if (productId) {
          const policyData = {
            tenant_id: tenantId,
            client_id: newClient.id,
            product_id: productId,
            policy_number: getValue('ancien_numero_police') || getValue('numero_police') || null,
            status: hasTermination ? 'cancelled' : 'active',
            start_date: parseDate(getValue('ancienne_date_debut') || getValue('date_debut')) || new Date().toISOString().split('T')[0],
            end_date: parseDate(getValue('ancienne_date_fin') || getValue('date_fin')),
            premium_monthly: parseAmount(getValue('ancienne_prime_mensuelle') || getValue('prime_mensuelle')),
            premium_yearly: parseAmount(getValue('ancienne_prime_annuelle') || getValue('prime_annuelle')),
            deductible: parseAmount(getValue('ancienne_franchise') || getValue('franchise')),
            currency: 'CHF',
            company_name: companyName || null,
            product_type: getValue('ancien_type_produit') || getValue('type_produit') || null,
            notes: `Ancienne police importée via IA Scan le ${new Date().toLocaleDateString('fr-CH')}${hasTermination ? ' - À RÉSILIER' : ''}`,
          };

          try {
            const oldPolicy = await createPolicyRecord(tenantId, policyData);
            await logAudit(tenantId, 'import', 'policy', oldPolicy.id, {
              policy_type: 'old',
              client_id: newClient.id,
              company_name: companyName || null,
            });
            createdPolicies.push({ id: oldPolicy.id, type: 'old' });
          } catch (policyError) {
            console.error('[ScanValidation] Failed to create old fallback policy:', policyError);
          }
        }
      }

      // 3. CREATE NEW POLICIES - Group by insured person and company for multi-product contracts
      if (createNewContract && scan.new_products_detected && scan.new_products_detected.length > 0) {
        const groupedNewProducts = groupProductsByCompanyAndInsured(scan.new_products_detected);
        
        for (const [companyKey, group] of groupedNewProducts) {
          const { clientId, personLabel, products } = group;
          const firstProduct = products[0];
          
          // Build products_data array EXACTLY like ContractForm (same structure)
          const productsDataNew = await Promise.all(products.map(async (p) => {
            const productNameToSearch = p.product_name || `Produit ${p.product_category || 'Assurance'}`;
            try {
              const result = await resolveOrCreateProduct(productNameToSearch, firstProduct.company, p.product_category);
              return {
                productId: result.productId,  // camelCase like ContractForm
                name: p.product_name || 'Produit',
                category: result.category,  // Use catalog category for proper display (health, life, auto, etc.)
                premium: p.premium_monthly || 0,  // monthly premium like ContractForm
                deductible: p.franchise || null,
                durationYears: null,  // For life insurance compatibility with ContractForm
              };
            } catch (e) {
              console.warn(`Could not resolve product ${productNameToSearch}:`, e);
              return {
                productId: '',
                name: p.product_name || 'Produit',
                category: 'health',  // Default to health on error
                premium: p.premium_monthly || 0,
                deductible: p.franchise || null,
                durationYears: null,
              };
            }
          }));

          // Use the first resolved product's ID as the main policy product_id
          const mainProductId = productsDataNew.find(p => p.productId)?.productId;
          
          if (!mainProductId) {
            console.warn(`[ScanValidation] No valid product ID found for new policy group: ${companyKey}`);
            continue;
          }

          // Calculate totals like ContractForm
          const totalPremiumMonthly = products.reduce((sum, p) => sum + (p.premium_monthly || 0), 0);
          const totalPremiumYearly = products.some(p => p.premium_yearly)
            ? products.reduce((sum, p) => sum + (p.premium_yearly || 0), 0)
            : totalPremiumMonthly * 12;
          
          // Get product names for display
          const productNames = products.map(p => p.product_name).filter(Boolean).join(' + ');
          
          // Determine product_type EXACTLY like ContractForm: 'multi' for multiple, category for single
          // Use the resolved category from catalog, not the raw AI value
          const firstResolvedCategoryNew = productsDataNew.find(p => p.category)?.category || 'health';
          const mainCategory = products.length === 1 
            ? firstResolvedCategoryNew
            : 'multi';

          // Build notes similar to ContractForm format
          const notesParts: string[] = [];
          if (productNames) notesParts.push(productNames);
          if (personLabel) notesParts.push(`Assuré: ${personLabel}`);
          notesParts.push(`Nouvelle police importée via IA Scan le ${new Date().toLocaleDateString('fr-CH')}`);

          const policyData = {
            tenant_id: tenantId,
            client_id: clientId,
            product_id: mainProductId,
            policy_number: firstProduct.policy_number || null,
            status: 'active',
            start_date: parseDate(firstProduct.start_date) || new Date().toISOString().split('T')[0],
            end_date: parseDate(firstProduct.end_date),
            premium_monthly: totalPremiumMonthly || null,
            premium_yearly: totalPremiumYearly || null,
            deductible: products.find(p => p.franchise != null)?.franchise || null,
            currency: 'CHF',
            company_name: firstProduct.company || null,
            product_type: mainCategory,  // 'multi' for multiple products, like ContractForm
            products_data: productsDataNew,
            notes: notesParts.join(' - '),
          };

          try {
            const createdPolicy = await createPolicyRecord(tenantId, policyData);
            await logAudit(tenantId, 'import', 'policy', createdPolicy.id, {
              policy_type: 'new',
              client_id: clientId,
              company_name: firstProduct.company || null,
              insured_person: personLabel || null,
              product_names: productNames || null,
            });
            createdPolicies.push({ 
              id: createdPolicy.id, 
              type: 'new', 
              productName: productNames || firstProduct.company 
            });
          } catch (policyError) {
            console.error(`[ScanValidation] Failed to create new policy for ${companyKey}:`, policyError);
          }
        }
      } else if (createNewContract && hasNewContractData) {
        // Fallback to old single-product logic if no new_products_detected array
        const companyName = getValue('nouvelle_compagnie');
        const productId = await findProductId(companyName);

        if (productId) {
          const policyData = {
            tenant_id: tenantId,
            client_id: newClient.id,
            product_id: productId,
            policy_number: getValue('nouveau_numero_police') || null,
            status: 'active',
            start_date: parseDate(getValue('nouvelle_date_debut')) || new Date().toISOString().split('T')[0],
            end_date: parseDate(getValue('nouvelle_date_fin')),
            premium_monthly: parseAmount(getValue('nouvelle_prime_mensuelle')),
            premium_yearly: parseAmount(getValue('nouvelle_prime_annuelle')),
            deductible: parseAmount(getValue('nouvelle_franchise')),
            currency: 'CHF',
            company_name: companyName || null,
            product_type: getValue('nouveau_type_produit') || null,
            notes: `Nouvelle police importée via IA Scan le ${new Date().toLocaleDateString('fr-CH')}`,
          };

          try {
            const newPolicy = await createPolicyRecord(tenantId, policyData);
            await logAudit(tenantId, 'import', 'policy', newPolicy.id, {
              policy_type: 'new',
              client_id: newClient.id,
              company_name: companyName || null,
            });
            createdPolicies.push({ id: newPolicy.id, type: 'new' });
          } catch (policyError) {
            console.error('[ScanValidation] Failed to create new fallback policy:', policyError);
          }
        }
      }

      // 4. Create standard contract if no old/new specific data but has contract data
      if (!hasOldContractData && !hasNewContractData && hasContractData && createNewContract) {
        const companyName = getValue('compagnie');
        const productId = await findProductId(companyName);

        if (productId) {
          const policyData = {
            tenant_id: tenantId,
            client_id: newClient.id,
            product_id: productId,
            policy_number: getValue('numero_police') || null,
            status: getValue('statut_contrat') || 'active',
            start_date: parseDate(getValue('date_debut')) || new Date().toISOString().split('T')[0],
            end_date: parseDate(getValue('date_fin')),
            premium_monthly: parseAmount(getValue('prime_mensuelle')),
            premium_yearly: parseAmount(getValue('prime_annuelle')),
            deductible: parseAmount(getValue('franchise')),
            currency: 'CHF',
            company_name: companyName || null,
            product_type: getValue('type_produit') || null,
            notes: `Contrat importé via IA Scan le ${new Date().toLocaleDateString('fr-CH')}`,
          };

          try {
            const newPolicy = await createPolicyRecord(tenantId, policyData);
            await logAudit(tenantId, 'import', 'policy', newPolicy.id, {
              policy_type: 'standard',
              client_id: newClient.id,
              company_name: companyName || null,
            });
            createdPolicies.push({ id: newPolicy.id, type: 'standard' });
          } catch (policyError) {
            console.error('[ScanValidation] Failed to create standard policy:', policyError);
          }
        }
      }

      // 5. Link ALL scanned documents to client (including individual files from batch)
      const createdDocuments: string[] = [];
      if (linkDocuments) {
        // Mapping for smart document naming based on doc_type
        const docNameMapping: Record<string, string> = {
          'police_active': 'Police active',
          'ancienne_police': 'Ancienne police',
          'nouvelle_police': 'Nouveau contrat',
          'resiliation': 'Lettre de résiliation',
          'piece_identite': 'Pièce d\'identité',
          'attestation': 'Attestation',
          'offre': 'Proposition',
          'article_45': 'Art. 45 - Libre passage',
          'autre': 'Document',
        };

        // If we have documents_detected from AI, import each one with smart naming
        if (scan.documents_detected && scan.documents_detected.length > 0) {
          const docTypeCounts: Record<string, number> = {};
          
          for (const doc of scan.documents_detected) {
            const docType = doc.doc_type || 'autre';
            const count = docTypeCounts[docType] || 0;
            docTypeCounts[docType] = count + 1;
            
            // Smart naming: "Police active.pdf" or "Police active (2).pdf" for duplicates
            const baseName = docNameMapping[docType] || 'Document';
            const ext = doc.file_name?.split('.').pop()?.toLowerCase() || 'pdf';
            const smartName = count > 0 ? `${baseName} (${count + 1}).${ext}` : `${baseName}.${ext}`;

            // CRITICAL FIX: Use individual file_key from document if available, 
            // otherwise fall back to scan.original_file_key
            const documentFileKey = doc.file_key || scan.original_file_key;
            const sizeBytes = await getStoredFileSize(documentFileKey);

            const documentData = {
              tenant_id: tenantId,
              owner_type: 'client',
              owner_id: newClient.id,
              file_name: smartName,
              file_key: documentFileKey,  // Use the correct individual file key
              mime_type: doc.file_key ? (doc.file_name?.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream') : 'application/pdf',
              size_bytes: sizeBytes,
              doc_kind: docType,
              created_by: user.id,
              category: docType,
              metadata: {
                source: 'ia_scan',
                scan_id: scan.id,
                original_name: doc.file_name,
                description: doc.description,
                doc_type_confidence: doc.doc_type_confidence,
                original_file_key: doc.file_key,  // Store original key for reference
              },
            };

            const { data: insertedDoc } = await supabase.from('documents').insert([documentData]).select('id').single();
            if (insertedDoc?.id) {
              await logAudit(tenantId, 'import', 'document', insertedDoc.id, {
                client_id: newClient.id,
                doc_kind: docType,
                file_name: smartName,
              });
              createdDocuments.push(insertedDoc.id);
            }
          }
        } else if (scan.original_file_key) {
          // Fallback: single document import (legacy behavior)
          const sizeBytes = await getStoredFileSize(scan.original_file_key);
          const documentData = {
            tenant_id: tenantId,
            owner_type: 'client',
            owner_id: newClient.id,
            file_name: scan.original_file_name,
            file_key: scan.original_file_key,
            mime_type: 'application/pdf',
            size_bytes: sizeBytes,
            doc_kind: scan.detected_doc_type || 'police',
            created_by: user.id,
            category: 'Dossier IA Scan',
            metadata: {
              source: 'ia_scan',
              scan_id: scan.id,
              detected_type: scan.detected_doc_type,
              confidence: scan.overall_confidence,
            },
          };

          const { data: insertedDoc } = await supabase.from('documents').insert([documentData]).select('id').single();
          if (insertedDoc?.id) {
            await logAudit(tenantId, 'import', 'document', insertedDoc.id, {
              client_id: newClient.id,
              doc_kind: scan.detected_doc_type || 'police',
              file_name: scan.original_file_name,
            });
            createdDocuments.push(insertedDoc.id);
          }
        }
      }

      // 6. Create workflow-based follow-ups (suivis)
      if (createSuivis) {
        // Process workflow actions from AI analysis
        if (scan.workflow_actions && scan.workflow_actions.length > 0) {
          for (const action of scan.workflow_actions) {
            let suiviType = 'autre';
            let title = action.description;
            
            switch (action.action_type) {
              case 'create_termination_suivi':
                suiviType = 'resiliation';
                title = `🚨 Résiliation à envoyer: ${action.details?.company || 'Ancienne police'}`;
                break;
              case 'create_activation_suivi':
                suiviType = 'activation';
                title = `✅ Activer nouvelle police: ${action.details?.company || 'Nouvelle police'}`;
                break;
              case 'create_replacement_suivi':
                suiviType = 'changement';
                title = `🔄 Remplacement de police: ${action.details?.old_company} → ${action.details?.new_company}`;
                break;
              case 'request_documents':
                suiviType = 'documents';
                title = `📁 Documents manquants à demander`;
                break;
            }

            const { data: suiviData } = await supabase.from('suivis').insert([{
              tenant_id: tenantId,
              client_id: newClient.id,
              title,
              description: action.description + (action.details ? `\n\nDétails: ${JSON.stringify(action.details, null, 2)}` : ''),
              type: suiviType,
              status: 'ouvert',
              reminder_date: action.deadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            }]).select('id').single();
            
            if (suiviData?.id) {
              await logAudit(tenantId, 'import', 'suivi', suiviData.id, {
                client_id: newClient.id,
                title,
                workflow_action: action.action_type,
              });
              createdSuivis.push(suiviData.id);
            }
          }
        }

        // If termination detected but no specific workflow action, create one
        if (hasTermination && (!scan.workflow_actions || !scan.workflow_actions.some(a => a.action_type === 'create_termination_suivi'))) {
          const terminationDeadline = scan.engagement_analysis?.termination_deadline;
          const { data: termSuivi } = await supabase.from('suivis').insert([{
            tenant_id: tenantId,
            client_id: newClient.id,
            title: `🚨 Résiliation détectée - ${getValue('compagnie_resiliee') || getValue('ancienne_compagnie') || 'Compagnie'}`,
            description: `Lettre de résiliation détectée dans le dossier.\n\nDate résiliation: ${getValue('date_resiliation') || 'Non spécifiée'}\nMotif: ${getValue('motif_resiliation') || 'Non spécifié'}`,
            type: 'resiliation',
            status: 'ouvert',
            reminder_date: terminationDeadline || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          }]).select('id').single();
          
          if (termSuivi?.id) {
            await logAudit(tenantId, 'import', 'suivi', termSuivi.id, {
              client_id: newClient.id,
              title: 'termination_followup',
            });
            createdSuivis.push(termSuivi.id);
          }
        }

        // Create general follow-up for new client if no other suivis created
        if (createdSuivis.length === 0) {
          const { data: generalSuivi } = await supabase.from('suivis').insert([{
            tenant_id: tenantId,
            client_id: newClient.id,
            title: `📋 Nouveau client - ${getValue('prenom')} ${getValue('nom')}`,
            description: `Client créé via IA Scan.\n\n${scan.dossier_summary || 'Vérifier les informations du dossier.'}`,
            type: 'activation',
            status: 'ouvert',
            reminder_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          }]).select('id').single();
          
          if (generalSuivi?.id) {
            await logAudit(tenantId, 'import', 'suivi', generalSuivi.id, {
              client_id: newClient.id,
              title: 'general_followup',
            });
            createdSuivis.push(generalSuivi.id);
          }
        }
      }

      // 7. Mark scan as validated
      const { error: scanError } = await supabase
        .from('document_scans')
        .update({
          validated_at: new Date().toISOString(),
          validated_by: user.id,
          status: 'validated',
        })
        .eq('id', scan.id);

      if (scanError) throw scanError;

      // 8. Update scan results with validated values
      for (const [fieldName, value] of Object.entries(editedValues)) {
        if (value !== undefined) {
          await supabase
            .from('document_scan_results')
            .update({ validated_value: value })
            .eq('scan_id', scan.id)
            .eq('field_name', fieldName);
        }
      }

      // 9. Create audit log (non-blocking - don't fail validation if this fails)
      try {
        await supabase.from('document_scan_audit').insert({
          scan_id: scan.id,
          action: 'validated',
          performed_by: user.id,
          ai_response_snapshot: {
            validated_values: editedValues,
            client_id: newClient.id,
            policies: createdPolicies,
            family_members: createdFamilyMembers,
            suivis: createdSuivis,
            options: {
              createOldContract,
              createNewContract,
              createSuivis,
              linkDocuments,
              createFamilyMembers,
            },
          },
        });
      } catch (auditError) {
        console.warn('Audit log creation failed (non-critical):', auditError);
      }

      // Build success message - count contracts (grouped by company), not individual products
      const oldContractsCount = createdPolicies.filter(p => p.type === 'old').length;
      const newContractsCount = createdPolicies.filter(p => p.type === 'new' || p.type === 'standard').length;
      const totalProductsInContracts = (scan.old_products_detected?.length || 0) + (scan.new_products_detected?.length || 0);
      
      const createdItems = ['Client'];
      if (oldContractsCount > 0) {
        createdItems.push(`${oldContractsCount} Ancienne(s) police(s)`);
      }
      if (newContractsCount > 0) {
        createdItems.push(`${newContractsCount} Nouvelle(s) police(s)`);
      }
      if (totalProductsInContracts > createdPolicies.length) {
        createdItems.push(`(${totalProductsInContracts} produits au total)`);
      }
      if (createdFamilyMembers.length > 0) createdItems.push(`${createdFamilyMembers.length} Membre(s) famille`);
      if (createdDocuments.length > 0) createdItems.push(`${createdDocuments.length} Document(s)`);
      if (createdSuivis.length > 0) createdItems.push(`${createdSuivis.length} Suivi(s)`);

      const clientName = getClientValue('prenom', 'first_name') || '';
      const clientLastName = getClientValue('nom', 'last_name') || '';

      console.log('[ScanValidation] Validation complete!', { clientId: newClient.id, createdItems });

      // Store the client ID before any state changes
      const createdClientId = newClient.id;

      toast({
        title: "Validation réussie ! 🎉",
        description: `${createdItems.join(', ')} créé(s) pour ${clientName} ${clientLastName}`,
      });

      // IMPORTANT: Navigate FIRST before closing dialog and refreshing
      // This prevents race conditions where the component is unmounted mid-navigation
      setIsSubmitting(false);
      
      // Navigate to the client page
      navigate(`/crm/clients/${createdClientId}`);
      
      // Then close the dialog and refresh (these happen after navigation starts)
      onOpenChange(false);
      onValidated();

    } catch (error: unknown) {
      console.error('[ScanValidation] Validation error:', error);
      setIsSubmitting(false);

      const typedError = toSupabaseError(error);

      // Non-blocking audit: capture failure details for debugging
      try {
        await supabase.from('document_scan_audit').insert({
          scan_id: scan.id,
          action: 'validation_failed',
          performed_by: user?.id ?? null,
          ai_response_snapshot: {
            at: new Date().toISOString(),
            code: typedError.code,
            status: typedError.status,
            message: typedError.message,
            hint: typedError.hint,
            details: typedError.details,
          },
        });
      } catch (e) {
        console.warn('[ScanValidation] audit(validation_failed) failed (non-critical):', e);
      }

      // Check for RLS policy errors
      if (typedError.message?.includes('row-level security policy') || typedError.code === '42501') {
        toast({
          title: "Erreur de permissions",
          description: "Vous n'avez pas les permissions pour créer un client. Contactez votre administrateur.",
          variant: "destructive",
        });
        return;
      }

      // Check if it's an auth/session error
      const status = typedError.status;
      const message = typedError.message;

      const isAuthError =
        typedError.code === 'PGRST301' ||
        status === 401 ||
        (typeof message === 'string' &&
          /jwt|invalid.*jwt|token.*expired|refresh_token|authorization header|expired token/i.test(message));

      if (isAuthError) {
        toast({
          title: "Session expirée",
          description: "Votre session a expiré. Veuillez vous reconnecter.",
          variant: "destructive",
        });
        navigate('/connexion');
        return;
      }

      toast({
        title: "Erreur",
        description: typedError.message || "Impossible de créer le client",
        variant: "destructive",
      });
    }
  };

  // Safety wrapper: catches any error thrown *before* handleValidate's inner try/catch
  // (e.g., unexpected runtime errors or rejected promises) to avoid full-page blank screens.
  const safeHandleValidate: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    void handleValidate().catch((err) => {
      console.error('[ScanValidation] Unhandled error in validation click handler:', err);
      setIsSubmitting(false);
      toast({
        title: 'Erreur',
        description: err instanceof Error ? err.message : 'Une erreur inattendue est survenue.',
        variant: 'destructive',
      });
    });
  };

  const overallPercent = Math.round((scan.overall_confidence || 0) * 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[95vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-4 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            Validation du dossier IA Scan
          </DialogTitle>
          <DialogDescription>
            {scan.dossier_summary || 'Vérifiez les données extraites et choisissez ce que vous souhaitez créer'}
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable content area */}
        <ScrollArea className="flex-1 px-6 overflow-y-auto" style={{ maxHeight: 'calc(95vh - 180px)' }}>
          <div className="space-y-4 pb-4">
            {/* Documents detected */}
            {scan.documents_detected && scan.documents_detected.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {scan.documents_detected.map((doc, i) => {
                  const docConfig = DOC_TYPE_LABELS[doc.doc_type] || DOC_TYPE_LABELS.autre;
                  const DocIcon = docConfig.icon;
                  return (
                    <Badge key={i} variant="outline" className={cn("text-xs", docConfig.color)}>
                      <DocIcon className="h-3 w-3 mr-1" />
                      {doc.description || docConfig.label}
                    </Badge>
                  );
                })}
              </div>
            )}

            {/* Alerts for termination or engagement issues */}
            {(hasTermination || (scan.engagement_analysis?.warnings && scan.engagement_analysis.warnings.length > 0)) && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertOctagon className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800 dark:text-red-200">
                      {hasTermination ? '⚠️ Résiliation détectée' : '⚠️ Attention aux dates'}
                    </p>
                    {scan.engagement_analysis?.warnings?.map((warning, i) => (
                      <p key={i} className="text-sm text-red-700 dark:text-red-300 mt-1">
                        • {warning}
                      </p>
                    ))}
                    {scan.engagement_analysis?.termination_deadline && (
                      <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                        📅 Deadline résiliation: <strong>{scan.engagement_analysis.termination_deadline}</strong>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Inconsistencies */}
            {scan.inconsistencies && scan.inconsistencies.length > 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
                  ⚠️ Incohérences détectées
                </p>
                {scan.inconsistencies.map((inc, i) => (
                  <p key={i} className="text-sm text-amber-700 dark:text-amber-300">• {inc}</p>
                ))}
              </div>
            )}

            {/* Confidence meter */}
            <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Confiance globale</span>
                  <span className="font-medium">{overallPercent}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${overallPercent}%`,
                      backgroundColor: overallPercent >= 70 ? '#10b981' : overallPercent >= 40 ? '#f59e0b' : '#ef4444',
                    }}
                  />
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                {scan.fields.length} champs
              </div>
            </div>

            {/* Creation options */}
            <div className="p-4 bg-gradient-to-r from-primary/5 to-violet-500/5 rounded-lg border border-primary/10">
              <p className="text-sm font-medium mb-3 flex items-center gap-2">
                <FolderPlus className="h-4 w-4 text-primary" />
                Éléments à créer
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center gap-2 p-2 rounded-md bg-background/50 cursor-pointer hover:bg-background transition-colors">
                  <Checkbox checked disabled className="data-[state=checked]:bg-blue-500" />
                  <User className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">Client</span>
                  <Badge variant="outline" className="ml-auto text-xs">Requis</Badge>
                </label>
                
                {hasOldContractData && (
                  <label className="flex items-center gap-2 p-2 rounded-md bg-background/50 cursor-pointer hover:bg-background transition-colors">
                    <Checkbox 
                      checked={createOldContract} 
                      onCheckedChange={(checked) => setCreateOldContract(checked as boolean)}
                      className="data-[state=checked]:bg-orange-500"
                    />
                    <FileWarning className="h-4 w-4 text-orange-500" />
                    <span className="text-sm">
                      Ancienne(s) police(s)
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({oldCompaniesCount || 1} contrat{oldCompaniesCount > 1 ? 's' : ''}{oldProductsCount > oldCompaniesCount ? `, ${oldProductsCount} produits` : ''})
                      </span>
                    </span>
                  </label>
                )}
                
                {(hasNewContractData || hasContractData) && (
                  <label className="flex items-center gap-2 p-2 rounded-md bg-background/50 cursor-pointer hover:bg-background transition-colors">
                    <Checkbox 
                      checked={createNewContract} 
                      onCheckedChange={(checked) => setCreateNewContract(checked as boolean)}
                      className="data-[state=checked]:bg-emerald-500"
                    />
                    <FileCheck className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm">
                      {hasNewContractData ? 'Nouvelle(s) police(s)' : 'Contrat'}
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({newCompaniesCount || 1} contrat{newCompaniesCount > 1 ? 's' : ''}{newProductsCount > newCompaniesCount ? `, ${newProductsCount} produits` : ''})
                      </span>
                    </span>
                  </label>
                )}

                {hasFamilyMembers && (
                  <label className="flex items-center gap-2 p-2 rounded-md bg-background/50 cursor-pointer hover:bg-background transition-colors">
                    <Checkbox 
                      checked={createFamilyMembers} 
                      onCheckedChange={(checked) => setCreateFamilyMembers(checked as boolean)}
                      className="data-[state=checked]:bg-violet-500"
                    />
                    <Users className="h-4 w-4 text-violet-500" />
                    <span className="text-sm">
                      Membres famille
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({scan.family_members_detected?.length || 0})
                      </span>
                    </span>
                  </label>
                )}
                
                <label className="flex items-center gap-2 p-2 rounded-md bg-background/50 cursor-pointer hover:bg-background transition-colors">
                  <Checkbox 
                    checked={linkDocuments} 
                    onCheckedChange={(checked) => setLinkDocuments(checked as boolean)}
                    className="data-[state=checked]:bg-indigo-500"
                  />
                  <FileText className="h-4 w-4 text-indigo-500" />
                  <span className="text-sm">Lier documents</span>
                </label>
                
                <label className="flex items-center gap-2 p-2 rounded-md bg-background/50 cursor-pointer hover:bg-background transition-colors">
                  <Checkbox 
                    checked={createSuivis} 
                    onCheckedChange={(checked) => setCreateSuivis(checked as boolean)}
                    className="data-[state=checked]:bg-amber-500"
                  />
                  <CalendarCheck className="h-4 w-4 text-amber-500" />
                  <span className="text-sm">
                    Créer suivis
                    {scan.workflow_actions && scan.workflow_actions.length > 0 && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({scan.workflow_actions.length} action{scan.workflow_actions.length > 1 ? 's' : ''})
                      </span>
                    )}
                  </span>
                </label>
              </div>
            </div>

            {/* Multi-products preview - Grouped by company */}
            {(hasMultipleProducts || newProductsCount > 0 || oldProductsCount > 0) && (
              <div className="p-3 bg-muted/30 rounded-lg border">
                <p className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Produits détectés ({newProductsCount + oldProductsCount})
                  {(newProductsCount > 1 || oldProductsCount > 1) && (
                    <Badge variant="outline" className="text-xs bg-primary/10 text-primary">
                      Multi-produits par compagnie
                    </Badge>
                  )}
                </p>
                
                {/* Old products grouped by company */}
                {scan.old_products_detected && scan.old_products_detected.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-orange-600 dark:text-orange-400 mb-2 flex items-center gap-1">
                      <FileWarning className="h-3 w-3" />
                      Anciennes polices
                    </p>
                    {(() => {
                      // Group old products by company
                      const grouped = scan.old_products_detected.reduce((acc, p) => {
                        const key = p.company || 'Inconnue';
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(p);
                        return acc;
                      }, {} as Record<string, ProductDetected[]>);
                      
                      return Object.entries(grouped).map(([company, products], ci) => (
                        <div key={`old-company-${ci}`} className="mb-2 p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-sm">{company}</span>
                            <Badge variant="outline" className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-xs">
                              {products.length} produit{products.length > 1 ? 's' : ''}
                            </Badge>
                          </div>
                          <div className="space-y-1.5">
                            {products.map((product, pi) => (
                              <div key={`old-${ci}-${pi}`} className="flex items-center justify-between text-xs bg-background/50 rounded p-1.5 gap-2">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span className="font-medium truncate">{product.product_name}</span>
                                  <ProductBranchEditor
                                    branchId={product.resolved_branch_id}
                                    branchCode={product.resolved_branch_code || product.branch_code}
                                    onChange={(branchId, branchCode) => {
                                      // Mutate the scan-local product so the branch is used at submit time.
                                      product.resolved_branch_id = branchId;
                                      product.resolved_branch_code = branchCode;
                                    }}
                                    lowConfidence={!product.resolved_branch_id && !product.branch_code}
                                  />
                                </div>
                                <div className="flex items-center gap-3 text-muted-foreground flex-shrink-0">
                                  {product.premium_monthly && (
                                    <span className="text-orange-600 dark:text-orange-400 font-medium">
                                      CHF {product.premium_monthly.toFixed(2)}/mois
                                    </span>
                                  )}
                                  {product.franchise && (
                                    <span>Franchise: CHF {product.franchise}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                          {/* Total for this company */}
                          <div className="mt-2 pt-2 border-t border-orange-200 dark:border-orange-700 flex justify-between text-xs">
                            <span className="text-muted-foreground">Total mensuel</span>
                            <span className="font-bold text-orange-700 dark:text-orange-300">
                              CHF {products.reduce((sum, p) => sum + (p.premium_monthly || 0), 0).toFixed(2)}/mois
                            </span>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                )}

                {/* New products grouped by company */}
                {scan.new_products_detected && scan.new_products_detected.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1">
                      <FileCheck className="h-3 w-3" />
                      Nouvelles polices
                    </p>
                    {(() => {
                      // Group new products by company
                      const grouped = scan.new_products_detected.reduce((acc, p) => {
                        const key = p.company || 'Inconnue';
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(p);
                        return acc;
                      }, {} as Record<string, ProductDetected[]>);
                      
                      return Object.entries(grouped).map(([company, products], ci) => (
                        <div key={`new-company-${ci}`} className="mb-2 p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-sm">{company}</span>
                            <Badge variant="outline" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs">
                              {products.length} produit{products.length > 1 ? 's' : ''}
                            </Badge>
                          </div>
                          <div className="space-y-1.5">
                            {products.map((product, pi) => (
                              <div key={`new-${ci}-${pi}`} className="flex items-center justify-between text-xs bg-background/50 rounded p-1.5 gap-2">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span className="font-medium truncate">{product.product_name}</span>
                                  <ProductBranchEditor
                                    branchId={product.resolved_branch_id}
                                    branchCode={product.resolved_branch_code || product.branch_code}
                                    onChange={(branchId, branchCode) => {
                                      product.resolved_branch_id = branchId;
                                      product.resolved_branch_code = branchCode;
                                    }}
                                    lowConfidence={!product.resolved_branch_id && !product.branch_code}
                                  />
                                </div>
                                <div className="flex items-center gap-3 text-muted-foreground flex-shrink-0">
                                  {product.premium_monthly && (
                                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                      CHF {product.premium_monthly.toFixed(2)}/mois
                                    </span>
                                  )}
                                  {product.franchise && (
                                    <span>Franchise: CHF {product.franchise}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                          {/* Total for this company */}
                          <div className="mt-2 pt-2 border-t border-emerald-200 dark:border-emerald-700 flex justify-between text-xs">
                            <span className="text-muted-foreground">Total mensuel</span>
                            <span className="font-bold text-emerald-700 dark:text-emerald-300">
                              CHF {products.reduce((sum, p) => sum + (p.premium_monthly || 0), 0).toFixed(2)}/mois
                            </span>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* Family members preview */}
            {hasFamilyMembers && createFamilyMembers && (
              <div className="p-3 bg-muted/30 rounded-lg border">
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Membres de famille à créer ({scan.family_members_detected?.length || 0})
                </p>
                <div className="space-y-2">
                  {scan.family_members_detected?.map((member, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm p-2 bg-violet-50 dark:bg-violet-900/20 rounded">
                      <Badge variant="outline" className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 text-xs capitalize">
                        {member.relationship || 'Famille'}
                      </Badge>
                      <span className="font-medium">{member.first_name} {member.last_name}</span>
                      {member.birthdate && (
                        <span className="text-muted-foreground text-xs">({member.birthdate})</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Workflow actions preview */}
            {scan.workflow_actions && scan.workflow_actions.length > 0 && createSuivis && (
              <div className="p-3 bg-muted/30 rounded-lg border">
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Actions back-office à créer
                </p>
                <div className="space-y-2">
                  {scan.workflow_actions.map((action, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <Badge variant={action.priority === 'high' ? 'destructive' : 'secondary'} className="text-xs">
                        {action.priority === 'high' ? 'Urgent' : 'Normal'}
                      </Badge>
                      <span className="flex-1">{action.description}</span>
                      {action.deadline && (
                        <span className="text-xs text-muted-foreground">
                          📅 {action.deadline}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fields by category */}
            <div className="space-y-6">
              {Object.entries(fieldsByCategory).map(([category, fields]) => {
                const categoryConfig = CATEGORY_CONFIG[category] || {
                  label: category,
                  icon: FileText,
                  color: 'text-gray-500',
                };
                const CategoryIcon = categoryConfig.icon;

                return (
                  <div key={category}>
                    <div className="flex items-center gap-2 mb-3">
                      <CategoryIcon className={cn("h-4 w-4", categoryConfig.color)} />
                      <span className="font-medium text-sm">{categoryConfig.label}</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {fields.map(field => (
                        <div
                          key={field.id}
                          className={cn(
                            "p-3 rounded-lg border transition-all",
                            field.confidence === 'low'
                              ? 'border-destructive/50 bg-destructive/5'
                              : field.confidence === 'medium'
                              ? 'border-amber-500/50 bg-amber-500/5'
                              : 'border-border bg-muted/30'
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <Label className="text-sm font-medium flex items-center gap-1.5">
                              {getConfidenceIcon(field.confidence)}
                              {FIELD_LABELS[field.field_name] || field.field_name}
                            </Label>
                            {getConfidenceBadge(field.confidence)}
                          </div>

                          {editingField === field.field_name ? (
                            <div className="flex gap-2">
                              <Input
                                value={getValue(field.field_name)}
                                onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
                                className="h-9"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingField(null)}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div
                              className="flex items-center justify-between group cursor-pointer p-2 rounded hover:bg-muted/50"
                              onClick={() => setEditingField(field.field_name)}
                            >
                              <span className={cn(
                                "text-sm",
                                !getValue(field.field_name) && 'text-muted-foreground italic'
                              )}>
                                {getValue(field.field_name)
                                  ? (field.field_name === 'numero_avs' ? maskAvs(getValue(field.field_name)) : getValue(field.field_name))
                                  : 'Non détecté'}
                              </span>
                              <Edit2 className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          )}

                          {field.extraction_notes && (
                            <p className="text-xs text-muted-foreground mt-1 italic">
                              💡 {field.extraction_notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                    <Separator className="mt-4" />
                  </div>
                );
              })}
            </div>

            {/* Missing documents */}
            {scan.missing_documents && scan.missing_documents.length > 0 && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                  📁 Documents à demander
                </p>
                {scan.missing_documents.map((doc, i) => (
                  <p key={i} className="text-sm text-blue-700 dark:text-blue-300">• {doc}</p>
                ))}
              </div>
            )}

            {/* Disclaimer */}
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                ⚠️ Les données ont été proposées par une IA. Vérifiez avant validation.
              </p>
            </div>
          </div>
        </ScrollArea>

        {/* Fixed action buttons at the bottom */}
        <div className="flex flex-col gap-2 p-6 pt-4 border-t bg-background flex-shrink-0">
          {/* F5 Beta: unified form path */}
          <Button
            type="button"
            onClick={openBetaWizard}
            disabled={isSubmitting || betaResolvingClient || tenantLoading || !user || !scan}
            variant="outline"
            className="w-full border-primary/30 bg-primary/5 hover:bg-primary/10"
          >
            {betaResolvingClient ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2 text-primary" />
            )}
            Créer via formulaire pré-rempli (recommandé)
          </Button>
          <div className="flex gap-3">
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={safeHandleValidate}
              disabled={isSubmitting || tenantLoading || !user}
              variant="ghost"
              className="flex-1 text-muted-foreground"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Valider en bloc (ancien)
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* F5 wizard: opens the same ContractForm as manual creation, pre-filled.
          onMaterialise = lazy DB inserts at first 'Démarrer' click. */}
      {scan && (
        <IAScanContractsWizard
          open={betaWizardOpen}
          onOpenChange={(open) => {
            setBetaWizardOpen(open);
            // If broker closes without materialising, clear the pending state
            // so a re-open re-resolves cleanly.
            if (!open) setPendingCreates(null);
          }}
          scan={scan}
          clientId={betaWizardClientId}
          familyClientMap={betaFamilyClientMap}
          products={scan.new_products_detected || []}
          hasResiliation={!!(scan.has_termination || (scan.fields || []).some(f => f.field_category === 'termination'))}
          onMaterialise={pendingCreates ? materialiseBetaPendingCreates : undefined}
          onAllDone={handleBetaWizardDone}
        />
      )}
    </Dialog>
  );
}
