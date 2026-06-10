/**
 * french-postal-code-lookup
 * --------------------------
 * Server-side proxy for the public French "geo.api.gouv.fr" API.
 *
 * Why we need this (same reasoning as swiss-postal-code-lookup) :
 *   - Some corporate networks don't resolve geo.api.gouv.fr or block it
 *     at the firewall. Calling an Edge Function on our own Supabase
 *     domain bypasses that — the frontend only needs *.supabase.co.
 *   - We re-shape the upstream response to match exactly the format
 *     swiss-postal-code-lookup returns, so the React component can
 *     consume both with the same code path.
 *   - 1 hour browser cache : French postal codes barely ever change.
 *
 * Behaviour :
 *   GET ?postalCode=75001
 *     → forwards to https://geo.api.gouv.fr/communes?codePostal=75001
 *     → returns [{ postalCode, name, department: { code, name? } }]
 *   - Validates the input is exactly 5 digits (French CP shape)
 *   - 5-second timeout on the upstream call
 *   - Falls back to an empty array on upstream failure rather than
 *     erroring — the frontend treats that as "no match" and the
 *     fields stay editable.
 *
 * No auth required (postal code data is public information).
 *
 * Why geo.api.gouv.fr and not api-adresse.data.gouv.fr ?
 *   - geo.api.gouv.fr is purpose-built for "give me the city for this CP"
 *     and returns clean structured data (commune name + INSEE code +
 *     department).
 *   - api-adresse.data.gouv.fr is better for full address autocompletion
 *     (= the other edge function : french-address-lookup).
 */
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const FRENCH_CP_REGEX = /^\d{5}$/;

interface FrenchLocality {
  postalCode: string;
  name: string;
  department: {
    code: string | null;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const url = new URL(req.url);
    const postalCode = (url.searchParams.get("postalCode") ?? "").trim();

    if (!FRENCH_CP_REGEX.test(postalCode)) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=60",
        },
      });
    }

    // GET https://geo.api.gouv.fr/communes?codePostal=75001&fields=nom,codeDepartement,codesPostaux
    // → [{ nom: "Paris 1er Arrondissement", codeDepartement: "75",
    //      codesPostaux: ["75001"], code: "75101" }]
    //
    // Une même commune peut avoir plusieurs codes postaux. Une même CP
    // peut être partagée entre plusieurs communes (cas typique : grandes
    // métropoles avec arrondissements multiples sur le même CP).
    const upstreamUrl = `https://geo.api.gouv.fr/communes?codePostal=${encodeURIComponent(postalCode)}&fields=nom,codeDepartement,codesPostaux,code`;

    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), 5000);

    let upstreamData: any[] = [];
    try {
      const res = await fetch(upstreamUrl, {
        headers: { Accept: "application/json" },
        signal: ctrl.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json)) upstreamData = json;
      } else {
        console.warn(`[french-postal-code-lookup] upstream ${upstreamUrl} → ${res.status}`);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn(`[french-postal-code-lookup] upstream fetch failed`, err);
    }

    const localities: FrenchLocality[] = upstreamData.map((c: any) => ({
      postalCode,
      name: String(c.nom || "").trim(),
      department: {
        code: c.codeDepartement || null,
      },
    })).filter((l) => l.name.length > 0);

    return new Response(JSON.stringify(localities), {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
        // PLZ data barely changes → safe to cache 1h browser-side
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[french-postal-code-lookup] unhandled error", err);
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
      },
    });
  }
});
