/**
 * librePassageDetect — Détection unifiée des produits LPP / libre passage
 * / 2e pilier / prévoyance professionnelle.
 *
 * Pourquoi ce helper : avant, la même regex était dupliquée dans 5 fichiers :
 *   - ContractForm.tsx
 *   - ScanBatchReview.tsx
 *   - ScanValidationDialog.tsx
 *   - DeposerContrat.tsx
 *   - useScanBatches.tsx
 *
 * Résultat : chaque évolution de la règle métier (ex: reconnaître aussi
 * "libre-passage" avec tiret, ou "Freizügigkeit" en allemand) impliquait
 * de la modifier partout. Un oubli = incohérence entre écrans.
 *
 * Centralisation en un seul endroit + tests pgTAP futurs → la règle métier
 * évolue à un endroit et se propage partout.
 *
 * Ce que "LPP" recouvre concrètement en Suisse :
 *   - LPP (Loi sur la Prévoyance Professionnelle) : 2e pilier
 *   - Libre passage : compte quand on change d'employeur (LPP maintenue hors
 *     employeur) → produit clé du courtier prévoyance
 *   - Freizügigkeit : le terme allemand pour libre passage
 *   - "Prévoyance professionnelle" : appellation générique 2e pilier
 *
 * Ces produits ont un traitement fiscal + de commission SPÉCIFIQUE (pas de
 * prime mensuelle, mais un "avoir total" transféré, sur lequel le partenaire
 * touche typiquement 3% de commission).
 */

/**
 * Regex canonique — capte les variantes usuelles FR/DE/EN.
 * Case-insensitive. `\b` pour éviter de matcher "flippé" ou "lppé".
 */
const LPP_PATTERN =
  /libre[\s_-]?passage|\bLPP\b|2e?\s*pilier|prévoyance\s+professionnelle|freizügigkeit|prevoyance\s+professionnelle/i;

/**
 * Détecte si le nom d'un produit correspond à un contrat LPP / libre passage.
 * Retourne true dès qu'un pattern matche. NULL ou nom vide → false.
 */
export function isLppProductName(name: string | null | undefined): boolean {
  if (!name) return false;
  return LPP_PATTERN.test(name);
}

/**
 * Détecte LPP à partir d'un objet produit (support de plusieurs shapes) :
 *   - Front SelectedProduct : { name, branchCode }
 *   - Catalog product : { name, branch_code }
 *   - Products_data snapshot : { name } (pas de branchCode figé)
 *
 * Priorité :
 *   1. branch_code / branchCode === 'LPP' (source de vérité canonique)
 *   2. Sinon regex sur le nom (fallback pour les data legacy ou IA)
 */
export function isLppProduct(product: {
  name?: string | null;
  branchCode?: string | null;
  branch_code?: string | null;
} | null | undefined): boolean {
  if (!product) return false;
  const code = product.branchCode ?? product.branch_code;
  if (code === "LPP") return true;
  return isLppProductName(product.name);
}
