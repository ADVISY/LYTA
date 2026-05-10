/**
 * swiss-address-lookup
 * ---------------------
 * Server-side proxy for Swiss street-address autocompletion.
 *
 * Where the data comes from:
 *   api3.geo.admin.ch SearchServer — official swisstopo (Federal Office
 *   of Topography) free public API. Has every street + house number in
 *   Switzerland, kept in sync with the cantonal address registries.
 *
 * Why we need a proxy (vs calling the API from the browser):
 *   - Same DNS / CSP / corporate-firewall reasons as the postal code
 *     proxy. The frontend only needs to reach *.supabase.co.
 *   - Lets us re-shape the swisstopo payload into a friendly format
 *     and switch upstream provider later without touching the UI.
 *   - Lets us cache by (query) for 1 hour without hammering swisstopo.
 *
 * Input:
 *   GET ?q=<free text address>
 *     e.g. q=rue+de+bourg+12+lausanne
 *     e.g. q=avenue+du+leman+5+1006
 *
 * Output:
 *   200 OK  → [
 *     { label, street, houseNumber, postalCode, city, canton }
 *     …
 *   ]
 *
 * No auth required (address data is public).
 */
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

interface AddressHit {
  label: string;
  street: string | null;
  houseNumber: string | null;
  postalCode: string | null;
  city: string | null;
  canton: string | null;
}

/**
 * swisstopo address labels look like:
 *   "Rue de Bourg 12, 1003 Lausanne"
 *   "Avenue du Léman 5, 1006 Lausanne"
 *   "Bahnhofstrasse 11, 8001 Zürich"
 *   "Rue de la Confédération 8, 1204 Genève"
 * (Note: the "<b>" / "</b>" highlight markers are stripped out by the
 *  call below — swisstopo wraps the matched text in them.)
 *
 * We split on the LAST comma → "<street + number>, <plz> <city>".
 */
function parseAddressLabel(rawLabel: string): {
  street: string | null;
  houseNumber: string | null;
  postalCode: string | null;
  city: string | null;
} {
  if (!rawLabel) return { street: null, houseNumber: null, postalCode: null, city: null };

  // Strip <b>...</b> highlight markers
  let label = rawLabel.replace(/<\/?b>/gi, "").trim();

  // First try to peel off the trailing "<plz> <city>" — this is more
  // reliable than splitting on the last comma because some swisstopo
  // labels DON'T have a comma (e.g. "Bahnhofstrasse 11 8001 Zürich").
  // Match: optional comma + whitespace + 4 digits + whitespace + city
  // (the city can contain spaces and hyphens).
  const tailRegex = /\s*,?\s*(\d{4})\s+([^,]+?)\s*$/;
  const tailMatch = label.match(tailRegex);

  let postalCode: string | null = null;
  let city: string | null = null;
  let left: string;
  if (tailMatch) {
    postalCode = tailMatch[1];
    city = tailMatch[2].trim();
    left = label.slice(0, label.length - tailMatch[0].length).trim();
    // Drop a trailing comma the regex may have left behind
    left = left.replace(/[,;]+\s*$/, "").trim();
  } else {
    // No PLZ + city tail visible → assume the whole label is the street
    left = label;
  }

  // Left side: "Rue de Bourg 12" → trailing token is the house number
  // if it starts with a digit (handles "12", "12a", "12bis", "12 ter")
  let street = left;
  let houseNumber: string | null = null;
  const leftTokens = left.split(/\s+/);
  if (leftTokens.length >= 2) {
    const last = leftTokens[leftTokens.length - 1];
    if (/^\d+[A-Za-z]?(?:bis|ter)?$/i.test(last)) {
      houseNumber = last;
      street = leftTokens.slice(0, -1).join(" ");
    }
  }

  return {
    street: street || null,
    houseNumber,
    postalCode,
    city,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();

    if (q.length < 3) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    const upstream = `https://api3.geo.admin.ch/rest/services/api/SearchServer?type=locations&origins=address&searchText=${encodeURIComponent(q)}&limit=8`;

    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), 5_000);

    let hits: AddressHit[] = [];
    try {
      const res = await fetch(upstream, {
        headers: { Accept: "application/json" },
        signal: ctrl.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const raw: any = await res.json();
        if (Array.isArray(raw?.results)) {
          for (const r of raw.results) {
            const label = r?.attrs?.label as string | undefined;
            if (!label) continue;
            const parsed = parseAddressLabel(label);
            // Build a clean human label without HTML markers
            const cleanLabel = label.replace(/<\/?b>/gi, "").trim();
            hits.push({
              label: cleanLabel,
              ...parsed,
              canton: null, // swisstopo address search doesn't return canton on this endpoint
            });
          }
        }
      } else {
        console.warn(`[swiss-address-lookup] swisstopo ${res.status}`);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn("[swiss-address-lookup] swisstopo failed", err);
    }

    // Cache positives 1h, negatives don't get cached so improvements
    // to the upstream cascade roll out immediately.
    const cacheControl =
      hits.length > 0
        ? "public, max-age=3600, s-maxage=3600"
        : "no-store, no-cache, must-revalidate";

    return new Response(JSON.stringify(hits), {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
        "Cache-Control": cacheControl,
      },
    });
  } catch (e) {
    console.error("[swiss-address-lookup] handler error", e);
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
