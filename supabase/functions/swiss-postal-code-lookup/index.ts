/**
 * swiss-postal-code-lookup
 * -------------------------
 * Server-side proxy for the public OpenPLZ Swiss locality API.
 *
 * Why we need this:
 *   - The frontend was calling https://openplz.org/api/ch/Localities
 *     directly, which broke for some tenants behind networks that
 *     either didn't resolve openplz.org (ERR_NAME_NOT_RESOLVED), or
 *     had a strict CSP. Calling an Edge Function on the same Supabase
 *     domain we already whitelist solves both at once.
 *
 * Behaviour:
 *   - GET ?postalCode=1003 → forwards to OpenPLZ, returns the array
 *     of localities ([{ postalCode, name, canton: { ... } }])
 *   - Validates the input is exactly 4 digits (Swiss PLZ shape)
 *   - 5-second timeout on the upstream call
 *   - Cache: tells the browser to keep the response 1h (PLZ data
 *     barely ever changes, hammering the upstream is rude)
 *   - Falls back to an empty array on upstream failure rather than
 *     erroring — the frontend treats that as "no match" and the
 *     fields stay editable.
 *
 * No auth required (PLZ data is public information).
 */
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const SWISS_PLZ_REGEX = /^\d{4}$/;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const url = new URL(req.url);
    const postalCode = (url.searchParams.get("postalCode") ?? "").trim();

    if (!SWISS_PLZ_REGEX.test(postalCode)) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=60",
        },
      });
    }

    const upstream = `https://openplz.org/api/ch/Localities?postalCode=${encodeURIComponent(postalCode)}`;

    // 5-second timeout so a slow OpenPLZ doesn't hang the broker's UI.
    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), 5_000);

    let upstreamData: any[] = [];
    try {
      const res = await fetch(upstream, {
        headers: { Accept: "application/json" },
        signal: ctrl.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const raw = await res.json();
        if (Array.isArray(raw)) upstreamData = raw;
      } else {
        console.warn(`[swiss-postal-code-lookup] upstream ${res.status}`);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn("[swiss-postal-code-lookup] upstream failed", err);
      // Fall through with empty array — frontend treats it as "no match"
      // and lets the user type the city manually. Better than 500.
    }

    return new Response(JSON.stringify(upstreamData), {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
        // Browsers + Supabase edge cache for 1h. PLZ data barely changes.
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (e) {
    console.error("[swiss-postal-code-lookup] handler error", e);
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
