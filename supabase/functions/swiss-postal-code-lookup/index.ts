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

    // Try OpenPLZ first (richer canton metadata), then fall back to
    // zippopotam.us (extremely reliable, but no canton info). If BOTH
    // fail we return [] silently and the broker types the city manually.
    let upstreamData: any[] = [];

    const tryFetch = async (url: string, timeout: number): Promise<any | null> => {
      const ctrl = new AbortController();
      const timeoutId = setTimeout(() => ctrl.abort(), timeout);
      try {
        const res = await fetch(url, {
          headers: { Accept: "application/json" },
          signal: ctrl.signal,
        });
        clearTimeout(timeoutId);
        if (!res.ok) {
          console.warn(`[swiss-postal-code-lookup] ${url} → ${res.status}`);
          return null;
        }
        return await res.json();
      } catch (err) {
        clearTimeout(timeoutId);
        console.warn(`[swiss-postal-code-lookup] ${url} failed`, err);
        return null;
      }
    };

    // ─── Source 1: OpenPLZ (richer schema with canton) ──────────────
    {
      const raw = await tryFetch(
        `https://openplz.org/api/ch/Localities?postalCode=${encodeURIComponent(postalCode)}`,
        4_000,
      );
      if (Array.isArray(raw) && raw.length > 0) {
        upstreamData = raw;
      }
    }

    // ─── Source 2: zippopotam.us (fallback, no canton) ──────────────
    if (upstreamData.length === 0) {
      const raw: any = await tryFetch(
        `https://api.zippopotam.us/ch/${encodeURIComponent(postalCode)}`,
        4_000,
      );
      if (raw && Array.isArray(raw.places)) {
        // Re-shape zippopotam payload to match OpenPLZ's frontend expectation
        upstreamData = raw.places.map((p: any) => ({
          postalCode: raw["post code"] ?? postalCode,
          name: p["place name"],
          canton: p.state
            ? { name: p.state, key: p["state abbreviation"], shortName: p["state abbreviation"] }
            : undefined,
        }));
      }
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
