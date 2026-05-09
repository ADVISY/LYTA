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

    // ─── Source 2: zippopotam.us (CDN-fast, partial CH coverage) ───
    if (upstreamData.length === 0) {
      const raw: any = await tryFetch(
        `https://api.zippopotam.us/ch/${encodeURIComponent(postalCode)}`,
        4_000,
      );
      if (raw && Array.isArray(raw.places)) {
        upstreamData = raw.places.map((p: any) => ({
          postalCode: raw["post code"] ?? postalCode,
          name: p["place name"],
          canton: p.state
            ? { name: p.state, key: p["state abbreviation"], shortName: p["state abbreviation"] }
            : undefined,
        }));
      }
    }

    // ─── Source 3: api3.geo.admin.ch (OFFICIAL Swiss Confederation) ──
    // Maintained by swisstopo. Has ALL ~4500 active Swiss PLZ. Slowest of
    // the three but exhaustive — used as last resort so we never miss a
    // village that the other two skip.
    if (upstreamData.length === 0) {
      const raw: any = await tryFetch(
        `https://api3.geo.admin.ch/rest/services/api/SearchServer?type=locations&origins=zipcode&searchText=${encodeURIComponent(postalCode)}`,
        5_000,
      );
      if (raw && Array.isArray(raw.results)) {
        // Each result has attrs.label like "1003 Lausanne". Parse it.
        const labelRegex = /^(\d{4})\s+(.+)$/;
        const seen = new Set<string>();
        for (const r of raw.results) {
          const label = r?.attrs?.label as string | undefined;
          if (!label) continue;
          const match = label.match(labelRegex);
          if (!match) continue;
          const [, plz, cityRaw] = match;
          if (plz !== postalCode) continue;
          const city = cityRaw.trim();
          if (!city || seen.has(city.toLowerCase())) continue;
          seen.add(city.toLowerCase());
          upstreamData.push({
            postalCode: plz,
            name: city,
            // swisstopo doesn't return canton on the basic search but the
            // frontend gracefully handles a missing canton
            canton: undefined,
          });
        }
      }
    }

    // CACHE STRATEGY:
    //   - Successful lookup (≥1 hit) → cache 1h, PLZ data is stable.
    //   - Empty result               → DO NOT CACHE. Otherwise the
    //     browser stores "no city for 1003" and serves it for an hour
    //     even after we improve the upstream cascade. This was Habib's
    //     bug — adding fallback APIs didn't help because his browser
    //     still served the previous empty response.
    const cacheControl =
      upstreamData.length > 0
        ? "public, max-age=3600, s-maxage=3600"
        : "no-store, no-cache, must-revalidate";

    return new Response(JSON.stringify(upstreamData), {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
        "Cache-Control": cacheControl,
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
