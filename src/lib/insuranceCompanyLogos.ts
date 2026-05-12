const LOCAL_INSURANCE_COMPANY_LOGOS: Record<string, string> = {
  assura: "/insurance-logos/assura.png",
  atupri: "/insurance-logos/atupri.png",
  axa: "/insurance-logos/axa.png",
  baloise: "/insurance-logos/baloise.png",
  concordia: "/insurance-logos/concordia.jpg",
  "css-assurance": "/insurance-logos/css-assurance.png",
  generali: "/insurance-logos/generali.jpg",
  "groupe-mutuel": "/insurance-logos/groupe-mutuel.png",
  helsana: "/insurance-logos/helsana.png",
  helvetia: "/insurance-logos/helvetia.jpg",
  "kpt-cpt": "/insurance-logos/kpt-cpt.jpg",
  "la-mobiliere": "/insurance-logos/la-mobiliere.jpg",
  "liechtenstein-life": "/insurance-logos/liechtenstein-life.jpg",
  okk: "/insurance-logos/okk.webp",
  pax: "/insurance-logos/pax.png",
  sanitas: "/insurance-logos/sanitas.jpg",
  swica: "/insurance-logos/swica.png",
  "swiss-life": "/insurance-logos/swiss-life.png",
  sympany: "/insurance-logos/sympany.png",
  visana: "/insurance-logos/visana.jpg",
  "zurich-assurances": "/insurance-logos/zurich-assurances.jpg",
};

const INSURANCE_COMPANY_ALIASES: Record<string, string> = {
  css: "css-assurance",
  "css assurance": "css-assurance",
  "groupe mutuel": "groupe-mutuel",
  "helvetia validation": "helvetia",
  kpt: "kpt-cpt",
  cpt: "kpt-cpt",
  "kpt cpt": "kpt-cpt",
  "kpt/cpt": "kpt-cpt",
  "la mobiliere": "la-mobiliere",
  "liechtenstein life": "liechtenstein-life",
  oekk: "okk",
  "swiss life": "swiss-life",
  swisslife: "swiss-life",
  zurich: "zurich-assurances",
  "zurich assurances": "zurich-assurances",
};

// Common company-form suffixes that should be stripped to improve matching.
// e.g. "Assura SA", "Helsana AG", "Swica Assurances", "Groupe Mutuel Holding"
// should all resolve to their bare brand name in the catalog.
const COMPANY_SUFFIXES = [
  "sa", "ag", "sarl", "gmbh", "ltd", "limited",
  "assurance", "assurances", "versicherung", "versicherungen",
  "insurance", "insurances",
  "holding", "group", "groupe", "gruppe",
  "suisse", "switzerland", "schweiz", "ch",
];

function normalizeInsuranceCompanyName(name?: string | null) {
  if (!name) return "";

  let cleaned = name
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Strip known trailing suffixes \u2014 iteratively, so "Assura SA Assurances"
  // collapses to "assura". Order doesn't matter, but we cap iterations to
  // avoid pathological loops.
  for (let i = 0; i < 4; i++) {
    let stripped = false;
    for (const suffix of COMPANY_SUFFIXES) {
      const re = new RegExp(`\\s${suffix}$`);
      if (re.test(cleaned)) {
        cleaned = cleaned.replace(re, "").trim();
        stripped = true;
      }
    }
    if (!stripped) break;
  }

  return cleaned;
}

export function getLocalInsuranceCompanyLogo(name?: string | null) {
  const normalized = normalizeInsuranceCompanyName(name);
  if (!normalized) return null;

  // Try alias first, then the slug form, then a final pass with no suffix at all
  const slug =
    INSURANCE_COMPANY_ALIASES[normalized] || normalized.replace(/\s+/g, "-");

  if (LOCAL_INSURANCE_COMPANY_LOGOS[slug]) {
    return LOCAL_INSURANCE_COMPANY_LOGOS[slug];
  }

  // Last-resort: try the first word alone (catches "Assura Standard" \u2192 "assura")
  const firstWord = normalized.split(" ")[0];
  if (firstWord && firstWord !== slug) {
    const firstWordSlug = INSURANCE_COMPANY_ALIASES[firstWord] || firstWord;
    if (LOCAL_INSURANCE_COMPANY_LOGOS[firstWordSlug]) {
      return LOCAL_INSURANCE_COMPANY_LOGOS[firstWordSlug];
    }
  }

  return null;
}
