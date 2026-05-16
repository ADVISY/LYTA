/**
 * check-slug-availability
 * =======================
 * Endpoint PUBLIC (utilisé par lyta.ch/access pour valider en live le slug
 * choisi par le futur cabinet). Retourne available=true si le slug est
 * disponible, false sinon + une suggestion alternative.
 *
 * Sécurité : pas d'auth nécessaire (info non sensible), rate-limité par IP.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("check-slug-availability");

// Slugs réservés : ne peuvent pas être pris par un cabinet
const RESERVED_SLUGS = new Set([
  "www", "app", "api", "admin", "king", "support", "help",
  "lyta", "advisy", "blog", "docs", "status", "mail", "smtp",
  "ftp", "ns1", "ns2", "test", "staging", "dev", "preview",
  "demo", "beta", "auth", "login", "signup", "inscription",
  "access", "checkout", "pay", "billing", "stripe", "vercel",
  "cloudflare", "supabase", "cdn", "static", "assets",
]);

// Sluggify : minuscules, ASCII, alphanum + tirets, max 40 chars
function sluggify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")           // accents
    .replace(/[^a-z0-9]+/g, "-")               // non-alphanum → tiret
    .replace(/^-+|-+$/g, "")                   // trim tirets
    .replace(/-+/g, "-")                       // collapse tirets
    .slice(0, 40);
}

function isValidSlug(s: string): boolean {
  // 3-40 chars, démarre par lettre, lettres+chiffres+tirets
  return /^[a-z][a-z0-9-]{2,39}$/.test(s);
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { slug?: string };
    const rawSlug = (body.slug || "").trim();
    if (!rawSlug) {
      return new Response(JSON.stringify({ error: "slug required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const slug = sluggify(rawSlug);
    const valid = isValidSlug(slug);

    if (!valid) {
      return new Response(JSON.stringify({
        available: false,
        normalized: slug,
        reason: "invalid_format",
        message: "Le slug doit faire 3-40 caractères, commencer par une lettre, et ne contenir que des lettres, chiffres et tirets.",
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (RESERVED_SLUGS.has(slug)) {
      return new Response(JSON.stringify({
        available: false,
        normalized: slug,
        reason: "reserved",
        message: "Ce nom est réservé. Essaye autre chose.",
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: existing, error } = await supabase
      .from("tenants")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      log.error("DB lookup failed", { error: error.message });
      throw new Error(error.message);
    }

    if (existing) {
      // Suggère une variante libre (slug-1, slug-2, …)
      let suggestion: string | null = null;
      for (let i = 1; i <= 9; i++) {
        const candidate = `${slug}-${i}`;
        const { data: taken } = await supabase
          .from("tenants").select("id").eq("slug", candidate).maybeSingle();
        if (!taken) { suggestion = candidate; break; }
      }
      return new Response(JSON.stringify({
        available: false,
        normalized: slug,
        reason: "taken",
        message: "Ce nom est déjà utilisé par un autre cabinet.",
        suggestion,
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      available: true,
      normalized: slug,
      url_preview: `https://${slug}.lyta.ch`,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err) {
    log.error("Unexpected error", { err: (err as any)?.message });
    return new Response(JSON.stringify({ error: "Internal error", details: (err as any)?.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
