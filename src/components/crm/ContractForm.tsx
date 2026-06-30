import { useState, useEffect, useMemo } from "react";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { usePolicies } from "@/hooks/usePolicies";
import { useDocuments } from "@/hooks/useDocuments";
import { useCelebration } from "@/hooks/useCelebration";
import { detectLifePillarFromName } from "@/lib/lifePillar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useClientMandatStatus } from "@/hooks/useClientMandatStatus";
import { Loader2, FileText, X, Check, Heart, Car, Home, Shield, Scale, AlertTriangle } from "lucide-react";
import DocumentUpload from "./DocumentUpload";
import { BranchSelector, BranchChip } from "./BranchSelector";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

type Company = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  name: string;
  category: string;
  company_id: string;
  tenant_branch_id?: string | null;
  tenant_branch?: {
    id: string;
    code: string;
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
};

type SelectedProduct = {
  id: string;
  productId: string;
  name: string;
  category: string;
  premium: string; // Individual premium for this product
  deductible: string;
  durationYears: string; // For life insurance
  /** Branch code from the catalog (LAMAL / LCA / VIE / …). When set,
   *  it takes precedence over the name-regex isLamalProduct() check. */
  branchCode?: string;
  /** Pour les contrats LPP "compte de libre passage" : pas de prime
   *  récurrente, mais un MONTANT D'AVOIRS retrouvé/transféré (en CHF).
   *  La commission (3% par défaut, configurée dans Partenaires) est
   *  calculée sur ce montant. */
  avoirTotal?: string;
  /** Pour les produits Vie/Prévoyance : type de pilier (3a/3b/classique).
   *  Stocké dans products_data.pillarType au submit (JSONB sur la policy),
   *  pas de migration DB. Distinction fiscale + juridique CH majeure. */
  pillarType?: string | null;
};

type UploadedDoc = { file_key: string; file_name: string; doc_kind: string; mime_type: string; size_bytes: number };

/**
 * Optional prefill payload — used when the dialog is opened from the
 * IA Scan flow. The form fills its fields from the OCR extraction so
 * the broker sees the exact same form as a manual creation, just
 * pre-populated. Everything is fully editable, and the submit path
 * is identical (createPolicy + createDocument) — guaranteeing zero
 * divergence between manual and scan-driven contract creation.
 */
export interface ContractFormPrefill {
  /** Insurance company id (preferred) */
  companyId?: string;
  /** Free-text company name when companyId can't be resolved upstream */
  companyName?: string;
  startDate?: string;
  status?: string;
  notes?: string;
  /** Per-line products extracted from the scan */
  products?: Array<{
    productId?: string;
    productName?: string;
    /** Normalized category (health / life / auto / home / legal / property / other) */
    category?: string;
    premium?: number;
    deductible?: number;
    durationYears?: number;
    /** Hint: this line is a LAMal product (overrides isLamalProduct heuristic) */
    isLamal?: boolean;
    /** Canonical branch code (LAMAL / LCA / VIE / AUTO / …) from the IA or
     *  catalog match. Used by the categorisation in priority over the
     *  legacy 'category' field. */
    branchCode?: string;
  }>;
  /** Global LAMal fields when scan detected a LAMal product */
  lamalPremium?: number;
  lamalFranchise?: number;
  lamalAccidentIncluded?: boolean;
  /** When true, the post-submit hook can fire a "résiliation" suivi for this client */
  hasResiliationToCreate?: boolean;
}

interface ContractFormProps {
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  editMode?: boolean;
  policyId?: string;
  /**
   * When provided, the form is pre-populated from this payload (IA Scan
   * pipeline). Mutually exclusive with editMode; ignored if editMode=true.
   */
  prefill?: ContractFormPrefill;
}

const getCategoryLabels = (t: (key: string) => string): Record<string, string> => ({
  health: t("forms.contract.categories.health"),
  auto: t("forms.contract.categories.auto"),
  home: t("forms.contract.categories.home"),
  life: t("forms.contract.categories.life"),
  legal: t("forms.contract.categories.legal"),
  property: t("forms.contract.categories.property"),
  other: t("forms.contract.categories.other"),
  // Map legacy enum values to user-facing labels so 'multirisque',
  // 'rcpro' and 'third_pillar' never appear raw in the UI.
  multirisque: t("forms.contract.categories.other"),
  rcpro: t("forms.contract.categories.other"),
  third_pillar: t("forms.contract.categories.life"),
  // Bucket virtuel LPP (libre passage / rapatriement avoirs)
  lpp: "Compte de Libre passage",
});

// Helper to generate unique IDs safely
const generateId = (): string => {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
};

const categoryIcons: Record<string, React.ReactNode> = {
  health: <Heart className="h-4 w-4" />,
  auto: <Car className="h-4 w-4" />,
  home: <Home className="h-4 w-4" />,
  life: <Shield className="h-4 w-4" />,
  legal: <Scale className="h-4 w-4" />,
  property: <Home className="h-4 w-4" />,
  other: <Shield className="h-4 w-4" />,
  lpp: <span className="text-base leading-none">🐷</span>,
};

const categoryColors: Record<string, string> = {
  health: "bg-emerald-50 text-emerald-800 border-emerald-200",
  auto: "bg-orange-50 text-orange-800 border-orange-200",
  home: "bg-blue-50 text-blue-800 border-blue-200",
  life: "bg-violet-50 text-violet-800 border-violet-200",
  legal: "bg-amber-50 text-amber-800 border-amber-200",
  property: "bg-blue-50 text-blue-800 border-blue-200",
  other: "bg-gray-50 text-gray-800 border-gray-200",
  lpp: "bg-amber-50 text-amber-800 border-amber-200",
};

// Helper to detect if a health product is LAMal or LCA based on its name.
// Covers both generic labels ("LAMal", "Assurance de base", "obligatoire")
// AND the actual commercial brand names used by Swiss insurers for their
// LAMal alternative models. Without this list, a product called "Swica
// Favorit Medpharm" or "Helsana BeneFit PLUS Flexmed" would be misclassified
// as LCA in the ContractForm grouping.
const LAMAL_BRAND_PATTERNS = [
  /\blamal\b/, /\bkvg\b/,
  /\bbase\b/, /\bobligatoire\b/, /\bassurance\s+(de\s+)?base\b/,
  /\bfavorit\b/, /\bmedpharm\b/, /\btelmed\b/, /\bcasamed\b/, /\bpremed\b/,
  /\bqualimed\b/, /\bbenefit\b/, /\bmonaca\b/,
  /\bhmo\b/, /\bbasis\b/, /\bsmartcare\b/, /\btelfirst\b/, /\bcaremed\b/,
  /\bflexcare\b/, /\bmycss\b/, /\bcompact one\b/, /\bcompact\b/, /\bcallmed\b/,
  /\bmultiaccess\b/, /\bcasamed\b/, /\bkptwin\b/,
  /\bmydoc\b/, /\bprimaflex\b/, /\boptimed\b/, /\bsanatel\b/, /\bprimapharma\b/,
  /\bpharmed\b/, /\bpreventomed\b/, /\bqualimed\b/, /\bhausspital\b/, /\bfemina\b/,
  /\bviva\b/, /\bmanaged care\b/, /\bmed direct\b/, /\btel doc\b/, /\btel care\b/,
  /\bmed call\b/,
];

const isLamalProduct = (productName: string | null | undefined): boolean => {
  if (!productName) return false;
  const name = productName.toLowerCase();
  return LAMAL_BRAND_PATTERNS.some((re) => re.test(name));
};

// Helper to normalize category from database (handles legacy IA Scan values like 'LAMal', 'LCA')
const normalizeCategoryFromDB = (rawCategory: string | null | undefined): string => {
  if (!rawCategory) return 'other';
  const lower = rawCategory.toLowerCase().trim();
  
  // Map IA Scan categories (LAMal, LCA, etc.) to display categories
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
  return 'other';
};

export default function ContractForm({ clientId, open, onOpenChange, onSuccess, editMode = false, policyId, prefill }: ContractFormProps) {
  const { t } = useTranslation();
  const { createDocument } = useDocuments();
  const { createPolicy, updatePolicy, policies } = usePolicies();
  const { celebrate } = useCelebration();
  const { toast } = useToast();
  
  const categoryLabels = getCategoryLabels(t);
  
  const [companies, setCompanies] = useState<Company[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [clientExistingPolicies, setClientExistingPolicies] = useState<any[]>([]);
  
  // Common fields
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState("active");
  const [notes, setNotes] = useState("");
  const [documents, setDocuments] = useState<UploadedDoc[]>([]);
  
  // Health insurance specific - Global LAMal fields
  const [lamalPremium, setLamalPremium] = useState("");
  const [lamalFranchise, setLamalFranchise] = useState("");
  // Accident coverage included in LAMal — defaults to TRUE because a
  // freshly insured client without employer coverage MUST include it.
  // Employed clients with >8h/week LAA cover from employer can uncheck.
  // Stored in products_data on each LAMal product so it survives reload.
  const [lamalAccidentIncluded, setLamalAccidentIncluded] = useState(true);
  
  // Selected products
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [productSearch, setProductSearch] = useState("");

  // Habib clarified that a signed Mandat de gestion is NOT a hard
  // requirement before creating a contract — some clients sign later,
  // some files are imported without one. So we just *warn* the broker
  // and show a quick way to launch the mandate flow, without blocking
  // the save.
  const { hasSignedMandat, loading: mandatStatusLoading } =
    useClientMandatStatus(clientId);
  const showNoMandatWarning =
    !editMode && !mandatStatusLoading && hasSignedMandat === false;

  // Helper: a policy is "live" (counts for dedup) unless it's been cancelled
  // or expired. We don't want to block re-insuring a client whose previous
  // health contract with the same company was cancelled.
  const isLivePolicy = (p: { status?: string | null }): boolean => {
    const s = (p.status || '').toLowerCase();
    return s !== 'cancelled' && s !== 'expired';
  };

  // Companies the client already has a live contract with — kept for the
  // informational dimming in the company picker dropdown (it's not the
  // blocking signal anymore).
  const companiesWithExistingContracts = useMemo(() => {
    return clientExistingPolicies
      .filter(p => p.id !== policyId)
      .filter(isLivePolicy)
      .map(p => p.company_name)
      .filter(Boolean);
  }, [clientExistingPolicies, policyId]);

  // Categories where duplicates with the same company are LEGITIMATELY
  // allowed and must never be flagged.
  //
  // 'life' (3e pilier / prévoyance) — Swiss brokerage practice: split the
  //   target premium across two identical contracts with the same company.
  //   If the client can no longer pay, the broker cancels only ONE of the
  //   two, halving the decommission (clawback) instead of losing the full
  //   commission.
  const DUPLICATES_ALLOWED_CATEGORIES = new Set(['life']);

  // Set of "<company-lowercased>|<normalized-category>" keys covering every
  // (company, product category) pair the client already holds a live policy
  // for. Looks into products_data first (multi-product contracts) and falls
  // back to the legacy product_type column. Categories in
  // DUPLICATES_ALLOWED_CATEGORIES are intentionally excluded.
  const existingDuplicateKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const p of clientExistingPolicies) {
      if (editMode && p.id === policyId) continue;
      if (!isLivePolicy(p)) continue;

      const company = (p.company_name || '').trim().toLowerCase();
      if (!company) continue;

      const addIfBlocking = (rawCategory: string | null | undefined) => {
        const cat = normalizeCategoryFromDB(rawCategory);
        if (!cat || cat === 'other') return;
        if (DUPLICATES_ALLOWED_CATEGORIES.has(cat)) return;
        keys.add(`${company}|${cat}`);
      };

      const productsData = p.products_data as Array<{ category?: string | null }> | null;
      if (productsData && productsData.length > 0) {
        for (const prod of productsData) addIfBlocking(prod?.category);
      } else if (p.product_type) {
        addIfBlocking(p.product_type);
      }
    }
    return keys;
  }, [clientExistingPolicies, policyId, editMode]);

  // For the currently-selected company + selected products, list the
  // (category, [productNames]) pairs that would create a duplicate.
  const duplicateProductConflicts = useMemo(() => {
    if (!selectedCompanyId || editMode) return [] as { category: string; productNames: string[] }[];
    const selectedCompany = companies.find(c => c.id === selectedCompanyId);
    if (!selectedCompany) return [];
    const companyKey = selectedCompany.name.trim().toLowerCase();

    const grouped = new Map<string, string[]>();
    for (const p of selectedProducts) {
      const cat = normalizeCategoryFromDB(p.category);
      if (!cat || cat === 'other') continue;
      if (existingDuplicateKeys.has(`${companyKey}|${cat}`)) {
        const list = grouped.get(cat) || [];
        list.push(p.name || cat);
        grouped.set(cat, list);
      }
    }
    return Array.from(grouped.entries()).map(([category, productNames]) => ({
      category,
      productNames,
    }));
  }, [selectedProducts, selectedCompanyId, companies, existingDuplicateKeys, editMode]);

  // Replaces the old hasExistingContractWithCompany — now blocks ONLY when
  // the same client already has a live contract with the same company AND
  // the same product category (e.g. another health policy with Generali).
  // Different categories with the same company are now allowed (e.g. you
  // can have Generali health + Generali life).
  const hasDuplicateContract = duplicateProductConflicts.length > 0;

  useEffect(() => {
    if (open) {
      fetchCompaniesAndProducts();
      fetchClientExistingPolicies();
      if (editMode && policyId) {
        loadExistingPolicy();
      } else if (prefill) {
        // IA-Scan-driven path: same form, same fields, same submit —
        // just pre-populated. We still need company/product catalogs
        // loaded before applying the prefill (resolveCompanyFromName
        // depends on `companies`), so applyPrefill runs in a small
        // chained effect below once those have arrived.
        resetForm();
      } else {
        resetForm();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editMode, policyId]);

  // Listen for catalog changes from Partenaires page (CRMCompagnies dispatches
  // a custom event when a product is created/updated). Re-fetch the products
  // list immédiatement pour refléter les changements sans devoir fermer/rouvrir
  // le ContractForm.
  useEffect(() => {
    if (!open) return;
    const handler = () => {
      fetchCompaniesAndProducts();
    };
    window.addEventListener('lyta:product-catalog-changed', handler);
    return () => window.removeEventListener('lyta:product-catalog-changed', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Apply prefill ONCE the company/product catalogs are loaded so that
  // company resolution from a free-text name + product matching by name
  // can work. This decouples the network round-trip from the prefill
  // state assignment.
  useEffect(() => {
    if (!open) return;
    if (editMode) return;
    if (!prefill) return;
    if (companies.length === 0) return; // catalogs not yet loaded
    applyPrefill(prefill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editMode, prefill, companies.length, allProducts.length]);

  const fetchClientExistingPolicies = async () => {
    // Pull product_type + products_data so we can detect duplicates at the
    // (company, product category) level instead of just (company).
    // Cancelled / expired policies are ignored client-side below.
    const { data } = await supabase
      .from('policies')
      .select('id, company_name, product_type, products_data, status')
      .eq('client_id', clientId);
    setClientExistingPolicies(data || []);
  };

  const loadExistingPolicy = async () => {
    if (!policyId) return;
    
    setLoading(true);
    
    // Fetch the policy directly
    const { data: existingPolicy } = await supabase
      .from('policies')
      .select(`
        *,
        product:insurance_products!policies_product_id_fkey (
          id,
          name,
          category,
          company_id,
          company:insurance_companies!insurance_products_company_id_fkey (
            name,
            logo_url
          )
        )
      `)
      .eq('id', policyId)
      .maybeSingle();
    
    if (existingPolicy) {
      setStartDate(existingPolicy.start_date || new Date().toISOString().split('T')[0]);
      setStatus(existingPolicy.status || 'active');
      setNotes(existingPolicy.notes || '');

      // Set company from product
      if (existingPolicy.product?.company_id) {
        setSelectedCompanyId(existingPolicy.product.company_id);
      }

      // Restore per-contract branch override (if any)
      if ((existingPolicy as any).tenant_branch_id) {
        setSelectedBranchId((existingPolicy as any).tenant_branch_id);
      }
      
      // Check if we have products_data (multi-product contract)
      const productsData = existingPolicy.products_data as Record<string, unknown>[] | null;
      
      if (productsData && productsData.length > 0) {
        // Load products from products_data
        // For products without productId, try to resolve by name
        const loadedProducts: SelectedProduct[] = await Promise.all(productsData.map(async (prod) => {
          // Normalize category to handle legacy IA Scan values (LAMal, LCA -> health)
          const normalizedCategory = normalizeCategoryFromDB(prod.category);
          const isLamal = normalizedCategory === 'health' && isLamalProduct(prod.name);

          // Set LAMal fields if applicable
          if (isLamal && prod.premium) {
            setLamalPremium(String(prod.premium));
            if (prod.deductible) setLamalFranchise(String(prod.deductible));
            // Restore accidentIncluded if saved on this LAMal line.
            // Legacy rows pre-this-feature don't carry the field —
            // default to TRUE in that case (safer for a fresh contract).
            if (prod.accidentIncluded !== undefined && prod.accidentIncluded !== null) {
              setLamalAccidentIncluded(prod.accidentIncluded === true);
            }
          }
          
          // If productId is missing, try to find it by name
          let resolvedProductId = prod.productId || '';
          if (!resolvedProductId && prod.name) {
            const { data: matchedProduct } = await supabase
              .from('insurance_products')
              .select('id')
              .ilike('name', `%${prod.name}%`)
              .limit(1)
              .maybeSingle();
            if (matchedProduct) {
              resolvedProductId = matchedProduct.id;
            }
          }

          // Lookup LIVE de la branche depuis le catalog — sinon le snapshot
          // figé dans products_data ne reflète pas les changements faits dans
          // Partenaires (ex: changement de sous-branche d'un produit Lemania).
          let liveBranchCode: string | undefined = undefined;
          if (resolvedProductId) {
            const { data: liveProduct } = await supabase
              .from('insurance_products')
              .select('tenant_branch:tenant_branches(code)')
              .eq('id', resolvedProductId)
              .maybeSingle();
            const tb = liveProduct?.tenant_branch as any;
            const code = Array.isArray(tb) ? tb[0]?.code : tb?.code;
            if (code) liveBranchCode = code;
          }

          return {
            id: generateId(),
            productId: resolvedProductId,
            name: prod.name || 'Produit',
            category: normalizedCategory,  // Use normalized category for proper display
            premium: String(prod.premium || ''),
            deductible: String(prod.deductible || ''),
            durationYears: String(prod.durationYears || ''),
            // Branche LIVE depuis le catalog (override le snapshot figé du contrat)
            branchCode: liveBranchCode,
            // LPP : restore avoir_total si présent (champ ajouté pour LPP libre passage)
            avoirTotal: prod.avoirTotal != null ? String(prod.avoirTotal) : undefined,
            // Vie : restore pillarType si présent (3a/3b/classique)
            pillarType: typeof prod.pillarType === 'string' ? prod.pillarType : null,
          };
        }));
        
        setSelectedProducts(loadedProducts);
      } else if (existingPolicy.product) {
        // Fallback: single product from product relation
        const category = normalizeCategoryFromDB(existingPolicy.product.category);
        const isLamal = category === 'health' && isLamalProduct(existingPolicy.product.name);
        
        if (isLamal) {
          setLamalPremium(String(existingPolicy.premium_monthly || ''));
          setLamalFranchise(String(existingPolicy.deductible || ''));
        }
        
        setSelectedProducts([{
          id: generateId(),
          productId: existingPolicy.product.id,
          name: existingPolicy.product.name || 'Produit',
          category: category,
          premium: String(existingPolicy.premium_monthly || ''),
          deductible: String(existingPolicy.deductible || ''),
          durationYears: '',
        }]);
      }
    }
    
    setLoading(false);
  };

  const resetForm = () => {
    setSelectedCompanyId("");
    setStartDate(new Date().toISOString().split('T')[0]);
    setStatus("active");
    setNotes("");
    setDocuments([]);
    setSelectedProducts([]);
    setProductSearch("");
    setLamalPremium("");
    setLamalFranchise("");
    setLamalAccidentIncluded(true);
  };

  /**
   * Hydrate the form from an IA Scan extraction. Tries to resolve
   * companyId / productId by name when only names are provided. All
   * fields stay editable — this is just a starting point for the
   * broker to verify.
   */
  const applyPrefill = (data: ContractFormPrefill) => {
    // 1. Resolve company from companyId OR companyName (case-insensitive fuzzy)
    let resolvedCompanyId = "";
    if (data.companyId) {
      const exists = companies.find((c) => c.id === data.companyId);
      if (exists) resolvedCompanyId = exists.id;
    }
    if (!resolvedCompanyId && data.companyName) {
      // Normalise: strip accents + corporate suffixes ("SA", "AG",
      // "Assurance-maladie", etc.) so "SWICA Assurance-maladie SA"
      // matches "Swica" in the catalog.
      const stripSuffixes = (s: string) => {
        let out = s
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-z0-9 ]+/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        const sfx = [
          "sa", "ag", "sarl", "gmbh", "ltd",
          "assurance", "assurances", "assurance maladie", "assurance-maladie",
          "versicherung", "versicherungen", "insurance",
          "holding", "group", "groupe", "suisse",
        ];
        for (let i = 0; i < 6; i++) {
          let stripped = false;
          for (const f of sfx) {
            const re = new RegExp(`\\s${f}$`);
            if (re.test(out)) { out = out.replace(re, "").trim(); stripped = true; }
          }
          if (!stripped) break;
        }
        return out;
      };
      const target = stripSuffixes(data.companyName);
      const hit =
        // Exact match on normalised name
        companies.find((c) => stripSuffixes(c.name) === target) ||
        // First-word match (catches "Vaudoise" matching "La Vaudoise")
        companies.find((c) => {
          const cNorm = stripSuffixes(c.name);
          return cNorm && target && (cNorm.startsWith(target) || target.startsWith(cNorm));
        }) ||
        // Substring fallback
        companies.find((c) => {
          const cNorm = stripSuffixes(c.name);
          return cNorm.includes(target) || target.includes(cNorm);
        });
      if (hit) resolvedCompanyId = hit.id;
    }
    if (resolvedCompanyId) setSelectedCompanyId(resolvedCompanyId);

    // 2. Top-level fields
    if (data.startDate) setStartDate(data.startDate);
    if (data.status) setStatus(data.status);
    if (data.notes) setNotes(data.notes);

    // 3. Global LAMal fields
    if (typeof data.lamalPremium === "number") {
      setLamalPremium(String(data.lamalPremium));
    }
    if (typeof data.lamalFranchise === "number") {
      setLamalFranchise(String(data.lamalFranchise));
    }
    if (typeof data.lamalAccidentIncluded === "boolean") {
      setLamalAccidentIncluded(data.lamalAccidentIncluded);
    }

    // 4. Map each extracted line into a SelectedProduct entry. Match
    //    against the catalog using a tolerant normaliser: strip accents,
    //    drop the company prefix dynamically using THIS tenant's actual
    //    catalog (no hard-coded list), and try several fallback strategies.
    if (data.products && data.products.length > 0) {
      // Build the list of company prefixes to strip from the live catalog,
      // so this works generically for any insurer / product / branch the
      // tenant adds — not just the 21 we shipped seeded.
      const dynamicCompanyPrefixes = companies
        .map((c) => (c.name || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-z0-9 ]+/g, " ")
          .replace(/\s+/g, " ")
          .trim())
        .filter(Boolean)
        // Longer first so "groupe mutuel" wins over "groupe"
        .sort((a, b) => b.length - a.length);

      const normProduct = (s: string) => {
        let out = (s || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-z0-9 ]+/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        for (const p of dynamicCompanyPrefixes) {
          const re = new RegExp(`^${p}\\s+`);
          if (re.test(out)) {
            out = out.replace(re, "");
            break;  // only strip once
          }
        }
        return out;
      };

      const productsToSelect: SelectedProduct[] = data.products.map((p) => {
        const targetName = normProduct(p.productName ?? "");
        let resolvedProductId = p.productId ?? "";
        let resolvedName = p.productName ?? "Produit";
        let resolvedCategory = normalizeCategoryFromDB(p.category);
        let resolvedBranchCode: string | undefined;

        // ✨ FAST PATH: the server already matched this product against the
        // catalog (via find_product_by_alias with trigram fuzzy match). Trust
        // that result — use the catalog product as the source of truth for
        // name, category, branch, AND the company on the contract.
        if (resolvedProductId) {
          const catalogRow = allProducts.find((pr) => pr.id === resolvedProductId);
          if (catalogRow) {
            resolvedName = catalogRow.name;
            resolvedCategory = normalizeCategoryFromDB(catalogRow.category);
            resolvedBranchCode = (catalogRow.tenant_branch as any)?.code;
            // Override the company too — the IA may have returned a legal
            // entity name, but the catalog row knows the canonical one.
            if (catalogRow.company_id && !resolvedCompanyId) {
              resolvedCompanyId = catalogRow.company_id;
              setSelectedCompanyId(resolvedCompanyId);
            }
          }
        }

        if (!resolvedProductId && targetName) {
          const candidates = allProducts.filter(
            (pr) => !resolvedCompanyId || pr.company_id === resolvedCompanyId,
          );
          const hit =
            // 1. Exact normalised match
            candidates.find((pr) => normProduct(pr.name) === targetName) ||
            // 2. Catalog name contains target (prefix)
            candidates.find((pr) => normProduct(pr.name).startsWith(targetName)) ||
            // 3. Target contains catalog name
            candidates.find((pr) => {
              const n = normProduct(pr.name);
              return n && targetName.startsWith(n);
            }) ||
            // 4. Substring fallback
            candidates.find((pr) => {
              const n = normProduct(pr.name);
              return n.includes(targetName) || targetName.includes(n);
            }) ||
            // 5. First-word match (last resort: "Favorit" matches "Swica Favorit Medpharm")
            candidates.find((pr) => {
              const n = normProduct(pr.name);
              const firstWord = targetName.split(" ")[0];
              return firstWord && firstWord.length >= 4 && n.includes(firstWord);
            });
          if (hit) {
            resolvedProductId = hit.id;
            resolvedName = hit.name;
            resolvedCategory = normalizeCategoryFromDB(hit.category);
            // Carry the catalog's branch code so the LAMal/LCA grouping
            // works without relying on name-regex tricks.
            resolvedBranchCode = (hit.tenant_branch as any)?.code;
          }
        }
        // If the scan tagged this as LAMal explicitly, force the
        // category to "health" so the LAMal grouping picks it up.
        if (p.isLamal) {
          resolvedCategory = "health";
          if (!resolvedBranchCode) resolvedBranchCode = "LAMAL";
        }
        // If the scan provided a branchCode and the catalog match didn't
        // give us one, trust the scan's value — this fixes products
        // detected by the IA but not yet matched against the catalog
        // (e.g. a brand-new HOSPITA variant) which would otherwise fall
        // back to the legacy category and land in the wrong section.
        if (!resolvedBranchCode && p.branchCode) {
          resolvedBranchCode = p.branchCode;
        }

        return {
          id: generateId(),
          productId: resolvedProductId,
          name: resolvedName,
          category: resolvedCategory,
          premium: typeof p.premium === "number" ? String(p.premium) : "",
          deductible: typeof p.deductible === "number" ? String(p.deductible) : "",
          durationYears: typeof p.durationYears === "number" ? String(p.durationYears) : "",
          branchCode: resolvedBranchCode,
        };
      });
      setSelectedProducts(productsToSelect);
    }
  };

  const fetchCompaniesAndProducts = async () => {
    setLoading(true);
    const [companiesRes, productsRes] = await Promise.all([
      supabase.from('insurance_companies').select('id, name, logo_url').eq('is_active', true).order('name'),
      supabase
        .from('insurance_products')
        .select(`
          id, name, category, company_id, tenant_branch_id,
          tenant_branch:tenant_branches (
            id, code, name, icon, color
          )
        `)
        .order('name'),
    ]);
    
    if (companiesRes.data) setCompanies(companiesRes.data);
    if (productsRes.data) setAllProducts(productsRes.data);
    setLoading(false);
  };

  const getProductsForCompany = (): Product[] => {
    if (!selectedCompanyId) return [];
    try {
      let products = allProducts.filter(p => p && p.company_id === selectedCompanyId);
      // Filter by selected branch (cascade)
      if (selectedBranchId) {
        products = products.filter(p => p.tenant_branch_id === selectedBranchId);
      }
      if (productSearch) {
        const search = productSearch.toLowerCase();
        products = products.filter(p => {
          const nameMatch = p.name ? p.name.toLowerCase().includes(search) : false;
          const categoryMatch = p.category ? (categoryLabels[p.category] || p.category).toLowerCase().includes(search) : false;
          const branchMatch = p.tenant_branch?.name ? p.tenant_branch.name.toLowerCase().includes(search) : false;
          return nameMatch || categoryMatch || branchMatch;
        });
      }
      return products;
    } catch (error) {
      console.error('Error filtering products:', error);
      return [];
    }
  };

  const toggleProductSelection = (product: Product) => {
    if (!product?.id) return;
    
    const productId = product.id;
    const productName = product.name || 'Produit';
    const productCategory = product.category || 'other';
    
    setSelectedProducts(prev => {
      const currentList = prev || [];
      const existingIndex = currentList.findIndex(sp => sp?.productId === productId);
      
      if (existingIndex >= 0) {
        // Remove product
        return currentList.filter((_, index) => index !== existingIndex);
      } else {
        // Add product. Pré-remplit pillarType si le nom contient "3a"/"3b"/"vie"
        // (cf. lib/lifePillar.ts) → le courtier voit déjà le bon type au lieu
        // de devoir le saisir. Il peut overrider via le selector si besoin.
        const autoPillar = detectLifePillarFromName(productName);
        const newProduct: SelectedProduct = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          productId: productId,
          name: productName,
          category: productCategory,
          premium: "",
          deductible: "",
          durationYears: "",
          pillarType: autoPillar,
        };
        return [...currentList, newProduct];
      }
    });
  };

  const updateSelectedProduct = (id: string, updates: Partial<SelectedProduct>) => {
    if (!id) return;
    setSelectedProducts(prev => {
      const currentList = prev || [];
      return currentList.map(sp => {
        if (sp?.id === id) {
          return { ...sp, ...updates };
        }
        return sp;
      });
    });
  };

  const removeSelectedProduct = (id: string) => {
    if (!id) return;
    setSelectedProducts(prev => (prev || []).filter(sp => sp?.id !== id));
  };

  const handleCompanyChange = (companyId: string) => {
    setSelectedCompanyId(companyId);
    setSelectedProducts([]);
    setProductSearch("");
    setLamalPremium("");
    setLamalFranchise("");
  };

  // Categorize selected products safely.
  // Source of truth: branchCode (from catalog) > legacy category.
  // Without this, a product with category='multirisque' but branchCode='LCA'
  // landed in "other" instead of the health/LCA section.
  const categorizedSelection = useMemo(() => {
    const safeProducts = (selectedProducts || []).filter((p) => p?.id);

    // Détecte un produit LPP par son nom (fallback quand le catalog n'a pas
    // encore le branch_code='LPP' configuré). Couvre les noms typiques :
    // "Compte de libre passage", "LPP", "2e pilier", "Prévoyance professionnelle".
    const isLppRow = (p: SelectedProduct): boolean => {
      if (p.branchCode === 'LPP') return true;
      return !!(p.name && /libre[\s_-]?passage|\bLPP\b|2e?\s*pilier|prévoyance prof/i.test(p.name));
    };

    const bucketOf = (p: SelectedProduct): 'health' | 'life' | 'other' => {
      // PRIORITÉ : un produit LPP est toujours dans 'life', peu importe sa
      // catégorie storée (parfois 'health' à tort dans le catalog).
      if (isLppRow(p)) return 'life';
      const branch = p.branchCode;
      if (branch === 'LAMAL' || branch === 'LCA' || branch === 'PGM' || branch === 'ACCIDENT') return 'health';
      if (branch === 'VIE' || branch === 'LPP') return 'life';
      if (branch === 'AUTO' || branch === 'MENAGE_RC' || branch === 'JURIDIQUE' ||
          branch === 'VOYAGE' || branch === 'ENTREPRISE' || branch === 'HYPO_CREDIT') return 'other';
      // Fallback to legacy category for products with no branch yet
      if (p.category === 'health') return 'health';
      if (p.category === 'life') return 'life';
      return 'other';
    };

    const health = safeProducts.filter((p) => bucketOf(p) === 'health');
    const life = safeProducts.filter((p) => bucketOf(p) === 'life');
    const other = safeProducts.filter((p) => bucketOf(p) === 'other');

    // LAMal vs LCA inside the health bucket — also branch-driven.
    const isLamalRow = (p: SelectedProduct) => {
      if (p.branchCode === 'LAMAL') return true;
      if (p.branchCode === 'LCA' || p.branchCode === 'PGM' || p.branchCode === 'ACCIDENT') return false;
      return !!(p.name && isLamalProduct(p.name));
    };
    const healthLamal = health.filter(isLamalRow);
    const healthLca = health.filter((p) => !isLamalRow(p));

    // LPP vs Vie classique dans le bucket life — pour rendre la sous-section
    // "Compte de Libre passage / Rapatriement avoir LPP / Avoir total"
    const lifeLpp = life.filter(isLppRow);
    const lifeVie = life.filter((p) => !isLppRow(p));

    return { healthLamal, healthLca, life, lifeLpp, lifeVie, other, health };
  }, [selectedProducts]);

  // Calculate totals safely
  const totals = useMemo(() => {
    try {
      const lamal = parseFloat(lamalPremium) || 0;
      const lcaTotal = (categorizedSelection.healthLca || []).reduce((sum, p) => sum + (parseFloat(p?.premium || '0') || 0), 0);
      const healthTotal = lamal + lcaTotal;
      
      const lifeTotal = (categorizedSelection.life || []).reduce((sum, p) => sum + (parseFloat(p?.premium || '0') || 0), 0);
      const otherTotal = (categorizedSelection.other || []).reduce((sum, p) => sum + (parseFloat(p?.premium || '0') || 0), 0);
      
      return {
        lamal,
        lcaTotal,
        healthTotal,
        lifeTotal,
        otherTotal,
        grandTotal: healthTotal + lifeTotal + otherTotal
      };
    } catch (error) {
      console.error('Error calculating totals:', error);
      return { lamal: 0, lcaTotal: 0, healthTotal: 0, lifeTotal: 0, otherTotal: 0, grandTotal: 0 };
    }
  }, [lamalPremium, categorizedSelection, selectedProducts]);

  const contractFormSchema = z.object({
    selectedCompanyId: z.string().min(1, t("forms.contract.validation.companyRequired")),
    startDate: z.string().min(1, t("forms.contract.validation.startDateRequired")),
    selectedProducts: z.array(z.any()).min(1, t("forms.contract.validation.atLeastOneProduct")),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = contractFormSchema.safeParse({ selectedCompanyId, startDate, selectedProducts });
    if (!validation.success) {
      toast({
        title: t("common.error"),
        description: validation.error.issues[0].message,
        variant: "destructive"
      });
      return;
    }

    if (hasDuplicateContract) {
      const selectedCompany = companies.find(c => c.id === selectedCompanyId);
      const conflictLabel = duplicateProductConflicts
        .map(c => categoryLabels[c.category] || c.category)
        .join(', ');
      toast({
        title: t("common.error"),
        description: t("forms.contract.duplicateClientHasContractFor", {
          company: selectedCompany?.name ?? '',
          categories: conflictLabel,
        }),
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);

    try {
      // Get the company name
      const selectedCompany = companies.find(c => c.id === selectedCompanyId);
      const companyName = selectedCompany?.name || null;

      // Build products data array with all product details
      const productsData = selectedProducts.map(product => {
        let premium = 0;
        let deductible: number | null = null;
        // LAMal-specific: per-product accidentIncluded flag persisted in
        // products_data so it survives reload. Only meaningful for the
        // LAMal product(s); ignored for non-LAMal lines.
        const isLamalLine =
          product.category === 'health' && isLamalProduct(product.name);

        if (product.category === 'health') {
          if (isLamalLine) {
            premium = parseFloat(lamalPremium) || 0;
            deductible = parseFloat(lamalFranchise) || null;
          } else {
            premium = parseFloat(product.premium) || 0;
          }
        } else if (product.category === 'life') {
          premium = parseFloat(product.premium) || 0;
        } else {
          premium = parseFloat(product.premium) || 0;
          deductible = parseFloat(product.deductible) || null;
        }

        // LPP : si c'est un libre passage ou autre LPP, on persiste le
        // montant d'avoirs en plus du reste (la prime mensuelle est laissée
        // à 0 par défaut puisqu'il n'y a pas de versement récurrent).
        const isLpp = product.branchCode === 'LPP'
          || /libre[\s_-]?passage|lpp|2e?\s*pilier|prévoyance prof/i.test(product.name || '');
        const avoirTotal = isLpp && product.avoirTotal ? parseFloat(product.avoirTotal) : null;

        return {
          productId: product.productId,
          name: product.name,
          category: product.category,
          premium,
          deductible,
          durationYears: product.durationYears ? parseInt(product.durationYears) : null,
          // Non-LAMal lines: emit `null` so the column stays present but
          // semantically "n/a". LAMal lines carry the toggle value.
          accidentIncluded: isLamalLine ? lamalAccidentIncluded : null,
          // LPP : montant d'avoirs (capital) — base de calcul commission
          // qui s'applique selon le taux du partenaire (typiquement 3%).
          avoirTotal,
          // Type de pilier pour les produits Vie/Prévoyance ('pilier_3a',
          // 'pilier_3b', 'vie_classique'). NULL pour les produits non-vie.
          // Crucial pour la fiscalité (3a déductible, 3b non) et le
          // traitement successoral.
          pillarType: product.pillarType ?? null,
        };
      });

      // Calculate totals
      const totalMonthly = totals.grandTotal;
      const totalYearly = totalMonthly * 12;
      
      // Calculate end date based on life insurance duration if applicable
      let endDate: string | null = null;
      const lifeProducts = selectedProducts.filter(p => p.category === 'life' && p.durationYears);
      if (lifeProducts.length > 0) {
        const maxDuration = Math.max(...lifeProducts.map(p => parseInt(p.durationYears) || 0));
        if (maxDuration > 0) {
          const start = new Date(startDate);
          start.setFullYear(start.getFullYear() + maxDuration);
          endDate = start.toISOString().split('T')[0];
        }
      }

      // Build notes with summary
      const notesParts: string[] = [];
      if (categorizedSelection.healthLamal.length > 0 && totals.lamal > 0) {
        notesParts.push(`LAMal: ${totals.lamal.toFixed(2)} CHF/mois`);
        if (lamalFranchise) notesParts.push(`Franchise LAMal: ${lamalFranchise} CHF`);
      }
      if (totals.lcaTotal > 0) {
        notesParts.push(`LCA: ${totals.lcaTotal.toFixed(2)} CHF/${t('common.month')}`);
      }
      if (totals.lifeTotal > 0) {
        notesParts.push(`${t('forms.contract.categories.life')}: ${totals.lifeTotal.toFixed(2)} CHF/${t('common.month')}`);
      }
      if (totals.otherTotal > 0) {
        notesParts.push(`${t('forms.contract.otherInsurance')}: ${totals.otherTotal.toFixed(2)} CHF/${t('common.month')}`);
      }
      if (notes) notesParts.push(notes);

      // Use the first product's ID as the main product_id (for backward compatibility)
      const mainProductId = selectedProducts[0].productId;
      const mainCategory = selectedProducts.length === 1 
        ? selectedProducts[0].category 
        : 'multi';

      // Determine the deductible to save at policy level
      // Priority: LAMal franchise > first "other" product deductible > first product with deductible
      let policyDeductible: number | null = parseFloat(lamalFranchise) || null;
      if (!policyDeductible && productsData.length === 1) {
        // Single product: use its deductible
        policyDeductible = productsData[0].deductible;
      } else if (!policyDeductible && categorizedSelection.other.length > 0) {
        // Multiple products: use first "other" category product's deductible
        const otherProduct = productsData.find(p => !['health', 'life'].includes(p.category) && p.deductible);
        if (otherProduct) policyDeductible = otherProduct.deductible;
      }

      const policyData = {
        client_id: clientId,
        product_id: mainProductId,
        policy_number: null,
        start_date: startDate,
        end_date: endDate,
        premium_monthly: totalMonthly,
        premium_yearly: totalYearly,
        deductible: policyDeductible,
        status: status,
        notes: notesParts.join('\n') || null,
        company_name: companyName,
        product_type: mainCategory,
        products_data: productsData,
        // Per-contract branch override — picked by the broker in the
        // cascade selector. Falls back to product's branch in the UI
        // when null.
        tenant_branch_id: selectedBranchId || null,
      };

      if (editMode && policyId) {
        await updatePolicy(policyId, policyData);
      } else {
        const policy = await createPolicy(policyData);

        // Save documents linked to the policy.
        // Use Promise.allSettled so a single PDF upload failure doesn't
        // silently lose the others — the broker is told which file(s)
        // didn't make it. Previously a thrown createDocument bubbled
        // out of the try/catch with no surfaced message and the form
        // closed anyway, hiding the lost attachment.
        let docsFailedCount = 0;
        if (documents.length > 0 && policy?.id) {
          const results = await Promise.allSettled(
            documents.map((doc) =>
              createDocument({
                owner_id: policy.id,
                owner_type: 'policy',
                file_key: doc.file_key,
                file_name: doc.file_name,
                doc_kind: doc.doc_kind,
                mime_type: doc.mime_type,
                size_bytes: doc.size_bytes,
              }),
            ),
          );
          docsFailedCount = results.filter((r) => r.status === "rejected").length;
          if (docsFailedCount > 0) {
            // Log every individual failure for diagnosability
            results.forEach((r, i) => {
              if (r.status === "rejected") {
                console.error(
                  `[ContractForm] createDocument failed for "${documents[i]?.file_name ?? "?"}"`,
                  r.reason,
                );
              }
            });
          }
        }

        // If at least one doc upload failed, raise a destructive toast
        // and DON'T close the dialog so the broker can retry the upload
        // — but the contract itself is saved and stays so.
        if (docsFailedCount > 0) {
          toast({
            variant: "destructive",
            title: t("forms.contract.documentUploadFailedTitle"),
            description: t("forms.contract.documentUploadFailedDesc", {
              count: docsFailedCount,
            }),
          });
        }
      }

      // Celebrate the new contract!
      if (!editMode) {
        celebrate('contract_added');
      }

      toast({
        title: editMode ? t("forms.contract.contractUpdated") : t("forms.contract.contractCreated"),
        description: editMode
          ? t("forms.contract.contractUpdatedDesc")
          : t("forms.contract.contractCreatedDesc", { count: selectedProducts.length })
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message || (editMode ? t("forms.contract.errorUpdating") : t("forms.contract.errorCreating")),
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const groupedProducts = useMemo(() => {
    if (!selectedCompanyId || !allProducts.length) return {};

    const filtered = allProducts.filter(p => {
      if (!p || p.company_id !== selectedCompanyId) return false;
      if (!productSearch) return true;
      const search = productSearch.toLowerCase();
      const nameMatch = (p.name || '').toLowerCase().includes(search);
      const categoryMatch = (categoryLabels[p.category] || p.category || '').toLowerCase().includes(search);
      return nameMatch || categoryMatch;
    });

    // Détecte produit LPP via branchCode catalog OU nom — pour grouper
    // sous "Compte de Libre passage" même si catalog.category='health' à tort.
    const isLppProduct = (p: any): boolean => {
      const branchCode = p.tenant_branch?.code || p.tenant_branch?.[0]?.code;
      if (branchCode === 'LPP') return true;
      return !!(p.name && /libre[\s_-]?passage|\bLPP\b|2e?\s*pilier|prévoyance prof/i.test(p.name));
    };

    const grouped: Record<string, Product[]> = {};
    for (const p of filtered) {
      // PRIORITÉ : produit LPP → bucket dédié 'lpp' (override catalog.category)
      const groupKey = isLppProduct(p) ? 'lpp' : (p.category || 'other');
      if (!grouped[groupKey]) grouped[groupKey] = [];
      grouped[groupKey].push(p);
    }
    return grouped;
  }, [selectedCompanyId, allProducts, productSearch]);

  const isProductSelected = (productId: string): boolean => {
    return selectedProducts.some(sp => sp?.productId === productId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editMode ? t("forms.contract.editTitle") : t("forms.contract.title")}
            {selectedProducts.length > 0 && !editMode && (
              <span className="text-sm font-normal text-muted-foreground">
                ({t("forms.contract.productCount", { count: selectedProducts.length })})
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden gap-4">
            {/*
              No-mandat warning banner. A signed Mandat de gestion is
              best-practice before creating contracts on behalf of a
              client (FINMA-aligned), but Habib confirmed it's not
              hard-blocking — some clients sign later, some files are
              imported retroactively. So we WARN, link to the mandat
              flow, and let the broker continue.
            */}
            {showNoMandatWarning && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 text-sm">
                  <div className="font-medium text-amber-900">
                    {t("forms.contract.noMandatTitle")}
                  </div>
                  <div className="text-amber-800 mt-0.5">
                    {t("forms.contract.noMandatDescription")}
                  </div>
                </div>
              </div>
            )}

            {/* Common Fields Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 p-4 bg-muted/30 rounded-lg">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">{t("forms.contract.company")} *</Label>
                <Select value={selectedCompanyId} onValueChange={(v) => { handleCompanyChange(v); setSelectedBranchId(null); }}>
                  <SelectTrigger className={hasDuplicateContract ? "border-destructive" : ""}>
                    <SelectValue placeholder={t("common.select")} />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => {
                      const hasContract = companiesWithExistingContracts.includes(company.name);
                      return (
                        <SelectItem
                          key={company.id}
                          value={company.id}
                        >
                          <div className="flex items-center gap-2">
                            {(company as any).logo_url ? (
                              <img
                                src={(company as any).logo_url}
                                alt={company.name}
                                className="h-5 w-5 object-contain"
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                              />
                            ) : null}
                            <span>{company.name}</span>
                            {hasContract && (
                              <span className="text-xs text-muted-foreground">{t("forms.contract.existingContract")}</span>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {hasDuplicateContract && (
                  <p className="text-xs text-destructive leading-snug">
                    {t("forms.contract.duplicateLabel", {
                      plural: duplicateProductConflicts.length > 1 ? "s" : "",
                    })}{" "}
                    {duplicateProductConflicts
                      .map(c => categoryLabels[c.category] || c.category)
                      .join(', ')}{" "}
                    {duplicateProductConflicts.length > 1
                      ? t("forms.contract.duplicateAlreadyCoveredMany")
                      : t("forms.contract.duplicateAlreadyCoveredOne")}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Branche</Label>
                <BranchSelector
                  value={selectedBranchId}
                  onChange={(branchId) => setSelectedBranchId(branchId)}
                  placeholder="Toutes branches"
                />
                <p className="text-[10px] text-muted-foreground">Filtre les produits par catégorie.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">{t("forms.contract.startDate")} *</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">{t("forms.contract.status")}</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">{t("forms.contract.statuses.pending")}</SelectItem>
                    <SelectItem value="active">{t("forms.contract.statuses.active")}</SelectItem>
                    <SelectItem value="expired">{t("forms.contract.statuses.expired")}</SelectItem>
                    <SelectItem value="cancelled">{t("forms.contract.statuses.cancelled")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 lg:col-span-2">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">{t("forms.contract.documents")}</Label>
                <DocumentUpload
                  documents={documents}
                  onUpload={(doc) => setDocuments(prev => [...prev, doc])}
                  onRemove={(index) => setDocuments(prev => prev.filter((_, i) => i !== index))}
                />
              </div>
            </div>

            {/* Main Content */}
            {selectedCompanyId && (
              <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Left: Product Selection List */}
                <div className="space-y-3 overflow-hidden flex flex-col border rounded-lg p-3">
                  <div className="space-y-2">
                    <Label className="font-semibold">{t("forms.contract.availableProducts")}</Label>
                    <Input
                      placeholder={t("forms.contract.searchProduct")}
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="space-y-4 pr-2">
                      {Object.entries(groupedProducts).map(([category, products]) => {
                        if (!products || !Array.isArray(products)) return null;
                        return (
                          <div key={category}>
                            <div className={`flex items-center gap-2 text-xs font-semibold px-2 py-1.5 rounded-md mb-2 ${categoryColors[category] || 'bg-gray-100'}`}>
                              {categoryIcons[category] || <Shield className="h-4 w-4" />}
                              {categoryLabels[category] || category} ({products.length})
                            </div>
                            <div className="space-y-1 pl-1">
                              {products.map((product) => {
                                if (!product?.id) return null;
                                const selected = isProductSelected(product.id);
                                const lamal = product.category === 'health' && isLamalProduct(product.name);
                                return (
                                  <button
                                    type="button"
                                    key={product.id}
                                    onClick={() => toggleProductSelection(product)}
                                    className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-all text-sm w-full text-left ${
                                      selected 
                                        ? 'bg-primary text-primary-foreground shadow-sm' 
                                        : 'hover:bg-muted/80'
                                    }`}
                                  >
                                    <div className={`h-4 w-4 rounded border flex items-center justify-center ${selected ? 'bg-primary-foreground border-primary-foreground' : 'border-input'}`}>
                                      {selected && <Check className="h-3 w-3 text-primary" />}
                                    </div>
                                    <span className="flex-1 truncate">{product.name || t("forms.contract.fallbackProductName")}</span>
                                    {lamal && (
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${selected ? 'bg-primary-foreground/20' : 'bg-emerald-100 text-emerald-700'}`}>
                                        LAMal
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      {Object.keys(groupedProducts).length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          {t("forms.contract.noProductsFound")}
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>

                {/* Right: Configuration Panel */}
                <div className="lg:col-span-2 overflow-hidden flex flex-col border rounded-lg">
                  <ScrollArea className="flex-1">
                    <div className="p-4 space-y-6">
                      {selectedProducts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                          <FileText className="h-12 w-12 mb-4 opacity-30" />
                          <p className="text-sm">{t("forms.contract.selectProductsHint")}</p>
                        </div>
                      ) : (
                        <>
                          {/* HEALTH INSURANCE SECTION */}
                          {categorizedSelection.health.length > 0 && (
                            <div className={`p-4 rounded-xl border-2 ${categoryColors.health}`}>
                              <div className="flex items-center gap-2 mb-4">
                                {categoryIcons.health}
                                <h3 className="font-bold">{t("forms.contract.healthInsurance")}</h3>
                              </div>
                              
                              {/* LAMal Section */}
                              {categorizedSelection.healthLamal.length > 0 && (
                                <div className="mb-4 p-3 bg-white/60 rounded-lg">
                                  <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                                    <span className="px-2 py-0.5 bg-emerald-600 text-white rounded text-xs">{t("forms.contract.lamal")}</span>
                                    {t("forms.contract.lamalBase")}
                                  </h4>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <Label className="text-xs">{t("forms.contract.lamalPremium")} *</Label>
                                      <Input
                                        type="number"
                                        step="0.05"
                                        min="0"
                                        placeholder="350.00"
                                        value={lamalPremium}
                                        onChange={(e) => setLamalPremium(e.target.value)}
                                        className="h-9 bg-white"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-xs">{t("forms.contract.lamalFranchise")}</Label>
                                      <Select value={lamalFranchise} onValueChange={setLamalFranchise}>
                                        <SelectTrigger className="h-9 bg-white">
                                          <SelectValue placeholder={t("common.select")} />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="300">300 CHF</SelectItem>
                                          <SelectItem value="500">500 CHF</SelectItem>
                                          <SelectItem value="1000">1'000 CHF</SelectItem>
                                          <SelectItem value="1500">1'500 CHF</SelectItem>
                                          <SelectItem value="2000">2'000 CHF</SelectItem>
                                          <SelectItem value="2500">2'500 CHF</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                  {/* Accident coverage included toggle. Specific
                                      to LAMal: a client without employer LAA
                                      cover MUST include it, an employee may
                                      opt out. Default: true (most common). */}
                                  <div className="mt-3 flex items-start gap-2 p-2 rounded-md bg-white/80 border border-emerald-200">
                                    <Checkbox
                                      id="lamal-accident"
                                      checked={lamalAccidentIncluded}
                                      onCheckedChange={(checked) =>
                                        setLamalAccidentIncluded(checked === true)
                                      }
                                      className="mt-0.5"
                                    />
                                    <div className="flex-1">
                                      <Label
                                        htmlFor="lamal-accident"
                                        className="text-xs font-medium cursor-pointer"
                                      >
                                        {t("forms.contract.lamalAccident")}
                                      </Label>
                                      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                                        {t("forms.contract.lamalAccidentHelp")}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="mt-2 text-xs text-muted-foreground">
                                    {t("forms.contract.productHint")}: {categorizedSelection.healthLamal.map(p => p.name || t("forms.contract.fallbackProductName")).join(', ')}
                                  </div>
                                </div>
                              )}
                              
                              {/* LCA Section */}
                              {categorizedSelection.healthLca.length > 0 && (
                                <div className="p-3 bg-white/60 rounded-lg">
                                  <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                                    <span className="px-2 py-0.5 bg-teal-600 text-white rounded text-xs">{t("forms.contract.lca")}</span>
                                    {t("forms.contract.lcaComplement")} ({categorizedSelection.healthLca.length})
                                  </h4>
                                  <div className="space-y-3">
                                    {categorizedSelection.healthLca.map((product) => {
                                      if (!product || !product.id) return null;
                                      return (
                                        <div key={product.id} className="flex items-center gap-3 p-2 bg-white rounded border">
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{product.name || t("forms.contract.fallbackProductName")}</p>
                                          </div>
                                          <div className="w-32">
                                            <Input
                                              type="number"
                                              step="0.05"
                                              min="0"
                                              placeholder={t("forms.contract.premiumMonth")}
                                              value={product.premium || ""}
                                              onChange={(e) => updateSelectedProduct(product.id, { premium: e.target.value })}
                                              className="h-8 text-sm"
                                            />
                                          </div>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeSelectedProduct(product.id)}
                                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                          >
                                            <X className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  {totals.lcaTotal > 0 && (
                                    <p className="mt-2 text-sm font-medium text-right">
                                      {t("forms.contract.totalLcaInline", { amount: totals.lcaTotal.toFixed(2) })}
                                    </p>
                                  )}
                                </div>
                              )}
                              
                              {/* Health Total */}
                              {totals.healthTotal > 0 && (
                                <div className="mt-4 pt-3 border-t border-emerald-300">
                                  <div className="flex justify-between items-center">
                                    <span className="font-semibold">{t("forms.contract.healthTotal")}</span>
                                    <span className="text-lg font-bold">{totals.healthTotal.toFixed(2)} CHF</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* LPP LIBRE PASSAGE SECTION (séparée de Vie classique : pas
                              de prime mensuelle, mais montant d'avoirs/capital. Commission
                              calculée selon le taux du partenaire — typiquement 3% — dans
                              le module Partenaires.) */}
                          {categorizedSelection.lifeLpp && categorizedSelection.lifeLpp.length > 0 && (
                            <div className="p-4 rounded-xl border-2 border-amber-300 bg-amber-50">
                              <div className="flex items-center gap-2 mb-4">
                                <span className="text-2xl">🐷</span>
                                <h3 className="font-bold text-amber-900">Compte de Libre passage</h3>
                              </div>
                              <div className="p-3 bg-white/70 rounded-lg">
                                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                                  <span className="px-2 py-0.5 bg-amber-600 text-white rounded text-xs">LPP</span>
                                  Rapatriement avoir LPP ({categorizedSelection.lifeLpp.length})
                                </h4>
                                <div className="space-y-3">
                                  {categorizedSelection.lifeLpp.map((product) => {
                                    if (!product || !product.id) return null;
                                    return (
                                      <div key={product.id} className="flex items-center gap-3 p-2 bg-white rounded border">
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium truncate">{product.name || t("forms.contract.fallbackProductName")}</p>
                                        </div>
                                        <div className="w-44">
                                          <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Avoir total (CHF)</Label>
                                          <Input
                                            type="number"
                                            step="1"
                                            min="1"
                                            max="1000000"
                                            placeholder="ex: 45000"
                                            value={product.avoirTotal || ""}
                                            onChange={(e) => {
                                              const v = e.target.value;
                                              if (v === "") {
                                                updateSelectedProduct(product.id, { avoirTotal: "" });
                                                return;
                                              }
                                              const n = parseFloat(v);
                                              if (isNaN(n)) return;
                                              const clamped = Math.min(1000000, Math.max(1, n));
                                              updateSelectedProduct(product.id, { avoirTotal: String(clamped) });
                                            }}
                                            className="h-8 text-sm"
                                          />
                                        </div>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => removeSelectedProduct(product.id)}
                                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    );
                                  })}
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-2">
                                  Capital LPP retrouvé / transféré (1 à 1'000'000 CHF). La commission est calculée selon le taux du partenaire (Paramètres → Partenaires → compagnie).
                                </p>
                              </div>
                            </div>
                          )}

                          {/* LIFE INSURANCE SECTION (Vie classique : 3e pilier A/B,
                              vie risque, vie mixte, rente viagère — pas LPP libre passage) */}
                          {categorizedSelection.lifeVie && categorizedSelection.lifeVie.length > 0 && (
                            <div className={`p-4 rounded-xl border-2 ${categoryColors.life}`}>
                              <div className="flex items-center gap-2 mb-4">
                                {categoryIcons.life}
                                <h3 className="font-bold">{t("forms.contract.lifeInsurance")}</h3>
                              </div>
                              <div className="space-y-3">
                                {categorizedSelection.lifeVie.map((product) => {
                                  if (!product || !product.id) return null;
                                  return (
                                    <div key={product.id} className="p-3 bg-white/60 rounded-lg">
                                      <div className="flex items-center justify-between mb-2">
                                        <p className="font-medium text-sm">{product.name || t("forms.contract.fallbackProductName")}</p>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => removeSelectedProduct(product.id)}
                                          className="h-6 w-6 p-0 text-destructive"
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </div>
                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <Label className="text-xs">{t("forms.contract.premium")}</Label>
                                          <Input
                                            type="number"
                                            step="0.05"
                                            min="0"
                                            placeholder="200.00"
                                            value={product.premium || ""}
                                            onChange={(e) => updateSelectedProduct(product.id, { premium: e.target.value })}
                                            className="h-8 text-sm bg-white"
                                          />
                                        </div>
                                        <div>
                                          <Label className="text-xs">{t("forms.contract.duration")}</Label>
                                          <Input
                                            type="number"
                                            min="1"
                                            max="50"
                                            placeholder="10"
                                            value={product.durationYears || ""}
                                            onChange={(e) => updateSelectedProduct(product.id, { durationYears: e.target.value })}
                                            className="h-8 text-sm bg-white"
                                          />
                                        </div>
                                      </div>
                                      {/* Type de pilier — distinction fiscale + juridique majeure en CH :
                                          · 3a (lié) : déductible fiscalement, max ~7'056 CHF/an, blocage 60 ans,
                                            conditions strictes de retrait (immo, indépendant, expatrié).
                                          · 3b (libre) : pas de déduction fiscale directe, retrait libre,
                                            traitement successoral différent.
                                          On stocke dans products_data.pillarType sur la policy — pas de
                                          migration DB nécessaire (JSONB polymorphe). */}
                                      <div className="mt-3">
                                        <Label className="text-xs">Type de pilier</Label>
                                        <Select
                                          value={product.pillarType || ""}
                                          onValueChange={(val) =>
                                            updateSelectedProduct(product.id, { pillarType: val || null })
                                          }
                                        >
                                          <SelectTrigger className="h-8 text-sm bg-white">
                                            <SelectValue placeholder="Sélectionner…" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="pilier_3a">
                                              3ᵉ pilier A (lié, fiscalement déductible)
                                            </SelectItem>
                                            <SelectItem value="pilier_3b">
                                              3ᵉ pilier B (libre, pas de déduction)
                                            </SelectItem>
                                            <SelectItem value="vie_classique">
                                              Vie classique (risque, mixte, rente)
                                            </SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      {product.premium && product.durationYears && (
                                        <p className="mt-2 text-xs text-muted-foreground">
                                          Total sur {product.durationYears} ans: {(parseFloat(product.premium) * 12 * parseInt(product.durationYears)).toLocaleString('fr-CH')} CHF
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                              {totals.lifeTotal > 0 && (
                                <div className="mt-4 pt-3 border-t border-violet-300">
                                  <div className="flex justify-between items-center">
                                    <span className="font-semibold">{t("forms.contract.lifeTotal")}</span>
                                    <span className="text-lg font-bold">{totals.lifeTotal.toFixed(2)} CHF</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* OTHER INSURANCES SECTION */}
                          {categorizedSelection.other.length > 0 && (
                            <div className="p-4 rounded-xl border-2 bg-slate-50 border-slate-200">
                              <div className="flex items-center gap-2 mb-4">
                                <Shield className="h-4 w-4" />
                                <h3 className="font-bold">{t('forms.contract.otherInsurance')}</h3>
                              </div>
                              <div className="space-y-3">
                                {categorizedSelection.other.map((product) => {
                                  if (!product || !product.id) return null;
                                  const category = product.category || 'other';
                                  // LPP détection : produit est un compte libre passage ou autre LPP
                                  // → pas de prime mensuelle mais montant d'avoirs (capital sur lequel
                                  // la commission Partenaires sera calculée, typiquement 3%).
                                  const isLpp = product.branchCode === 'LPP'
                                    || /libre[\s_-]?passage|lpp|2e?\s*pilier|prévoyance prof/i.test(product.name || '');
                                  return (
                                    <div key={product.id} className="p-3 bg-white rounded-lg border">
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${categoryColors[category] || 'bg-gray-100 text-gray-800'}`}>
                                            {categoryLabels[category] || category}
                                          </span>
                                          <p className="font-medium text-sm">{product.name || t("forms.contract.fallbackProductName")}</p>
                                          {isLpp && <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800">LPP</span>}
                                        </div>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => removeSelectedProduct(product.id)}
                                          className="h-6 w-6 p-0 text-destructive"
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </div>
                                      {isLpp ? (
                                        // ─── LPP : Montant d'avoirs (pas de prime mensuelle, pas de franchise)
                                        <div className="grid grid-cols-1 gap-2">
                                          <div>
                                            <Label className="text-xs">Montant d'avoirs (CHF) — entre 1 et 1'000'000</Label>
                                            <Input
                                              type="number"
                                              step="1"
                                              min="1"
                                              max="1000000"
                                              placeholder="ex: 45000"
                                              value={product.avoirTotal || ""}
                                              onChange={(e) => {
                                                const v = e.target.value;
                                                // Clamp 1 ≤ v ≤ 1'000'000 si une valeur numérique est saisie
                                                if (v === "") {
                                                  updateSelectedProduct(product.id, { avoirTotal: "" });
                                                  return;
                                                }
                                                const n = parseFloat(v);
                                                if (isNaN(n)) return;
                                                const clamped = Math.min(1000000, Math.max(1, n));
                                                updateSelectedProduct(product.id, { avoirTotal: String(clamped) });
                                              }}
                                              className="h-8 text-sm"
                                            />
                                            <p className="text-[10px] text-muted-foreground mt-1">
                                              Capital LPP retrouvé / transféré (1 à 1'000'000 CHF). La commission est calculée selon le taux du partenaire (Paramètres → Partenaires → compagnie).
                                            </p>
                                          </div>
                                        </div>
                                      ) : (
                                        // ─── Standard : Prime + Franchise
                                        <div className="grid grid-cols-2 gap-3">
                                          <div>
                                            <Label className="text-xs">{t("forms.contract.premium")}</Label>
                                            <Input
                                              type="number"
                                              step="0.05"
                                              min="0"
                                              placeholder="50.00"
                                              value={product.premium || ""}
                                              onChange={(e) => updateSelectedProduct(product.id, { premium: e.target.value })}
                                              className="h-8 text-sm"
                                            />
                                          </div>
                                          <div>
                                            <Label className="text-xs">{t("forms.contract.deductible")}</Label>
                                            <Input
                                              type="number"
                                              step="100"
                                              min="0"
                                              placeholder="200"
                                              value={product.deductible || ""}
                                              onChange={(e) => updateSelectedProduct(product.id, { deductible: e.target.value })}
                                              className="h-8 text-sm"
                                            />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                              {totals.otherTotal > 0 && (
                                <div className="mt-4 pt-3 border-t border-slate-300">
                                  <div className="flex justify-between items-center">
                                    <span className="font-semibold">{t('forms.contract.otherTotal')}</span>
                                    <span className="text-lg font-bold">{totals.otherTotal.toFixed(2)} CHF</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* GRAND TOTAL */}
                          {totals.grandTotal > 0 && (
                            <div className="p-4 bg-primary/5 rounded-xl border-2 border-primary/20">
                              <div className="flex justify-between items-center">
                                <div>
                                  <span className="font-bold text-lg">{t('forms.contract.grandTotal')}</span>
                                  <p className="text-xs text-muted-foreground">{t('forms.contract.productCount', { count: selectedProducts.length })}</p>
                                </div>
                                <span className="text-2xl font-bold text-primary">{totals.grandTotal.toFixed(2)} CHF</span>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {t('forms.contract.yearlyEstimate', { amount: (totals.grandTotal * 12).toLocaleString('fr-CH') })}
                              </p>
                            </div>
                          )}

                          {/* Notes */}
                          <div className="space-y-2">
                            <Label>{t('forms.contract.notes')}</Label>
                            <Textarea
                              placeholder={t('forms.contract.notesPlaceholder')}
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                              maxLength={500}
                              rows={2}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-between items-center pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                {documents.length > 0 && (
                  <span className="flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    {t('forms.contract.documentsCount', { count: documents.length })}
                  </span>
                )}
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={submitting || selectedProducts.length === 0 || hasDuplicateContract}>
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editMode ? t('common.save') : t('forms.contract.createContract')}
                </Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
