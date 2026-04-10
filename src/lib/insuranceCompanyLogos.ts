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

function normalizeInsuranceCompanyName(name?: string | null) {
  if (!name) return "";

  return name
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getLocalInsuranceCompanyLogo(name?: string | null) {
  const normalized = normalizeInsuranceCompanyName(name);
  if (!normalized) return null;

  const slug =
    INSURANCE_COMPANY_ALIASES[normalized] || normalized.replace(/\s+/g, "-");

  return LOCAL_INSURANCE_COMPANY_LOGOS[slug] || null;
}
