import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAuth, requireTenantAccess, AuthError } from "../_shared/auth.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { createLogger } from "../_shared/logger.ts";
import { buildAiError, fetchAiChatCompletions, getAiModel, isAiTimeoutError } from "../_shared/ai.ts";
import { QuotaError, releaseTenantQuota, reserveTenantQuota } from "../_shared/quota.ts";
import { buildChatDocumentContent, normalizeDocumentMimeType } from "../_shared/document-inputs.ts";

const log = createLogger("scan-document");

// Document types we can detect with back-office logic
const DOC_TYPES = [
  'police_active',           // Current active policy
  'ancienne_police',         // Old/previous policy (to replace)
  'nouvelle_police',         // New policy proposal
  'offre',                   // Offer/quote
  'avenant',                 // Policy amendment
  'resiliation',             // Cancellation letter
  'attestation',             // Certificate/attestation
  'mandat_gestion',          // Signed broker mandate (FINMA pre-requisite for any client management)
  'piece_identite',          // ID document (passport, ID card, permit)
  'justificatif_domicile',   // Proof of address
  'bulletin_salaire',        // Salary slip
  'autre'                    // Other document
] as const;

interface WorkflowAction {
  action_type: string;
  priority: 'high' | 'normal' | 'low';
  description: string;
  deadline?: string;
  details?: Record<string, any>;
}

interface DocumentDetected {
  file_name: string;
  file_key?: string;  // Individual file storage key (for batch uploads)
  doc_type: string;
  doc_type_confidence: number;
  description: string;
}

// Represents a single insurance product detected in a proposal/policy
interface ProductDetected {
  product_name: string;           // e.g. "LAMal FAVORIT MEDPHARM", "COMPLETA TOP"
  product_category: string;       // "LAMal" | "LCA" | "VIE" | "NON-VIE" | "LAA" | "LPP"
  company: string;                // Insurance company name
  insured_person_name?: string;
  insured_person_first_name?: string;
  insured_person_last_name?: string;
  insured_person_birthdate?: string;
  premium_monthly?: number;
  premium_yearly?: number;
  franchise?: number;
  start_date?: string;
  end_date?: string;
  policy_number?: string;
  notes?: string;
  // Added for smart product matching
  matched_product_id?: string;
  match_type?: string;
  match_score?: number;
  is_candidate?: boolean;
}

// Represents a family member detected in documents
interface FamilyMemberDetected {
  last_name: string;
  first_name: string;
  birthdate?: string;
  relationship?: string;         // "conjoint" | "enfant" | "parent" | "autre"
  gender?: string;
  has_own_policy?: boolean;      // Does this person have their own policy in the documents?
}

interface ParsedResult {
  dossier_summary?: string;
  documents_detected?: DocumentDetected[];
  // Multi-product support
  products_detected?: ProductDetected[];
  old_products_detected?: ProductDetected[];      // Products from old/terminated policies
  new_products_detected?: ProductDetected[];      // Products from new proposals
  // Family members support
  family_members_detected?: FamilyMemberDetected[];
  primary_holder?: {
    last_name: string;
    first_name: string;
    birthdate?: string;
  };
  has_old_policy?: boolean;
  has_new_policy?: boolean;
  has_termination?: boolean;
  has_identity_doc?: boolean;
  has_multiple_products?: boolean;
  has_family_members?: boolean;
  engagement_analysis?: {
    old_policy_end_date?: string;
    new_policy_start_date?: string;
    termination_deadline?: string;
    is_termination_on_time?: boolean;
    days_until_deadline?: number;
    warnings?: string[];
  };
  inconsistencies?: string[];
  missing_documents?: string[];
  workflow_actions?: WorkflowAction[];
  quality_score: number;
  fields: Array<{
    category: string;
    name: string;
    value: string;
    confidence: 'high' | 'medium' | 'low';
    confidence_score: number;
    source_document?: string;
    notes?: string;
  }>;
}

type ScanFileContent = {
  fileName: string;
  fileKey: string;
  base64: string;
  mimeType: string;
};

type SingleAnalysisSuccess = {
  ok: true;
  file: ScanFileContent;
  result: ParsedResult;
  durationMs: number;
};

type SingleAnalysisFailure = {
  ok: false;
  file: ScanFileContent;
  error: string;
  durationMs: number;
};

type SingleAnalysisOutcome = SingleAnalysisSuccess | SingleAnalysisFailure;

// 35s was too tight on multi-page contract PDFs (Habib's SWICA dossier
// had 3 of 4 files timeout). 70s gives gpt-5-mini enough room for big
// contracts while still bounding worst-case to ~140s with 1 retry.
const DEFAULT_SCAN_DOCUMENT_TIMEOUT_MS = 70000;
const DEFAULT_SCAN_DOCUMENT_CONCURRENCY = 6;
const DEFAULT_PRODUCT_MATCH_CONCURRENCY = 6;

function readPositiveIntegerEnv(
  name: string,
  fallback: number,
  minValue: number,
  maxValue: number,
): number {
  const rawValue = Deno.env.get(name);
  const parsedValue = rawValue ? Number(rawValue) : fallback;

  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.max(minValue, Math.min(maxValue, Math.floor(parsedValue)));
}

function getScanDocumentTimeoutMs(): number {
  return readPositiveIntegerEnv(
    "AI_SCAN_DOCUMENT_TIMEOUT_MS",
    DEFAULT_SCAN_DOCUMENT_TIMEOUT_MS,
    30000,
    110000,
  );
}

function getScanDocumentConcurrency(): number {
  return readPositiveIntegerEnv(
    "AI_SCAN_DOCUMENT_CONCURRENCY",
    DEFAULT_SCAN_DOCUMENT_CONCURRENCY,
    1,
    8,
  );
}

function getProductMatchConcurrency(): number {
  return readPositiveIntegerEnv(
    "PRODUCT_MATCH_CONCURRENCY",
    DEFAULT_PRODUCT_MATCH_CONCURRENCY,
    1,
    12,
  );
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(Array.from({ length: workerCount }, worker));

  return results;
}

// Avoid `String.fromCharCode(...bytes)` on large buffers (causes RangeError: Maximum call stack size exceeded)
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000; // 32KB
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function getOptionalAuth(req: Request): Promise<{ user: { id: string } } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  return await requireAuth(req);
}

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function buildSystemPrompt(fileCount: number): string {
  const today = new Date().toLocaleDateString('fr-CH');
  
  return `Tu es un RESPONSABLE BACK-OFFICE SENIOR d'une compagnie d'assurance suisse. Tu analyses des dossiers clients complets pour vérifier la conformité et extraire toutes les données.

Tu reçois un dossier de ${fileCount} document(s). Tu dois:

## 1. CLASSIFIER CHAQUE DOCUMENT
Pour chaque document, identifie son type parmi:
- police_active: Police d'assurance en cours (à garder)
- ancienne_police: Ancienne police (à résilier/remplacer)
- nouvelle_police: Nouvelle police ou proposition (à activer)
- offre: Offre/devis
- avenant: Avenant de modification
- resiliation: Lettre de résiliation (du client ou de l'assureur)
- attestation: Attestation d'affiliation/couverture
- mandat_gestion: Mandat de courtage / mandat de gestion / mandat d'intermédiation (FR/DE/IT). Signaux: "Mandat de courtage", "Mandat de gestion", "Vollmacht", "Maklervollmacht", "Mandato di intermediazione". DOIT inclure une signature manuscrite ou électronique visible + une date de signature. ⚠️ Pour qu'un mandat soit considéré valide ici, mets is_signed=true UNIQUEMENT si tu vois la signature/date manifestement présente.
- piece_identite: Pièce d'identité (passeport, carte ID, permis de séjour)
- justificatif_domicile: Justificatif de domicile
- bulletin_salaire: Bulletin de salaire
- autre: Autre document

## 2. DÉTECTER **TOUS** LES PRODUITS D'ASSURANCE (CRITIQUE — ZÉRO OUBLI!)

⚠️ RÈGLE ABSOLUE : si tu vois un nom de produit + une prime dans le document, c'est UN produit séparé. Tu DOIS l'extraire dans new_products_detected (ou old_products_detected pour les contrats résiliés / remplacés).

Exemple type d'une proposition Swica complète — tu dois ressortir TOUS ces produits en lignes séparées :
- LAMal FAVORIT MEDPHARM (base obligatoire)   → branch_code=LAMAL, accident_included=true|false
- COMPLETA TOP / COMPLETA FORTE (ambulatoire) → branch_code=LCA
- HOSPITA (hospitalisation commune / demi-privée / privée) → branch_code=LCA
- DENTA (dentaire complémentaire) → branch_code=LCA
- INFORTUNA / Accident complémentaire → branch_code=ACCIDENT

Si la facture liste 5 produits avec 5 primes différentes, ton tableau new_products_detected DOIT contenir EXACTEMENT 5 entrées. Ne fusionne jamais. Ne résume jamais en "Pack complet".

Pour CHAQUE produit, remplis OBLIGATOIREMENT :
- product_name  (nom commercial exact — ex. "COMPLETA FORTE", "HOSPITA commune")
- product_category  (LAMal | LCA | VIE | AUTO | NON-VIE | LAA | LPP | …)
- branch_code   (LAMAL | LCA | VIE | LPP | AUTO | MENAGE_RC | JURIDIQUE | VOYAGE | ENTREPRISE | PGM | ACCIDENT | HYPO_CREDIT)
- company       (nom de la compagnie, ex. "Swica")
- premium_monthly  (prime mensuelle en CHF, nombre)
- franchise     (LAMal/LCA santé seulement : 300/500/1000/1500/2000/2500)
- accident_included  (booléen, OBLIGATOIRE pour les LAMal — true si la couverture accident est incluse, false sinon)
- start_date / end_date / policy_number (si visibles)
- insured_person_name / insured_person_first_name / insured_person_last_name / insured_person_birthdate (l'assuré concerné — un produit par assuré)
- Pour les LCA d'hospitalisation, précise le niveau dans le product_name : "HOSPITA commune", "HOSPITA demi-privée", "HOSPITA privée"

Ne fusionne jamais des produits appartenant à plusieurs assurés dans un seul objet.

⚠️ Avant de finir, vérifie : si tu as vu plusieurs primes mensuelles distinctes dans le document mais qu'il n'y a qu'1 ou 2 entrées dans new_products_detected, c'est que tu en as oublié. Refais le travail.

## 3. DÉTECTER LES MEMBRES DE LA FAMILLE
Si le dossier contient plusieurs personnes (conjoint, enfants):
- Identifier le titulaire principal (primary_holder)
- Lister chaque membre de famille dans "family_members_detected"
- Indiquer si chaque membre a sa propre police ou est sur la police familiale

## 4. VÉRIFIER LES DATES D'ENGAGEMENT
Pour chaque police détectée:
- Date de début et fin
- Durée d'engagement (3e pilier: durée en années)
- Délai de résiliation (3 mois avant fin)
- Si résiliation présente: est-elle dans les délais?

## 5. DÉTECTER LES INCOHÉRENCES
- Comparer anciennes et nouvelles polices
- Vérifier chevauchements de dates
- Signaler doublons potentiels
- Alerter si résiliation hors délai

## 6. EXTRAIRE TOUTES LES INFORMATIONS CLIENT
Depuis TOUS les documents:
- Identité complète (nom, prénom, date naissance, nationalité)
- Coordonnées (adresse, téléphone, email)
- N° AVS, état civil, profession

## BRANCHES D'ASSURANCE (CRITIQUE — pour chaque produit, indique branch_code)

Tu dois TOUJOURS classer chaque produit dans UNE branche parmi cette liste fermée, et la sortir dans le champ "branch_code":

- LAMAL — Assurance maladie OBLIGATOIRE de base (KVG / LAMal)
  Signaux: "obligatoire", "base", "KVG", "LAMal", "loi sur l'assurance-maladie"
  Noms typiques: BASIS, BASE, FAVORIT, FAVORIT MEDPHARM, HMO, TELMED, CASAMED, PREMED, QUALIMED, BENEFIT, MONACA
  Franchise toujours présente: 300/500/1000/1500/2000/2500
  Prime adulte typique: 200-700 CHF/mois
  ⚠️ NE JAMAIS classer un produit LAMal en LCA même si la facture les groupe ensemble.

- LCA — Assurance maladie COMPLÉMENTAIRE (VVG)
  Signaux: "complémentaire", "complementaire", "Zusatz", "VVG"
  Noms typiques: COMPLETA, COMPLETA TOP, HOSPITA, HOSPITA FLEX, MIVITA, DIVERSA, BONUSPLAN, PLENA, SANA TOP
  Couvre: ambulatoire, hospitalisation (commune/demi-privée/privée), dentaire, médecines complémentaires
  Prime souvent < 200 CHF/mois.

- PGM — Indemnités journalières maladie/accident (perte de gain)
- ACCIDENT — LAA obligatoire + complémentaires accident (LAAC)
- VIE — Vie individuelle, 3e pilier A/B, vie risque, vie mixte, rente viagère
- LPP — 2e pilier, prévoyance professionnelle
- AUTO — Véhicules (auto RC, casco partielle/complète, moto, bateau, camping-car)
- MENAGE_RC — RC privée, ménage, bâtiment privé, animaux
- JURIDIQUE — Protection juridique (privée, circulation, entreprise)
- VOYAGE — Voyage, annulation, assistance
- ENTREPRISE — Couvertures PME (RC pro, choses entreprise, pertes d'expl., D&O, cyber, construction, transport)
- HYPO_CREDIT — Hypothèque, crédit personnel, leasing

Délais de résiliation (Suisse):
- LAMAL: résiliation au 30.11 pour effet 01.01
- LCA: variable (1 à 3 mois avant l'échéance)
- AUTO/MENAGE_RC: 3 mois avant l'échéance annuelle

IMPORTANT: Date du jour = ${today}

Réponds UNIQUEMENT en JSON valide:
{
  "dossier_summary": "Résumé en 1-2 phrases",
  "documents_detected": [
    {
      "file_name": "proposition.pdf",
      "doc_type": "nouvelle_police",
      "doc_type_confidence": 0.95,
      "description": "Proposition Swica avec 4 produits"
    },
    {
      "file_name": "mandat-courtage-signe.pdf",
      "doc_type": "mandat_gestion",
      "doc_type_confidence": 0.98,
      "description": "Mandat de courtage signé le 15.03.2026",
      "is_signed": true,
      "signature_date": "2026-03-15"
    }
  ],
  "primary_holder": {
    "last_name": "Dupont",
    "first_name": "Marie",
    "birthdate": "1985-03-15"
  },
  "family_members_detected": [
    {
      "last_name": "Dupont",
      "first_name": "Pierre",
      "birthdate": "1982-07-20",
      "relationship": "conjoint",
      "gender": "M",
      "has_own_policy": true
    },
    {
      "last_name": "Dupont",
      "first_name": "Lucas",
      "birthdate": "2010-11-05",
      "relationship": "enfant",
      "gender": "M",
      "has_own_policy": false
    }
  ],
  "has_family_members": true,
  "has_multiple_products": true,
  "old_products_detected": [
    {
      "product_name": "LAMal BASIS",
      "product_category": "LAMal",
      "company": "Helsana",
      "premium_monthly": 487.05,
      "franchise": 2500,
      "policy_number": "H123456"
    }
  ],
  "new_products_detected": [
    {
      "product_name": "LAMal FAVORIT MEDPHARM",
      "product_category": "LAMal",
      "branch_code": "LAMAL",
      "company": "Swica",
      "insured_person_name": "Marie Dupont",
      "insured_person_first_name": "Marie",
      "insured_person_last_name": "Dupont",
      "insured_person_birthdate": "1985-03-15",
      "premium_monthly": 429.50,
      "franchise": 2500,
      "accident_included": false,
      "start_date": "2024-01-01"
    },
    {
      "product_name": "COMPLETA TOP",
      "product_category": "LCA",
      "branch_code": "LCA",
      "company": "Swica",
      "insured_person_name": "Pierre Dupont",
      "insured_person_first_name": "Pierre",
      "insured_person_last_name": "Dupont",
      "insured_person_birthdate": "1982-07-20",
      "premium_monthly": 85.20,
      "start_date": "2024-01-01"
    },
    {
      "product_name": "HOSPITA FLEX",
      "product_category": "LCA",
      "company": "Swica",
      "insured_person_name": "Pierre Dupont",
      "insured_person_first_name": "Pierre",
      "insured_person_last_name": "Dupont",
      "insured_person_birthdate": "1982-07-20",
      "premium_monthly": 120.00,
      "start_date": "2024-01-01"
    },
    {
      "product_name": "INFORTUNA",
      "product_category": "LAA",
      "company": "Swica",
      "insured_person_name": "Lucas Dupont",
      "insured_person_first_name": "Lucas",
      "insured_person_last_name": "Dupont",
      "insured_person_birthdate": "2010-11-05",
      "premium_monthly": 15.50,
      "start_date": "2024-01-01"
    }
  ],
  "has_old_policy": true,
  "has_new_policy": true,
  "has_termination": true,
  "has_identity_doc": true,
  "engagement_analysis": {
    "old_policy_end_date": "2023-12-31",
    "new_policy_start_date": "2024-01-01",
    "termination_deadline": "2023-09-30",
    "is_termination_on_time": true,
    "days_until_deadline": 0,
    "warnings": []
  },
  "inconsistencies": [],
  "missing_documents": [],
  "workflow_actions": [
    {
      "action_type": "create_termination_suivi",
      "priority": "high",
      "description": "Envoyer résiliation Helsana",
      "deadline": "2023-09-30",
      "details": {"company": "Helsana", "policy_number": "H123456"}
    },
    {
      "action_type": "create_activation_suivi",
      "priority": "normal",
      "description": "Activer 4 produits Swica",
      "deadline": "2024-01-01",
      "details": {"company": "Swica", "products_count": 4}
    }
  ],
  "quality_score": 0.9,
  "fields": [
    {
      "category": "client",
      "name": "nom",
      "value": "Dupont",
      "confidence": "high",
      "confidence_score": 0.95,
      "source_document": "piece_identite.pdf"
    }
  ]
}`;
}

function buildUserPrompt(documentsDescription: string, formType?: string): string {
  return `Analyse ce dossier d'assurance complet${formType ? ` (formulaire ${formType.toUpperCase()})` : ''} et extrait TOUTES les informations.

DOCUMENTS DU DOSSIER:
${documentsDescription}

Champs à extraire et consolider depuis TOUS les documents:

INFORMATIONS CLIENT (priorité aux pièces d'identité):
- nom, prenom, date_naissance, nationalite, etat_civil
- adresse, npa, localite, canton, pays
- telephone, email
- numero_avs, profession, employeur

ANCIENNE POLICE (si présente):
- ancienne_compagnie, ancien_numero_police, ancien_type_produit
- ancienne_date_debut, ancienne_date_fin
- ancienne_prime_mensuelle, ancienne_prime_annuelle
- ancienne_franchise

NOUVELLE POLICE (si présente):
- nouvelle_compagnie, nouveau_numero_police, nouveau_type_produit
- nouvelle_date_debut, nouvelle_date_fin, duree_engagement
- nouvelle_prime_mensuelle, nouvelle_prime_annuelle
- nouvelle_franchise

RÉSILIATION (si présente):
- date_resiliation, motif_resiliation, compagnie_resiliee

IMPORTANT:
- Consolide les informations de TOUS les documents
- Pour chaque produit détecté, précise systématiquement l'assuré concerné avec insured_person_name, insured_person_first_name, insured_person_last_name et insured_person_birthdate si disponible
- Signale les incohérences entre documents
- Vérifie les dates d'engagement et délais de résiliation
- Suggère les actions back-office nécessaires

Retourne UNIQUEMENT le JSON, sans texte additionnel.`;
}

function buildSingleDocumentSystemPrompt(): string {
  const today = new Date().toLocaleDateString('fr-CH');

  return `Back-office assurance suisse — CRM LYTA. Sors UNIQUEMENT du JSON valide.

Tu extrais EXACTEMENT ce qu'il faut pour remplir le CRM:
1. FICHE CLIENT (primary_holder + family_members): tous les champs visibles (nom, prénom, naissance, AVS, sexe, état civil, profession, employeur, permis, nationalité, adresse complète, NPA, localité, canton, téléphone, mobile, email).
2. FICHE CONTRAT (new_products_detected + old_products_detected): toutes les lignes — chaque ligne de prime = un produit séparé. Champs: product_name, branch_code, company, insured_person_first_name, insured_person_last_name, premium_monthly, premium_yearly, franchise (LAMal/LCA), accident_included (LAMal), start_date, end_date, policy_number, notes.
3. DOCUMENTS (documents_detected): un par fichier — doc_type + description + signature/date pour mandat.
4. SUIVIS (suggested_followups): tableau d'événements importants à créer dans le CRM. Format: [{kind: 'resiliation'|'renouvellement'|'anniversaire'|'rappel', label, due_date, notes}]. Ex: si résiliation détectée → kind=resiliation avec due_date = date_resiliation.

Règles:
- Une ligne de prime = un produit. Toujours préciser l'assuré (insured_person_first_name + last_name + birthdate).
- doc_type ∈ {police_active, ancienne_police, nouvelle_police, offre, avenant, resiliation, attestation, mandat_gestion, piece_identite, justificatif_domicile, bulletin_salaire, autre}.
- branch_code ∈ {LAMAL, LCA, PGM, ACCIDENT, VIE, LPP, AUTO, MENAGE_RC, JURIDIQUE, VOYAGE, ENTREPRISE, HYPO_CREDIT}.
- LAMal = base obligatoire (Favorit, BeneFit, KPTwin, BASIS, HMO, Telmed, MyCSS, etc.) → branch_code=LAMAL + accident_included obligatoire.
- LCA = complémentaires (COMPLETA, HOSPITA, NATURA, DENTA, Pulse, MyFlex, etc.).
- family_members: REQUIS first_name ET last_name non vides, sinon ne pas inclure.
- "null" si info pas visible. Aucune valeur inventée.

Date du jour: ${today}

Retourne uniquement un JSON valide avec cette structure:
{
  "dossier_summary": "resume court",
  "documents_detected": [{"file_name":"nom.pdf","doc_type":"offre","doc_type_confidence":0.9,"description":"description courte"}],
  "primary_holder": {"last_name":"Nom","first_name":"Prenom","birthdate":"YYYY-MM-DD"},
  "family_members_detected": [],
  "old_products_detected": [],
  "new_products_detected": [],
  "products_detected": [],
  "has_old_policy": false,
  "has_new_policy": false,
  "has_termination": false,
  "has_identity_doc": false,
  "has_multiple_products": false,
  "has_family_members": false,
  "engagement_analysis": {"warnings":[]},
  "inconsistencies": [],
  "missing_documents": [],
  "workflow_actions": [],
  "quality_score": 0.8,
  "fields": [
    {"category":"client","name":"nom","value":"Dupont","confidence":"high","confidence_score":0.95,"source_document":"nom.pdf"}
  ]
}`;
}

function buildSingleDocumentUserPrompt(
  fileName: string,
  index: number,
  total: number,
  formType?: string,
  catalogContext?: string,
): string {
  return `Fichier ${index + 1}/${total}: ${fileName}.${catalogContext ? `

Catalogue courtier (match EXACT si reconnu):
${catalogContext}` : ""}

Extrais:
- client (depuis identité ou contrat): nom, prenom, date_naissance, adresse, npa, localite, telephone, email
- primary_holder: {last_name, first_name, birthdate}
- family_members_detected: [{last_name, first_name, birthdate, relationship}] — REQUIS: first_name ET last_name non vides
- new_products_detected / old_products_detected: pour CHAQUE ligne de prime → {product_name, branch_code, company, insured_person_first_name, insured_person_last_name, premium_monthly, franchise, accident_included (LAMAL), start_date, end_date, policy_number}

Aucune valeur inventée: null si non visible. JSON uniquement.`;
}

function parseAiAnalysisResponse(aiContent: string, fallbackFileName?: string): ParsedResult {
  let jsonStr = aiContent;
  const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  return normalizeParsedResult(JSON.parse(jsonStr.trim()), fallbackFileName);
}

function ensureArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function normalizeParsedResult(value: unknown, fallbackFileName?: string): ParsedResult {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const rawFields = ensureArray<Record<string, unknown>>(record.fields);
  const fields = rawFields
    .map((field) => {
      const category = typeof field.category === "string" && field.category.trim()
        ? field.category.trim()
        : "general";
      const name = typeof field.name === "string" ? field.name.trim() : "";
      if (!name) return null;

      const rawConfidence = typeof field.confidence === "string" ? field.confidence : "medium";
      const confidence = rawConfidence === "high" || rawConfidence === "medium" || rawConfidence === "low"
        ? rawConfidence
        : "medium";
      const rawScore = typeof field.confidence_score === "number" ? field.confidence_score : 0.5;

      return {
        category,
        name,
        value: field.value === null || field.value === undefined ? "" : String(field.value),
        confidence,
        confidence_score: Math.max(0, Math.min(1, rawScore)),
        source_document: typeof field.source_document === "string" ? field.source_document : fallbackFileName,
        notes: typeof field.notes === "string" ? field.notes : undefined,
      };
    })
    .filter((field): field is ParsedResult["fields"][number] => field !== null);

  const qualityScore = typeof record.quality_score === "number"
    ? Math.max(0, Math.min(1, record.quality_score))
    : 0;

  // ⚠️ Some LLM responses use legacy French-prefixed field names
  // ("nouvelle_compagnie", "nouveau_type_produit", "nouvelle_prime_mensuelle"...)
  // instead of the canonical schema. Normalize them here so downstream code
  // (DB persistence, wizard, ContractForm prefill) always sees the same shape.
  function normalizeProduct(raw: any): ProductDetected {
    if (!raw || typeof raw !== "object") return raw;
    const parseAmount = (v: any): number | undefined => {
      if (typeof v === "number" && isFinite(v)) return v;
      if (typeof v === "string") {
        const cleaned = v.replace(/[^\d.,-]/g, "").replace(/,/g, ".");
        const n = parseFloat(cleaned);
        return isFinite(n) ? n : undefined;
      }
      return undefined;
    };
    return {
      ...raw,
      product_name: raw.product_name ?? raw.nouveau_type_produit ?? raw.type_produit ?? raw.name,
      product_category: raw.product_category ?? raw.categorie_produit ?? raw.category,
      company: raw.company ?? raw.nouvelle_compagnie ?? raw.compagnie,
      premium_monthly: raw.premium_monthly ?? parseAmount(raw.nouvelle_prime_mensuelle) ?? parseAmount(raw.prime_mensuelle),
      premium_yearly: raw.premium_yearly ?? parseAmount(raw.nouvelle_prime_annuelle) ?? parseAmount(raw.prime_annuelle),
      franchise: raw.franchise ?? parseAmount(raw.nouvelle_franchise) ?? parseAmount(raw.franchise_annuelle),
      start_date: raw.start_date ?? raw.nouvelle_date_debut ?? raw.date_debut,
      end_date: raw.end_date ?? raw.nouvelle_date_de_fin ?? raw.date_de_fin ?? raw.date_fin,
      policy_number: raw.policy_number ?? raw.nouveau_numero_police ?? raw.numero_police,
      insured_person_name: raw.insured_person_name ?? raw.nom_assure ?? raw.titulaire,
      insured_person_first_name: raw.insured_person_first_name ?? raw.prenom_assure,
      insured_person_last_name: raw.insured_person_last_name ?? raw.nom_de_famille_assure,
      insured_person_birthdate: raw.insured_person_birthdate ?? raw.date_naissance_assure,
      branch_code: raw.branch_code ?? raw.code_branche,
      accident_included: raw.accident_included ?? raw.accident_inclus,
    };
  }

  return {
    dossier_summary: typeof record.dossier_summary === "string" ? record.dossier_summary : undefined,
    documents_detected: ensureArray<DocumentDetected>(record.documents_detected),
    products_detected: ensureArray<ProductDetected>(record.products_detected).map(normalizeProduct),
    old_products_detected: ensureArray<ProductDetected>(record.old_products_detected).map(normalizeProduct),
    new_products_detected: ensureArray<ProductDetected>(record.new_products_detected).map(normalizeProduct),
    family_members_detected: ensureArray<FamilyMemberDetected>(record.family_members_detected),
    primary_holder: record.primary_holder && typeof record.primary_holder === "object"
      ? record.primary_holder as ParsedResult["primary_holder"]
      : undefined,
    has_old_policy: record.has_old_policy === true,
    has_new_policy: record.has_new_policy === true,
    has_termination: record.has_termination === true,
    has_identity_doc: record.has_identity_doc === true,
    has_multiple_products: record.has_multiple_products === true,
    has_family_members: record.has_family_members === true,
    engagement_analysis: record.engagement_analysis && typeof record.engagement_analysis === "object"
      ? record.engagement_analysis as ParsedResult["engagement_analysis"]
      : undefined,
    inconsistencies: ensureArray<string>(record.inconsistencies).filter((item) => typeof item === "string"),
    missing_documents: ensureArray<string>(record.missing_documents).filter((item) => typeof item === "string"),
    // Accept both names: 'workflow_actions' (legacy) and 'suggested_followups'
    // (new prompt). They map to the same structure.
    workflow_actions: ensureArray<WorkflowAction>(
      record.workflow_actions || record.suggested_followups,
    ),
    quality_score: qualityScore,
    fields,
  };
}

async function analyzeSingleFile(
  fileContent: ScanFileContent,
  index: number,
  total: number,
  formType?: string,
  catalogContext?: string,
): Promise<ParsedResult> {
  const userContent: Record<string, unknown>[] = [
    {
      type: "text",
      text: buildSingleDocumentUserPrompt(fileContent.fileName, index, total, formType, catalogContext),
    },
    buildChatDocumentContent(fileContent),
  ];

  const aiResponse = await fetchAiChatCompletions({
    model: getAiModel(),
    messages: [
      { role: "system", content: buildSingleDocumentSystemPrompt() },
      { role: "user", content: userContent },
    ],
    // gpt-5 is a reasoning model — it spends tokens "thinking" before
    // the visible answer. 2500 was too low: all the budget went to
    // reasoning and the assistant message came back empty.
    // 8000 gives ~5000 for visible content after thinking on small files
    // and still costs less than the previous gpt-5-mini 5000-token call
    // because gpt-5 is cheaper per output token in many tiers.
    max_completion_tokens: 8000,
    temperature: 0.1,
  }, getScanDocumentTimeoutMs());

  if (!aiResponse.ok) {
    const aiError = await buildAiError(aiResponse);
    log.error("AI Gateway error", {
      status: aiResponse.status,
      error: aiError.message,
      fileName: fileContent.fileName,
    });
    throw aiError;
  }

  const aiData = await aiResponse.json();
  const choice = aiData.choices?.[0];
  const aiContent = choice?.message?.content;

  if (!aiContent) {
    // Log enough context to know WHY the model didn't answer (reasoning
    // budget exhausted? safety refusal? truncated?).
    log.error("Empty AI response", {
      fileName: fileContent.fileName,
      finish_reason: choice?.finish_reason,
      refusal: choice?.message?.refusal,
      usage: aiData.usage,
    });
    const reason = choice?.finish_reason === "length"
      ? "réponse coupée (max_tokens atteint)"
      : choice?.message?.refusal
      ? `refus IA: ${choice.message.refusal}`
      : "réponse vide";
    throw new Error(`No response from AI (${reason})`);
  }

  return parseAiAnalysisResponse(aiContent, fileContent.fileName);
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalizedValue = typeof value === "string" ? value.trim() : "";
    if (!normalizedValue) continue;

    const key = normalizedValue.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(normalizedValue);
  }

  return result;
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const key = getKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

function attachFileKeyToDetectedDocuments(result: ParsedResult, file: ScanFileContent): DocumentDetected[] {
  const detectedDocuments = result.documents_detected?.length
    ? result.documents_detected
    : [{
      file_name: file.fileName,
      doc_type: "autre",
      doc_type_confidence: result.quality_score || 0,
      description: result.dossier_summary || "Document analyse automatiquement",
    }];

  return detectedDocuments.map((document) => ({
    ...document,
    file_name: document.file_name || file.fileName,
    file_key: document.file_key || file.fileKey,
    doc_type: document.doc_type || "autre",
    doc_type_confidence: typeof document.doc_type_confidence === "number"
      ? Math.max(0, Math.min(1, document.doc_type_confidence))
      : result.quality_score || 0,
    description: document.description || result.dossier_summary || "Document analyse automatiquement",
  }));
}

function getProductKey(product: ProductDetected): string {
  return [
    product.product_name,
    product.company,
    product.insured_person_name,
    product.start_date,
    product.policy_number,
  ].map((value) => (value || "").trim().toLowerCase()).join("|");
}

function getFamilyMemberKey(member: FamilyMemberDetected): string {
  return [
    member.last_name,
    member.first_name,
    member.birthdate,
  ].map((value) => (value || "").trim().toLowerCase()).join("|");
}

function confidenceRank(confidence: "high" | "medium" | "low"): number {
  if (confidence === "high") return 3;
  if (confidence === "medium") return 2;
  return 1;
}

function mergeFields(successes: SingleAnalysisSuccess[]): ParsedResult["fields"] {
  const fieldsByKey = new Map<string, ParsedResult["fields"][number]>();

  for (const success of successes) {
    for (const field of success.result.fields) {
      const key = `${field.category}:${field.name}`.toLowerCase();
      const nextField = {
        ...field,
        source_document: field.source_document || success.file.fileName,
      };
      const existingField = fieldsByKey.get(key);

      if (!existingField) {
        fieldsByKey.set(key, nextField);
        continue;
      }

      const existingValue = (existingField.value || "").trim();
      const nextValue = (nextField.value || "").trim();
      const valuesConflict =
        existingValue &&
        nextValue &&
        existingValue.toLowerCase() !== nextValue.toLowerCase();

      if (valuesConflict) {
        const conflictNote = `Autre valeur detectee dans ${nextField.source_document}: ${nextValue}`;
        existingField.notes = [existingField.notes, conflictNote].filter(Boolean).join(" | ");
        existingField.confidence = existingField.confidence === "low" ? "low" : "medium";
        existingField.confidence_score = Math.min(existingField.confidence_score, 0.7);
      }

      const shouldReplace =
        (!existingValue && nextValue) ||
        nextField.confidence_score > existingField.confidence_score + 0.05 ||
        (
          nextField.confidence_score === existingField.confidence_score &&
          confidenceRank(nextField.confidence) > confidenceRank(existingField.confidence)
        );

      if (shouldReplace) {
        fieldsByKey.set(key, {
          ...nextField,
          notes: [nextField.notes, existingField.notes].filter(Boolean).join(" | ") || undefined,
        });
      }
    }
  }

  return Array.from(fieldsByKey.values());
}

function mergeEngagementAnalysis(successes: SingleAnalysisSuccess[]): ParsedResult["engagement_analysis"] | undefined {
  const analyses = successes
    .map((success) => success.result.engagement_analysis)
    .filter((analysis): analysis is NonNullable<ParsedResult["engagement_analysis"]> => Boolean(analysis));

  if (analyses.length === 0) {
    return undefined;
  }

  const firstWith = <K extends keyof NonNullable<ParsedResult["engagement_analysis"]>>(key: K) =>
    analyses.find((analysis) => analysis[key] !== undefined)?.[key];

  return {
    old_policy_end_date: firstWith("old_policy_end_date") as string | undefined,
    new_policy_start_date: firstWith("new_policy_start_date") as string | undefined,
    termination_deadline: firstWith("termination_deadline") as string | undefined,
    is_termination_on_time: firstWith("is_termination_on_time") as boolean | undefined,
    days_until_deadline: firstWith("days_until_deadline") as number | undefined,
    warnings: uniqueStrings(analyses.flatMap((analysis) => analysis.warnings || [])),
  };
}

function mergeParsedResults(outcomes: SingleAnalysisOutcome[]): ParsedResult {
  const successes = outcomes.filter((outcome): outcome is SingleAnalysisSuccess => outcome.ok);
  const failures = outcomes.filter((outcome): outcome is SingleAnalysisFailure => !outcome.ok);

  if (successes.length === 0) {
    throw new Error(failures[0]?.error || "No documents could be analyzed");
  }

  const documentsDetected = successes.flatMap((success) =>
    attachFileKeyToDetectedDocuments(success.result, success.file)
  );
  const documentTypes = documentsDetected.map((document) => (document.doc_type || "").toLowerCase());
  const oldProducts = uniqueBy(
    successes.flatMap((success) => success.result.old_products_detected || []),
    getProductKey,
  );
  const newProducts = uniqueBy(
    successes.flatMap((success) => success.result.new_products_detected || []),
    getProductKey,
  );
  const genericProducts = uniqueBy(
    successes.flatMap((success) => success.result.products_detected || []),
    getProductKey,
  );
  const familyMembers = uniqueBy(
    successes.flatMap((success) => success.result.family_members_detected || []),
    getFamilyMemberKey,
  );
  const totalProducts = oldProducts.length + newProducts.length + genericProducts.length;
  const qualityScores = successes
    .map((success) => success.result.quality_score)
    .filter((score) => typeof score === "number" && Number.isFinite(score));
  const qualityScore = qualityScores.length > 0
    ? qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length
    : 0;
  // Build the primary_holder by merging fragments across all files: identity
  // doc gives name + DOB + nationality, contract may add address/phone, etc.
  // First non-null wins per field — never lose info that was extracted somewhere.
  const primaryHolderSource = (() => {
    const allHolders = successes
      .map((s) => s.result.primary_holder)
      .filter((h): h is NonNullable<typeof h> => Boolean(h));
    if (allHolders.length === 0) return undefined;
    // Prefer the one from an identity doc as base (most authoritative on name+DOB)
    const idBased = successes.find((s) => s.result.has_identity_doc && s.result.primary_holder)?.result.primary_holder;
    const base: any = { ...(idBased || allHolders[0]) };
    for (const h of allHolders) {
      for (const k of Object.keys(h as any)) {
        if (base[k] == null || base[k] === "") {
          base[k] = (h as any)[k];
        }
      }
    }
    return base;
  })();
  const summaries = uniqueStrings(successes.map((success) => success.result.dossier_summary));
  const failureMessages = failures.map((failure) =>
    `Analyse IA non terminee pour ${failure.file.fileName}: ${failure.error}`
  );

  return {
    dossier_summary: [
      `${successes.length}/${outcomes.length} fichier(s) analyses.`,
      summaries.slice(0, 3).join(" "),
      failures.length > 0 ? `${failures.length} fichier(s) a verifier manuellement.` : "",
    ].filter(Boolean).join(" "),
    documents_detected: documentsDetected,
    products_detected: genericProducts,
    old_products_detected: oldProducts,
    new_products_detected: newProducts,
    family_members_detected: familyMembers,
    primary_holder: primaryHolderSource,
    has_old_policy: successes.some((success) => success.result.has_old_policy) ||
      oldProducts.length > 0 ||
      documentTypes.some((type) => type === "ancienne_police" || type === "police_active"),
    has_new_policy: successes.some((success) => success.result.has_new_policy) ||
      newProducts.length > 0 ||
      documentTypes.some((type) => type === "nouvelle_police" || type === "offre"),
    has_termination: successes.some((success) => success.result.has_termination) ||
      documentTypes.includes("resiliation"),
    has_identity_doc: successes.some((success) => success.result.has_identity_doc) ||
      documentTypes.includes("piece_identite"),
    has_multiple_products: successes.some((success) => success.result.has_multiple_products) ||
      totalProducts > 1,
    has_family_members: successes.some((success) => success.result.has_family_members) ||
      familyMembers.length > 0,
    engagement_analysis: mergeEngagementAnalysis(successes),
    inconsistencies: uniqueStrings([
      ...successes.flatMap((success) => success.result.inconsistencies || []),
      ...failureMessages,
    ]),
    missing_documents: uniqueStrings(successes.flatMap((success) => success.result.missing_documents || [])),
    workflow_actions: successes.flatMap((success) => success.result.workflow_actions || []),
    quality_score: qualityScore,
    fields: mergeFields(successes),
  };
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Clone early: `req.json()` consumes the body; cloning later throws `Body is unusable`
  const reqForErrorHandling = req.clone();
  let scanIdForErrorHandling: string | undefined;
  let supabase: ReturnType<typeof createClient> | null = null;
  let validTenantId: string | null = null;
  let reservedTenantId: string | null = null;
  let reservedAmount = 0;

  const startTime = Date.now();

  try {
    const authContext = await getOptionalAuth(req);

    // Rate limit: 10 requests per hour per IP (scan is expensive — AI vision costs)
    await checkRateLimit(req, "scan-document", 10);

    const body = await req.json();
    const { scanId, formType, tenantId, batchMode, files, fileKey, fileName, mimeType, verifiedPartnerEmail, verifiedPartnerId } = body;

    scanIdForErrorHandling = scanId;

    if (!scanId) {
      throw new Error("Missing required parameter: scanId");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify scan exists and authorize either an authenticated CRM user or a verified public deposit.
    const { data: existingScan, error: scanCheckError } = await supabase
      .from("document_scans")
      .select("id, tenant_id, source_type, verified_partner_email, verified_partner_id")
      .eq("id", scanId)
      .maybeSingle();

    if (scanCheckError || !existingScan) {
      throw new Error(`Scan not found: ${scanId}`);
    }

    if (authContext?.user) {
      if (existingScan.tenant_id) {
        await requireTenantAccess(authContext.user.id, existingScan.tenant_id);
      }
    } else {
      const requestPartnerEmail = normalizeEmail(verifiedPartnerEmail);
      const scanPartnerEmail = normalizeEmail(existingScan.verified_partner_email);
      const requestPartnerId = typeof verifiedPartnerId === "string" ? verifiedPartnerId : "";
      const scanPartnerId = typeof existingScan.verified_partner_id === "string" ? existingScan.verified_partner_id : "";
      const partnerMatches = requestPartnerEmail && requestPartnerEmail === scanPartnerEmail
        && (!scanPartnerId || requestPartnerId === scanPartnerId);

      if (existingScan.source_type !== "deposit" || !partnerMatches) {
        throw new AuthError("Missing or invalid authorization header", 401);
      }
    }

    validTenantId = existingScan.tenant_id || null;

    const { error: processingUpdateError } = await supabase
      .from("document_scans")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", scanId);

    if (processingUpdateError) {
      throw new Error(`Unable to update scan status: ${processingUpdateError.message}`);
    }

    // Determine files to process
    const filesToProcess: { path: string; fileName: string; mimeType: string }[] = batchMode && files 
      ? files 
      : [{ path: fileKey, fileName, mimeType }];

    log.info("Processing files", { count: filesToProcess.length, mode: batchMode ? "batch" : "single", scanId });

    if (validTenantId) {
      reservedAmount = filesToProcess.length;
      await reserveTenantQuota(supabase, validTenantId, "ai_docs", reservedAmount);
      reservedTenantId = validTenantId;
    } else if (tenantId) {
      log.warn("Scan has no tenant_id, skipping quota enforcement", { tenantId });
    }

    const concurrency = getScanDocumentConcurrency();

    // Download and encode files in parallel - preserve file_key for document mapping.
    const downloadResults = await mapWithConcurrency(filesToProcess, concurrency, async (fileInfo) => {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("documents")
        .download(fileInfo.path);

      if (downloadError || !fileData) {
        log.error(`Failed to download file`, { fileName: fileInfo.fileName, error: downloadError?.message });
        return null;
      }

      const arrayBuffer = await fileData.arrayBuffer();
      const base64File = arrayBufferToBase64(arrayBuffer);
      
      return {
        fileName: fileInfo.fileName,
        fileKey: fileInfo.path,  // Preserve the storage path for document mapping
        base64: base64File,
        mimeType: normalizeDocumentMimeType(fileInfo.fileName, fileInfo.mimeType)
      };
    });

    const fileContents: ScanFileContent[] = downloadResults
      .filter((file): file is ScanFileContent => Boolean(file));

    if (fileContents.length === 0) {
      throw new Error("No files could be processed");
    }

    if (supabase && reservedTenantId && reservedAmount > fileContents.length) {
      await releaseTenantQuota(supabase, reservedTenantId, "ai_docs", reservedAmount - fileContents.length);
      reservedAmount = fileContents.length;
    }

    // Build a compact catalog snapshot to feed the IA so it matches scanned
    // products against the broker's actual catalog (not an invented label).
    // ⚠️ Token budget: top 80 products only, grouped by company. We trust the
    // server-side find_product_by_alias to do the final fuzzy match anyway.
    let catalogContext = "";
    if (supabase && validTenantId) {
      try {
        const { data: catalogRows } = await supabase
          .from("insurance_products")
          .select(`
            name,
            company:insurance_companies!insurance_products_company_id_fkey ( name ),
            tenant_branch:tenant_branches ( code, name )
          `)
          .or(`tenant_id.eq.${validTenantId},tenant_id.is.null`)
          .eq("is_active", true)
          .eq("status", "active")
          .limit(200);

        if (Array.isArray(catalogRows) && catalogRows.length > 0) {
          // Group by company → list product names + branch code
          const grouped = new Map<string, string[]>();
          for (const row of catalogRows as any[]) {
            const company = row.company?.name || "";
            const branchCode = row.tenant_branch?.code || "";
            if (!company || !row.name) continue;
            if (!grouped.has(company)) grouped.set(company, []);
            const label = branchCode ? `${row.name} [${branchCode}]` : row.name;
            grouped.get(company)!.push(label);
          }
          const lines: string[] = [];
          for (const [company, products] of grouped) {
            lines.push(`- ${company}: ${products.slice(0, 12).join(", ")}`);
          }
          catalogContext = lines.join("\n");
        }
      } catch (e) {
        log.warn("Failed to build catalog context for IA prompt", { error: String(e) });
      }
    }

    // Analyze each file independently and in parallel, then merge results.
    const analysisResults = await mapWithConcurrency(fileContents, concurrency, async (fileContent, index): Promise<SingleAnalysisOutcome> => {
      const fileStartTime = Date.now();
      let lastErr: unknown = null;

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const result = await analyzeSingleFile(fileContent, index, fileContents.length, formType, catalogContext);
          if (attempt > 1) {
            log.info("File analysis succeeded on retry", { fileName: fileContent.fileName, attempt });
          }
          return {
            ok: true,
            file: fileContent,
            result,
            durationMs: Date.now() - fileStartTime,
          };
        } catch (fileError) {
          lastErr = fileError;
          const msg = fileError instanceof Error ? fileError.message : String(fileError);
          // Retry only when it makes sense (timeout / rate-limit / 5xx).
          const retryable = isAiTimeoutError(fileError)
            || /timeout|rate limit|429|503|temporarily/i.test(msg);
          if (attempt < 2 && retryable) {
            log.warn("Retrying file analysis", { fileName: fileContent.fileName, msg, attempt });
            // Small backoff before retrying
            await new Promise((res) => setTimeout(res, 1500));
            continue;
          }
          log.error("Failed to analyze file (final)", {
            scanId,
            fileName: fileContent.fileName,
            error: msg,
            attempts: attempt,
          });
          break;
        }
      }

      const errorMessage = lastErr instanceof Error ? lastErr.message : String(lastErr);
      return {
        ok: false,
        file: fileContent,
        error: errorMessage,
        durationMs: Date.now() - fileStartTime,
      };
    });

    const parsedResult = mergeParsedResults(analysisResults);

    log.info("AI file analysis completed", {
      scanId,
      files: fileContents.length,
      success: analysisResults.filter((result) => result.ok).length,
      failed: analysisResults.filter((result) => !result.ok).length,
      durationsMs: analysisResults.map((result) => ({
        fileName: result.file.fileName,
        durationMs: result.durationMs,
        ok: result.ok,
      })),
    });

    // ============================================
    // MAP FILE KEYS TO DOCUMENTS DETECTED
    // ============================================
    // When processing multiple files, map file_key from uploaded files to documents detected by AI
    if (parsedResult.documents_detected && parsedResult.documents_detected.length > 0) {
      parsedResult.documents_detected = parsedResult.documents_detected.map((doc, index) => {
        // Try to match by file_name first
        const matchedFile = fileContents.find(f => 
          f.fileName.toLowerCase() === doc.file_name?.toLowerCase() ||
          f.fileName.toLowerCase().includes(doc.file_name?.toLowerCase() || '') ||
          doc.file_name?.toLowerCase().includes(f.fileName.toLowerCase())
        );
        
        if (matchedFile) {
          return { ...doc, file_key: matchedFile.fileKey };
        }
        
        // Fallback: use index-based mapping if same count
        if (fileContents.length === parsedResult.documents_detected!.length && fileContents[index]) {
          return { ...doc, file_key: fileContents[index].fileKey };
        }
        
        // Ultimate fallback: use first file if single file uploaded (multi-page PDF scenario)
        if (fileContents.length === 1) {
          return { ...doc, file_key: fileContents[0].fileKey };
        }
        
        return doc;
      });
      
      log.info('Documents mapped with file_keys', {
        documents: parsedResult.documents_detected.map(d => ({
          file_name: d.file_name,
          file_key: d.file_key,
          doc_type: d.doc_type,
        })),
      });
    }

    // ============================================
    // SMART PRODUCT MATCHING
    // ============================================
    // For each detected product, try to match with existing catalog
    // If no match found, create a candidate product
    
    const allDetectedProducts = [
      ...(parsedResult.new_products_detected || []),
      ...(parsedResult.old_products_detected || []),
      ...(parsedResult.products_detected || [])
    ];
    const productsToMatch = allDetectedProducts.filter((product) =>
      product.product_name && product.product_name.toLowerCase() !== 'autres assurances'
    );

    // Smart branch resolver: prefer IA's branch_code, fallback to name heuristics.
    // This is the structural fix for the LAMal-vs-LCA misclassification bug.
    function resolveBranchCode(p: any): string {
      const raw = (p.branch_code || '').toString().toUpperCase().trim();
      const ALLOWED = ['LAMAL','LCA','PGM','ACCIDENT','VIE','LPP','AUTO','MENAGE_RC','JURIDIQUE','VOYAGE','ENTREPRISE','HYPO_CREDIT'];
      if (ALLOWED.includes(raw)) return raw;

      const name = (p.product_name || '').toLowerCase();
      const cat = (p.product_category || '').toLowerCase();

      // LAMal detection (priority over any LCA classification)
      if (/(lamal|kvg|favorit|medpharm|telmed|casamed|premed|qualimed|monaca|hmo|^basis|^base)/i.test(name)) return 'LAMAL';
      if (cat === 'lamal') return 'LAMAL';

      if (cat === 'lca' || /complement|compl[eé]|hospita|completa|sana top|mivita|diversa|bonusplan|plena/i.test(name)) return 'LCA';
      if (cat === 'vie' || cat.includes('3') || cat.includes('pilier') || cat === 'lpp' || /pilier|3a|3b|swiss life|prévoyance|prevoyance/i.test(name)) {
        return cat === 'lpp' ? 'LPP' : 'VIE';
      }
      if (cat === 'laa' || cat === 'accident' || /accident|laa|infortuna/i.test(name)) return 'ACCIDENT';
      if (cat.includes('pgm') || /indemnité|indemnite|perte de gain|krankentaggeld/i.test(name)) return 'PGM';
      if (/(auto|casco|moto|bateau|camping)/i.test(name)) return 'AUTO';
      if (/(menage|ménage|inventaire|rc priv)/i.test(name)) return 'MENAGE_RC';
      if (/(juridique|protek|orion|legal)/i.test(name)) return 'JURIDIQUE';
      if (/(voyage|annulation|assistance|travel)/i.test(name)) return 'VOYAGE';
      if (cat.includes('hypo') || cat.includes('crédit') || cat.includes('credit') || /(hypo|crédit|credit|leasing)/i.test(name)) return 'HYPO_CREDIT';
      return 'MENAGE_RC';
    }

    // Map branch_code → main_category enum (legacy) for create_candidate_product RPC
    function branchCodeToLegacyMainCategory(code: string): string {
      if (code === 'VIE' || code === 'LPP') return 'VIE';
      if (code === 'LCA' || code === 'LAMAL' || code === 'PGM') return 'LCA';
      if (code === 'HYPO_CREDIT') return 'HYPO';
      return 'NON_VIE';
    }

    // Resolve tenant_branch_id once per scan
    let tenantBranchByCode: Record<string, string> = {};
    if (validTenantId) {
      const { data: branchRows } = await supabase
        .from('tenant_branches')
        .select('id, code')
        .eq('tenant_id', validTenantId);
      if (Array.isArray(branchRows)) {
        tenantBranchByCode = Object.fromEntries(branchRows.map((b: any) => [b.code, b.id]));
      }
    }

    const productMatchResults = await mapWithConcurrency(productsToMatch, getProductMatchConcurrency(), async (product) => {
      try {
        // Resolve branch up-front so it's available for both match and candidate paths
        const resolvedBranchCode = resolveBranchCode(product);
        const resolvedBranchId = tenantBranchByCode[resolvedBranchCode] || null;
        product.resolved_branch_code = resolvedBranchCode;
        product.resolved_branch_id = resolvedBranchId;

        // Try to find a matching product using fuzzy matching
        const { data: matches, error: matchError } = await supabase.rpc('find_product_by_alias', {
          search_term: product.product_name,
          company_name: product.company || null,
          category_hint: product.product_category || null
        });

        if (matchError) {
          log.error('Product matching error', { matchError });
        }

        if (matches && matches.length > 0) {
          // Found a match! Use the best one
          const bestMatch = matches[0];
          product.matched_product_id = bestMatch.product_id;
          product.match_type = bestMatch.match_type;
          product.match_score = parseFloat(bestMatch.match_score);
          product.is_candidate = false;

          log.info(`Matched "${product.product_name}" → "${bestMatch.product_name}" (${bestMatch.match_type}, score: ${bestMatch.match_score}, branch: ${resolvedBranchCode})`);

          // If matched product has no tenant_branch_id yet, backfill it now.
          if (resolvedBranchId) {
            const { data: prodRow } = await supabase
              .from('insurance_products')
              .select('tenant_branch_id')
              .eq('id', bestMatch.product_id)
              .maybeSingle();
            if (prodRow && !prodRow.tenant_branch_id) {
              await supabase
                .from('insurance_products')
                .update({ tenant_branch_id: resolvedBranchId })
                .eq('id', bestMatch.product_id);
            }
          }
        } else {
          // No match found - create a candidate product
          log.info(`No match for "${product.product_name}" - creating candidate product (branch: ${resolvedBranchCode})`);

          const mainCategory = branchCodeToLegacyMainCategory(resolvedBranchCode);

          // Pass tenant_id + tenant_branch_id so the new product is created
          // ACTIVE in the tenant's Partenaires catalog (broker sees it
          // immediately and can reuse it on future contracts).
          const { data: candidateId, error: candidateError } = await supabase.rpc('create_candidate_product', {
            p_detected_name: product.product_name,
            p_company_name: product.company || null,
            p_main_category: mainCategory,
            p_subcategory: resolvedBranchCode === 'LAMAL' ? 'lamal' : null,
            p_scan_id: scanId,
            p_tenant_id: validTenantId,
            p_tenant_branch_id: resolvedBranchId,
          });

          if (candidateError) {
            log.error('Failed to create candidate product', { candidateError });
          } else if (candidateId) {
            product.matched_product_id = candidateId;
            product.match_type = 'candidate';
            product.match_score = 0;
            product.is_candidate = true;

            log.info(`Created ACTIVE product: ${candidateId} for "${product.product_name}" → tenant=${validTenantId}, branch=${resolvedBranchCode}`);
          }
        }

        return {
          ok: true as const,
          product,
        };
      } catch (e) {
        log.error(`Error matching product "${product.product_name}"`, { error: e });
        return {
          ok: false as const,
          product,
        };
      }
    });

    const matchedProducts = productMatchResults.map((result) => result.product);
    const productMatchFailures = productMatchResults.filter((result) => !result.ok).length;

    // Update parsed result with matched products
    if (parsedResult.new_products_detected) {
      parsedResult.new_products_detected = parsedResult.new_products_detected.map(p => {
        const matched = matchedProducts.find(m => m.product_name === p.product_name);
        return matched || p;
      });
    }
    if (parsedResult.old_products_detected) {
      parsedResult.old_products_detected = parsedResult.old_products_detected.map(p => {
        const matched = matchedProducts.find(m => m.product_name === p.product_name);
        return matched || p;
      });
    }
    if (parsedResult.products_detected) {
      parsedResult.products_detected = parsedResult.products_detected.map(p => {
        const matched = matchedProducts.find(m => m.product_name === p.product_name);
        return matched || p;
      });
    }

    // Count candidate products for notification
    const candidateCount = matchedProducts.filter(p => p.is_candidate).length;
    
    // ============================================
    // END SMART PRODUCT MATCHING
    // ============================================

    // Calculate overall confidence
    const confidenceScores = parsedResult.fields.map(f => f.confidence_score);
    const overallConfidence = confidenceScores.length > 0
      ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length
      : 0;

    const processingTime = Date.now() - startTime;

    // Determine main document type from detected documents
    const mainDocType = parsedResult.documents_detected?.[0]?.doc_type || 'autre';

    // Update scan record with results — including the structured AI output
    // (documents_detected, new/old_products_detected, family, summary, …).
    // These columns are required for the Smartflow wizard to surface detected
    // contracts; without them the broker only saw the client form but no
    // products to materialise.
    const { error: updateError } = await supabase
      .from("document_scans")
      .update({
        status: "completed",
        detected_doc_type: mainDocType,
        doc_type_confidence: parsedResult.documents_detected?.[0]?.doc_type_confidence || 0,
        quality_score: parsedResult.quality_score,
        overall_confidence: overallConfidence,
        ocr_required: true,
        processing_time_ms: processingTime,
        ai_model_used: getAiModel(),
        updated_at: new Date().toISOString(),
        // === structured AI output ===
        dossier_summary: parsedResult.dossier_summary ?? null,
        documents_detected: parsedResult.documents_detected ?? [],
        new_products_detected: parsedResult.new_products_detected ?? [],
        old_products_detected: parsedResult.old_products_detected ?? [],
        family_members_detected: parsedResult.family_members_detected ?? [],
        primary_holder: parsedResult.primary_holder ?? null,
        has_multiple_products: !!parsedResult.has_multiple_products
          || ((parsedResult.new_products_detected?.length ?? 0)
              + (parsedResult.old_products_detected?.length ?? 0)) > 1,
        has_family_members: !!parsedResult.has_family_members
          || (parsedResult.family_members_detected?.length ?? 0) > 0,
        has_old_policy: (parsedResult.old_products_detected?.length ?? 0) > 0,
        has_new_policy: (parsedResult.new_products_detected?.length ?? 0) > 0,
        has_termination: !!parsedResult.documents_detected?.some(
          (d: any) => d?.doc_type === "resiliation",
        ),
        engagement_analysis: (parsedResult as any).engagement_analysis ?? null,
        workflow_actions: (parsedResult as any).workflow_actions ?? [],
      })
      .eq("id", scanId);

    if (updateError) {
      log.error("Failed to update scan", { updateError });
    }

    // Insert extracted fields
    const fieldsToInsert = parsedResult.fields.map(field => ({
      scan_id: scanId,
      field_category: field.category,
      field_name: field.name,
      extracted_value: field.value,
      confidence: field.confidence,
      confidence_score: field.confidence_score,
      extraction_notes: [
        field.source_document ? `Source: ${field.source_document}` : null,
        field.notes
      ].filter(Boolean).join(' | ') || null,
    }));

    if (fieldsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("document_scan_results")
        .insert(fieldsToInsert);

      if (insertError) {
        log.error("Failed to insert results", { insertError });
      }
    }

    // Create audit log with full analysis data
    await supabase.rpc("create_scan_audit_log", {
      p_scan_id: scanId,
      p_action: "extracted",
      p_ai_snapshot: {
        ...parsedResult,
        batch_mode: batchMode,
        files_count: fileContents.length
      },
    });

    // Get scan record to get partner email
    const { data: scanData } = await supabase
      .from("document_scans")
      .select("verified_partner_email, source_form_type")
      .eq("id", scanId)
      .single();

    // Send notification to tenant admins with enhanced info
    if (validTenantId) {
      const { data: tenantAdmins } = await supabase
        .from("user_tenant_roles")
        .select("user_id")
        .eq("tenant_id", validTenantId)
        .eq("role", "admin");

      const { data: globalAdmins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      const adminUserIds = new Set<string>();
      tenantAdmins?.forEach(a => adminUserIds.add(a.user_id));
      
      if (globalAdmins) {
        for (const admin of globalAdmins) {
          const { data: hasTenantAccess } = await supabase
            .from("user_tenant_roles")
            .select("id")
            .eq("user_id", admin.user_id)
            .eq("tenant_id", validTenantId)
            .maybeSingle();

          if (hasTenantAccess) {
            adminUserIds.add(admin.user_id);
          }
        }
      }

      const adminUsers = Array.from(adminUserIds).map(user_id => ({ user_id }));

      if (adminUsers.length > 0) {
        const fieldsSummary = parsedResult.fields.map(f => ({
          name: f.name,
          value: f.value,
          confidence: f.confidence,
          category: f.category,
        }));

        const lowConfidenceCount = parsedResult.fields.filter(f => f.confidence === 'low').length;
        const mediumConfidenceCount = parsedResult.fields.filter(f => f.confidence === 'medium').length;
        const hasTermination = parsedResult.has_termination;
        const hasOldPolicy = parsedResult.has_old_policy;
        const hasNewPolicy = parsedResult.has_new_policy;
        const warnings = parsedResult.engagement_analysis?.warnings || [];

        // Build rich notification message
        let notifTitle = `📄 Nouveau dépôt à valider`;
        let notifMessage = `${fileContents.length} doc(s) - ${parsedResult.fields.length} champs extraits`;

        if (hasTermination) {
          notifTitle = `🚨 Dépôt avec RÉSILIATION à traiter`;
          notifMessage = `Résiliation détectée. ${warnings.length > 0 ? warnings[0] : 'Vérifier les délais.'}`;
        } else if (hasOldPolicy && hasNewPolicy) {
          notifTitle = `🔄 Changement de police à valider`;
          notifMessage = `Remplacement détecté: ancienne → nouvelle police. ${parsedResult.fields.length} champs.`;
        }

        const notifications = adminUsers.map(admin => ({
          user_id: admin.user_id,
          tenant_id: validTenantId,
          kind: 'new_contract',
          priority: hasTermination || lowConfidenceCount > 2 ? 'high' : 'normal',
          title: notifTitle,
          message: notifMessage,
          payload: {
            scan_id: scanId,
            form_type: formType,
            partner_email: scanData?.verified_partner_email,
            dossier_summary: parsedResult.dossier_summary,
            documents_detected: parsedResult.documents_detected,
            has_old_policy: hasOldPolicy,
            has_new_policy: hasNewPolicy,
            has_termination: hasTermination,
            has_identity_doc: parsedResult.has_identity_doc,
            engagement_analysis: parsedResult.engagement_analysis,
            workflow_actions: parsedResult.workflow_actions,
            inconsistencies: parsedResult.inconsistencies || [],
            missing_documents: parsedResult.missing_documents || [],
            documents_count: fileContents.length,
            fields_count: parsedResult.fields.length,
            low_confidence_count: lowConfidenceCount,
            medium_confidence_count: mediumConfidenceCount,
            quality_score: parsedResult.quality_score,
            fields_preview: fieldsSummary.slice(0, 15),
          },
          action_url: `/crm/propositions?scan=${scanId}`,
          action_label: hasTermination ? 'Traiter la résiliation' : 'Valider le dépôt',
        }));

        const { error: notifError } = await supabase
          .from("notifications")
          .insert(notifications);

        if (notifError) {
          log.error("Failed to create admin notifications", { notifError });
        } else {
          log.info(`Sent notifications to ${adminUsers.length} admin(s) for scan ${scanId}`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        scanId,
        documentType: mainDocType,
        documentTypeConfidence: parsedResult.documents_detected?.[0]?.doc_type_confidence || 0,
        dossierSummary: parsedResult.dossier_summary,
        documentsDetected: parsedResult.documents_detected,
        hasOldPolicy: parsedResult.has_old_policy,
        hasNewPolicy: parsedResult.has_new_policy,
        hasTermination: parsedResult.has_termination,
        hasIdentityDoc: parsedResult.has_identity_doc,
        engagementAnalysis: parsedResult.engagement_analysis,
        workflowActions: parsedResult.workflow_actions,
        inconsistencies: parsedResult.inconsistencies || [],
        missingDocuments: parsedResult.missing_documents || [],
        qualityScore: parsedResult.quality_score,
        overallConfidence,
        documentsProcessed: fileContents.length,
        fieldsExtracted: fieldsToInsert.length,
        processingTimeMs: processingTime,
        ...(productMatchFailures > 0 ? { productMatchFailures } : {}),
      }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error) {
    if (supabase && reservedTenantId && reservedAmount > 0) {
      await releaseTenantQuota(supabase, reservedTenantId, "ai_docs", reservedAmount);
      reservedTenantId = null;
      reservedAmount = 0;
    }

    if (error instanceof AuthError) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: error.status, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    if (error instanceof RateLimitError) {
      return new Response(
        JSON.stringify({ error: "Trop de requêtes. Veuillez patienter avant de relancer un scan." }),
        {
          status: 429,
          headers: {
            ...getCorsHeaders(req),
            "Content-Type": "application/json",
            "Retry-After": String(error.retryAfter),
          },
        }
      );
    }

    if (error instanceof QuotaError) {
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: error.status,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    log.error("Scan document error", { error: error instanceof Error ? error.message : String(error) });

    // Handle AI request timeout
    if (isAiTimeoutError(error)) {
      return new Response(
        JSON.stringify({ error: "AI analysis timed out after 120 seconds" }),
        { status: 504, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Try to update scan status to failed
    try {
      let scanIdToUpdate = scanIdForErrorHandling;
      if (!scanIdToUpdate) {
        try {
          const maybeBody = await reqForErrorHandling.json();
          scanIdToUpdate = maybeBody?.scanId;
        } catch {
          // ignore: body might not be valid JSON
        }
      }

      if (scanIdToUpdate) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        await supabase
          .from("document_scans")
          .update({
            status: "failed",
            error_message: error instanceof Error ? error.message : "Unknown error",
            updated_at: new Date().toISOString(),
          })
          .eq("id", scanIdToUpdate);
      }
    } catch (e) {
      log.error("Failed to update scan status", { error: e });
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
