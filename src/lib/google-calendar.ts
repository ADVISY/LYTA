/**
 * Helpers pour la création de liens Google Calendar pré-remplis.
 *
 * On utilise l'URL "eventedit" qui supporte les paramètres :
 *   - text       : titre de l'événement
 *   - details    : description riche (multi-ligne)
 *   - dates      : YYYYMMDDTHHMMSSZ/YYYYMMDDTHHMMSSZ
 *   - location   : adresse → Google Maps auto sur l'event
 *   - add        : invité (email) — multiple possible
 *
 * Documentation : https://www.google.com/calendar/render?action=TEMPLATE
 */

export interface CalendarEventClient {
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  address?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
}

export interface CalendarEventOpportunity {
  title?: string | null;
  description?: string | null;
  expected_product?: string | null;
  expected_company?: string | null;
  reminder_date?: string | null;
}

function formatDateGCal(d: Date): string {
  // Format Google Calendar : YYYYMMDDTHHMMSSZ
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function buildClientFullAddress(client?: CalendarEventClient | null): string {
  if (!client) return "";
  const line1 = client.address?.trim() ?? "";
  const cityLine = [client.postal_code, client.city].filter(Boolean).join(" ");
  const country = client.country?.trim() ?? "";
  return [line1, cityLine, country].filter(Boolean).join(", ");
}

function buildClientFullName(client?: CalendarEventClient | null): string {
  if (!client) return "Client";
  if (client.company_name) return client.company_name;
  return [client.first_name, client.last_name].filter(Boolean).join(" ") || "Client";
}

/**
 * Construit une description riche pour l'event Google Calendar avec :
 *   - Infos client (nom, téléphone, email)
 *   - Détails opportunité (produit, compagnie)
 *   - Notes additionnelles
 *
 * Tout est formaté multi-lignes pour bien apparaître dans Google Calendar.
 */
export function buildEventDescription(
  opp: CalendarEventOpportunity,
  client?: CalendarEventClient | null,
  extraNotes?: string,
): string {
  const lines: string[] = [];

  // En-tête
  lines.push("📋 OPPORTUNITÉ LYTA");
  lines.push("");

  // Bloc client
  if (client) {
    lines.push("👤 CLIENT");
    lines.push(`  ${buildClientFullName(client)}`);
    if (client.phone) lines.push(`  ☎️ ${client.phone}`);
    if (client.mobile && client.mobile !== client.phone) {
      lines.push(`  📱 ${client.mobile}`);
    }
    if (client.email) lines.push(`  ✉️ ${client.email}`);
    const addr = buildClientFullAddress(client);
    if (addr) lines.push(`  📍 ${addr}`);
    lines.push("");
  }

  // Bloc produit/compagnie
  if (opp.expected_product || opp.expected_company) {
    lines.push("💼 PRODUIT");
    if (opp.expected_product) lines.push(`  ${opp.expected_product}`);
    if (opp.expected_company) lines.push(`  Compagnie : ${opp.expected_company}`);
    lines.push("");
  }

  // Notes
  if (extraNotes || opp.description) {
    lines.push("📝 NOTES");
    lines.push(`  ${extraNotes || opp.description}`);
    lines.push("");
  }

  // Footer
  lines.push("---");
  lines.push("Créé depuis LYTA · https://app.lyta.ch");

  return lines.join("\n");
}

/**
 * Construit l'URL Google Calendar pré-remplie pour un RDV d'opportunité.
 *
 * @param opp Opportunité (avec title, description, expected_product/company, reminder_date)
 * @param client Infos client pour enrichir location + détails
 * @param durationMinutes Durée du RDV en minutes (défaut 30)
 * @param extraNotes Notes additionnelles à inclure dans la description
 */
export function buildGoogleCalendarUrl(
  opp: CalendarEventOpportunity,
  client?: CalendarEventClient | null,
  durationMinutes: number = 30,
  extraNotes?: string,
): string | null {
  if (!opp.reminder_date) return null;

  const start = new Date(opp.reminder_date);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  // Titre par défaut si vide
  const title = opp.title
    || `RDV ${buildClientFullName(client)}${opp.expected_company ? ` · ${opp.expected_company}` : ""}`;

  // Description riche
  const description = buildEventDescription(opp, client, extraNotes);

  // Location = adresse client → Google Maps auto sur l'event
  const location = buildClientFullAddress(client);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    details: description,
    dates: `${formatDateGCal(start)}/${formatDateGCal(end)}`,
  });

  if (location) {
    params.set("location", location);
  }

  // Optionnel : ajouter le client en invité s'il a un email
  // (Google Calendar lui enverra une invitation)
  // → désactivé par défaut car invite-toi-même pas toujours souhaité
  // if (client?.email) params.append("add", client.email);

  return `https://calendar.google.com/calendar/u/0/r/eventedit?${params.toString()}`;
}
