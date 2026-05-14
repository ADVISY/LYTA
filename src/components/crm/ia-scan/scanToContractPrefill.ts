/**
 * scanToContractPrefill
 * ----------------------
 * Maps a group of IA-scanned products (same company + same insured person)
 * into a ContractFormPrefill payload that ContractForm understands.
 *
 * This is the core of the F5 unification: the IA scan flow no longer creates
 * policies directly — it constructs a prefill and opens the SAME ContractForm
 * the broker uses for manual creation. From the user's point of view, there
 * is zero visible difference between "manually entered" and "scanned" contracts.
 */
import type { PendingScan, ProductDetected } from "@/hooks/usePendingScans";
import type { ContractFormPrefill } from "@/components/crm/ContractForm";

// Branch codes coming from the Edge function or resolved server-side
const HEALTH_BRANCHES = new Set(["LAMAL", "LCA", "PGM"]);
const LIFE_BRANCHES = new Set(["VIE", "LPP"]);

/** Map a branch_code to the legacy `category` enum used by ContractForm internals. */
function branchCodeToCategory(branchCode: string | undefined | null): string {
  const code = (branchCode || "").toUpperCase();
  if (code === "LAMAL" || code === "LCA" || code === "PGM") return "health";
  if (code === "VIE" || code === "LPP") return "life";
  if (code === "AUTO") return "auto";
  if (code === "MENAGE_RC") return "home";
  if (code === "JURIDIQUE") return "legal";
  if (code === "HYPO_CREDIT") return "hypo";
  return "other";
}

/** True when this product is the LAMal mandatory base health insurance. */
function isLamal(product: ProductDetected): boolean {
  const code = (product.resolved_branch_code || product.branch_code || "").toUpperCase();
  if (code === "LAMAL") return true;
  const name = (product.product_name || "").toLowerCase();
  return /(lamal|kvg|favorit|medpharm|telmed|casamed|premed|qualimed|^basis|^base|hmo)/i.test(name);
}

export interface BuildPrefillOptions {
  /** Default start date when the scan didn't extract one. */
  defaultStartDate?: string;
  /** Force a specific status (defaults to 'active' since these are confirmed contracts). */
  status?: string;
  /** Whether the scan contains a résiliation document → flags the form to fire a suivi after submit. */
  hasResiliation?: boolean;
}

export function scanToContractFormPrefill(
  scan: PendingScan,
  products: ProductDetected[],
  options: BuildPrefillOptions = {},
): ContractFormPrefill {
  if (!products.length) {
    return {};
  }

  const first = products[0];

  // Pick the earliest start_date across the group (fallback to today)
  const startDates = products
    .map((p) => p.start_date)
    .filter((d): d is string => Boolean(d))
    .sort();
  const startDate = startDates[0] || options.defaultStartDate || new Date().toISOString().split("T")[0];

  // Detect LAMal in the group → pull franchise + accident_included from the LAMal line
  const lamalLine = products.find(isLamal);
  const lamalPremium = lamalLine?.premium_monthly;
  const lamalFranchise = lamalLine?.franchise;
  const lamalAccidentIncluded = lamalLine?.accident_included;

  // Build the products array. Each line carries the catalog mapping hints
  // (productId if matched server-side, fallback name to fuzzy-match in
  // ContractForm.applyPrefill if not).
  const prefillProducts = products.map((p) => {
    const branchCode = (p.resolved_branch_code || p.branch_code || "").toUpperCase();
    return {
      productId: (p as any).matched_product_id || undefined,
      productName: p.product_name,
      category: branchCodeToCategory(branchCode),
      premium: p.premium_monthly,
      deductible: p.franchise,
      durationYears: undefined,  // not extracted by IA today; user fills if life
      isLamal: isLamal(p),
    };
  });

  // Build notes payload: scan-id traceability + original IA-extracted text
  // (so a future operator can audit the original extraction).
  const traceabilityNote = `Pré-rempli via IA Scan (${scan.id})`;

  // Strip corporate suffixes ("SWICA Assurance-maladie SA" → "SWICA") so the
  // ContractForm's company match doesn't fail on legal-entity variations.
  const companyName = (() => {
    const canon = companyCanonical(first);
    return canon
      ? canon.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
      : first.company || "";
  })();

  return {
    companyName,
    startDate,
    status: options.status || "active",
    notes: traceabilityNote,
    products: prefillProducts,
    lamalPremium,
    lamalFranchise,
    lamalAccidentIncluded,
    hasResiliationToCreate: options.hasResiliation || false,
  };
}

/**
 * Group scanned products by (company, insured person) so we open one
 * ContractForm per coherent unit. This matches how a broker mentally
 * groups contracts: "Marie's Swica package" vs "Pierre's AXA Auto".
 */
export interface ProductGroup {
  /** Unique key for React lists and dedup. */
  key: string;
  /** Display label for the orchestrator UI: "Marie Dupont — Swica". */
  label: string;
  company: string;
  insuredName: string;
  products: ProductDetected[];
}

/** Stable key for grouping insureds across the same person spelled
 *  inconsistently by the IA. Sorted lowercase words + accent strip. */
function insuredCanonical(p: ProductDetected): string {
  const raw = [
    p.insured_person_first_name,
    p.insured_person_last_name,
  ].filter(Boolean).join(" ").trim()
    || (p.insured_person_name || "").trim()
    || "Titulaire";
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

/** Canonical company key that strips corporate suffixes so
 *  "SWICA Assurance-maladie SA" and "SWICA Assurances SA" collapse to
 *  "swica" — the broker sees a single contract with LAMal+LCA bundled. */
function companyCanonical(p: ProductDetected): string {
  let s = (p.company || "Inconnue")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Iteratively strip trailing corporate suffixes
  const suffixes = [
    "sa", "ag", "sarl", "gmbh", "ltd", "limited",
    "assurance", "assurances", "assurance maladie", "assurance-maladie",
    "versicherung", "versicherungen", "insurance", "insurances",
    "holding", "group", "groupe", "gruppe",
    "suisse", "switzerland", "schweiz", "ch",
  ];
  for (let i = 0; i < 6; i++) {
    let stripped = false;
    for (const suffix of suffixes) {
      const re = new RegExp(`\\s${suffix}$`);
      if (re.test(s)) {
        s = s.replace(re, "").trim();
        stripped = true;
      }
    }
    if (!stripped) break;
  }
  return s;
}

export function groupScannedProducts(products: ProductDetected[]): ProductGroup[] {
  if (!products.length) return [];

  const map = new Map<string, ProductGroup>();
  for (const p of products) {
    // Display the canonical (suffix-free) form to the broker so "SWICA"
    // appears once, not "SWICA Assurance-maladie SA" + "SWICA Assurances SA".
    const companyCanon = companyCanonical(p);
    const companyDisplay = companyCanon
      ? companyCanon.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
      : (p.company || "Inconnue").trim();
    const insured = [
      p.insured_person_first_name,
      p.insured_person_last_name,
    ].filter(Boolean).join(" ").trim() || (p.insured_person_name || "").trim() || "Titulaire";

    const key = `${companyCanon}|${insuredCanonical(p)}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        label: `${insured} — ${companyDisplay}`,
        company: companyDisplay,
        insuredName: insured,
        products: [],
      });
    }
    map.get(key)!.products.push(p);
  }
  return Array.from(map.values());
}

/**
 * Check whether the scan itself contains a signed Mandat de gestion.
 * This is the second source of truth for the mandate gate, alongside
 * useClientMandatStatus(clientId) which queries the DB.
 */
export function scanContainsSignedMandat(scan: PendingScan): boolean {
  if (!scan.documents_detected || scan.documents_detected.length === 0) return false;
  return scan.documents_detected.some(
    (d) => d.doc_type === "mandat_gestion" && d.is_signed === true,
  );
}
