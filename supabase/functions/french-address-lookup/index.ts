/**
 * french-address-lookup
 * ----------------------
 * Server-side proxy for French street-address autocompletion via the
 * Base Adresse Nationale (BAN) public API.
 *
 * Data source :
 *   api-adresse.data.gouv.fr — official French government API, free,
 *   no key needed. Indexes every street + house number in France.
 *
 * Why a proxy (mêmes raisons que swiss-address-lookup) :
 *   - DNS / CSP / corporate firewall : le frontend n'a besoin de
 *     joindre que *.supabase.co
 *   - On reshape la réponse BAN (GeoJSON) en un format proche de ce
 *     que swiss-address-lookup retourne — comme ça le composant React
 *     consomme les deux avec le même code.
 *   - 1 heure de cache navigateur par requête.
 *
 * Input :
 *   GET ?q=<free text address>
 *     e.g. q=8+boulevard+du+port+paris
 *     e.g. q=12+rue+de+rivoli+75001
 *
 * Output :
 *   200 OK → [
 *     { label, street, houseNumber, postalCode, city, department }
 *     …
 *   ]
 *
 * Pas d'auth (les données d'adresse française sont publiques).
 */
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

interface FrenchAddressHit {
  label: string;
  street: string | null;
  houseNumber: string | null;
  postalCode: string | null;
  city: string | null;
  department: string | null;  // "75" pour Paris, "13" pour Marseille, etc.
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
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=60",
        },
      });
    }

    // GET https://api-adresse.data.gouv.fr/search/?q=...&limit=8
    // → GeoJSON FeatureCollection avec features[].properties = {
    //     label, postcode, citycode, city, street, housenumber,
    //     context, name, type ("housenumber" | "street" | "municipality")
    //   }
    const upstreamUrl = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=8`;

    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), 5000);

    let upstreamData: any = null;
    try {
      const res = await fetch(upstreamUrl, {
        headers: { Accept: "application/json" },
        signal: ctrl.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        upstreamData = await res.json();
      } else {
        console.warn(`[french-address-lookup] upstream ${upstreamUrl} → ${res.status}`);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn(`[french-address-lookup] upstream fetch failed`, err);
    }

    const features = Array.isArray(upstreamData?.features) ? upstreamData.features : [];

    // Extrait le département depuis le "context" BAN qui ressemble à
    // "75, Paris, Île-de-France" → premier segment avant la virgule.
    const extractDepartment = (context: string | undefined): string | null => {
      if (!context) return null;
      const first = context.split(",")[0]?.trim();
      // Codes département : 2 chiffres ou 2A/2B (Corse) ou 971-976 (DOM)
      if (/^(\d{2,3}|2A|2B)$/.test(first || "")) return first || null;
      return null;
    };

    const hits: FrenchAddressHit[] = features.map((f: any) => {
      const p = f.properties || {};
      return {
        label: String(p.label || "").trim(),
        street: p.street ? String(p.street).trim() : null,
        houseNumber: p.housenumber ? String(p.housenumber).trim() : null,
        postalCode: p.postcode ? String(p.postcode).trim() : null,
        city: p.city ? String(p.city).trim() : null,
        department: extractDepartment(p.context),
      };
    }).filter((h: FrenchAddressHit) => h.label.length > 0);

    return new Response(JSON.stringify(hits), {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
        // Adresses physiques très stables → cache 1h navigateur OK
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[french-address-lookup] unhandled error", err);
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
      },
    });
  }
});
