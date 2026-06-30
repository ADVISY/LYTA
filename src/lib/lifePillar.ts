/**
 * lifePillar — Helpers pour détecter et afficher le type de pilier (3A/3B)
 * d'un produit Vie/Prévoyance à partir de son nom.
 *
 * Pourquoi : les compagnies nomment leurs produits "3a", "Pilier 3B",
 * "3ème pilier A", "Vita Wir 3a", "AXA Vorsorge 3b" etc. On veut pouvoir
 * distinguer en un coup d'œil dans le catalogue + pré-remplir le selector
 * du ContractForm sans devoir éditer chaque produit manuellement.
 *
 * Stratégie : regex sur le nom (normalisé). Une fois qu'on a 80% de
 * couverture auto, le courtier peut surcharger manuellement pour les 20%
 * restants via le selector du contrat (qui prend toujours le pas).
 */

export type LifePillarType = "pilier_3a" | "pilier_3b" | "vie_classique" | null;

/**
 * Résout le type de pilier d'un produit avec la chaîne de priorité :
 *   1. `product.life_pillar` taggé explicitement dans le catalogue (admin/king)
 *   2. Détection auto regex sur le nom (cf. detectLifePillarFromName)
 *
 * Utilisé par ProductCatalogManager, ContractForm, CRMContracts, ClientDetail
 * pour cohérence partout. Le type stocké sur le CONTRAT
 * (products_data.pillarType) reste prioritaire mais c'est géré au call site
 * — ce helper ne s'occupe que du PRODUIT.
 */
export function resolveLifePillarFromProduct(product: {
  life_pillar?: LifePillarType | string | null;
  name?: string | null;
} | null | undefined): LifePillarType {
  if (!product) return null;
  // 1. Tag manuel admin/king en priorité
  const tagged = product.life_pillar;
  if (tagged === "pilier_3a" || tagged === "pilier_3b" || tagged === "vie_classique") {
    return tagged;
  }
  // 2. Fallback : regex sur le nom
  return detectLifePillarFromName(product.name);
}

/**
 * Détecte le type de pilier à partir du nom d'un produit.
 *
 * Règles :
 *   - Match "3a", "3ème pilier a", "pilier 3a", "3.a", "3 a" → 'pilier_3a'
 *   - Match "3b", "3ème pilier b", "pilier 3b", "3.b", "3 b" → 'pilier_3b'
 *   - Match "vie", "décès", "deces", "rente", "mixte", "lebensver" → 'vie_classique'
 *   - Sinon NULL (produit non-vie, ou nom pas reconnu)
 *
 * La détection 3A/3B prime sur la détection "vie classique" : un produit
 * "Vita Wir 3a" est un 3a, pas un vie classique.
 */
export function detectLifePillarFromName(name: string | null | undefined): LifePillarType {
  if (!name) return null;
  const n = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  // 3A : "3a", "3 a", "3-a", "3.a", "3eme pilier a", "pilier 3a", "pilier a"
  // \b assure qu'on ne matche pas "3aa" ou "13a"
  // Tests : "AXA 3a", "Helsana Pilier 3 A", "Vita 3.a Plus"
  if (/\b3\s*[\.\-_]?\s*a\b/i.test(n)) return "pilier_3a";
  if (/3\s*(?:eme|e|ieme)?\s*pilier\s+a\b/i.test(n)) return "pilier_3a";
  if (/pilier\s+3\s*a\b/i.test(n)) return "pilier_3a";
  if (/pillar\s+3\s*a\b/i.test(n)) return "pilier_3a"; // EN/DE
  if (/\bsaule\s+3a\b/i.test(n)) return "pilier_3a";   // DE "Säule 3a"

  // 3B : pareil pour B
  if (/\b3\s*[\.\-_]?\s*b\b/i.test(n)) return "pilier_3b";
  if (/3\s*(?:eme|e|ieme)?\s*pilier\s+b\b/i.test(n)) return "pilier_3b";
  if (/pilier\s+3\s*b\b/i.test(n)) return "pilier_3b";
  if (/pillar\s+3\s*b\b/i.test(n)) return "pilier_3b";
  if (/\bsaule\s+3b\b/i.test(n)) return "pilier_3b";

  // Vie classique : nom contient "vie", "deces", "rente", "mixte", etc.
  // Exclusion : ne pas matcher "vie" dans "vieux" ou "vielle"
  if (/\bvie\b/i.test(n)) return "vie_classique";
  if (/\bdeces\b/i.test(n)) return "vie_classique";
  if (/\brente\b/i.test(n)) return "vie_classique";
  if (/\bmixte\b/i.test(n)) return "vie_classique";
  if (/\blife\b/i.test(n)) return "vie_classique";
  if (/\bleben/i.test(n)) return "vie_classique"; // DE "Lebensversicherung"

  return null;
}

/** Label court pour badge UI. */
export const LIFE_PILLAR_BADGES: Record<NonNullable<LifePillarType>, { label: string; description: string }> = {
  pilier_3a: {
    label: "3ᵉ pilier A",
    description: "Prévoyance liée — déductible fiscalement, blocage 60 ans",
  },
  pilier_3b: {
    label: "3ᵉ pilier B",
    description: "Prévoyance libre — retrait libre, pas de déduction fiscale directe",
  },
  vie_classique: {
    label: "Vie classique",
    description: "Risque décès, mixte, rente viagère",
  },
};

/** Classes Tailwind cohérentes pour le badge selon le type. */
export function lifePillarBadgeClasses(type: NonNullable<LifePillarType>): string {
  switch (type) {
    case "pilier_3a":
      return "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-300";
    case "pilier_3b":
      return "bg-indigo-50 text-indigo-700 border-indigo-300 dark:bg-indigo-950/30 dark:text-indigo-300";
    case "vie_classique":
      return "bg-violet-50 text-violet-700 border-violet-300 dark:bg-violet-950/30 dark:text-violet-300";
  }
}
