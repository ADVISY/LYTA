/**
 * proxy-signature-pdf
 * ===================
 * Endpoint public qui télécharge le PDF original d'une signature_request
 * depuis Storage (service_role) et le re-stream au client avec les bons
 * headers CORS.
 *
 * Pourquoi ce proxy existe : pdfjs-dist et autres libs qui font fetch()
 * sur le signed URL Supabase Storage déclenchent un CORS preflight que
 * Supabase Storage refuse pour les sous-domaines tenants (advisy.lyta.ch,
 * jcgconsulting.lyta.ch, etc.). Cf. console F12 de Habib qui montre
 * 'Origin https://advisy.lyta.ch is not allowed by Access-Control-Allow-Origin'.
 *
 * Cette fonction sert d'intermédiaire : on download server-side et on
 * réémet avec Access-Control-Allow-Origin: * (sans danger car la fonction
 * vérifie d'abord le token).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("proxy-signature-pdf");

// Endpoint public (verify_jwt = false) protégé par le `access_token` de la
// signature_request. Pas besoin de whitelist d'origines : le seul moyen
// d'extraire un PDF est de connaître le token, lui-même unique et non
// devinable. On renvoie `Access-Control-Allow-Origin: *` pour que les
// sous-domaines tenants (advisy.lyta.ch, jcgconsulting.lyta.ch, …)
// puissent fetch via pdfjs-dist sans CORS preflight bloquant.
//
// (Avant, on utilisait `getCorsHeaders(req)` qui dépend du secret
// `ALLOWED_ORIGINS` côté projet Supabase. Quand ce secret ne contenait
// pas `https://*.lyta.ch`, Safari rejetait avec "Origin … is not allowed
// by Access-Control-Allow-Origin".)
const PUBLIC_CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: PUBLIC_CORS });
  }

  try {
    // On accepte le token via query string (?token=…) pour permettre
    // l'utilisation directe comme `<img src=…>` / `<object data=…>`
    // ou via body POST.
    let token: string | null = null;
    const url = new URL(req.url);
    token = url.searchParams.get("token");
    if (!token && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      token = (body as { token?: string }).token ?? null;
    }
    if (!token) {
      return new Response(
        JSON.stringify({ error: "token is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...PUBLIC_CORS } },
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Récupère la signature_request via le token
    const { data: sr, error: srErr } = await supabaseAdmin
      .from("signature_requests")
      .select("preview_file_key, status, expires_at")
      .eq("access_token", token)
      .maybeSingle();

    if (srErr || !sr) {
      return new Response(
        JSON.stringify({ error: "Lien invalide" }),
        { status: 404, headers: { "Content-Type": "application/json", ...PUBLIC_CORS } },
      );
    }
    if (!sr.preview_file_key) {
      return new Response(
        JSON.stringify({ error: "Aucun document attaché" }),
        { status: 404, headers: { "Content-Type": "application/json", ...PUBLIC_CORS } },
      );
    }
    if (new Date(sr.expires_at as string).getTime() < Date.now()) {
      return new Response(
        JSON.stringify({ error: "Lien expiré" }),
        { status: 410, headers: { "Content-Type": "application/json", ...PUBLIC_CORS } },
      );
    }
    if (["cancelled", "refused"].includes(sr.status as string)) {
      return new Response(
        JSON.stringify({ error: "Demande non active" }),
        { status: 410, headers: { "Content-Type": "application/json", ...PUBLIC_CORS } },
      );
    }

    // Télécharge le PDF depuis storage (service_role = bypass RLS storage)
    const { data: blob, error: dlErr } = await supabaseAdmin.storage
      .from("documents")
      .download(sr.preview_file_key as string);

    if (dlErr || !blob) {
      log.error("storage download failed", { dlErr, file_key: sr.preview_file_key });
      return new Response(
        JSON.stringify({ error: "Impossible de télécharger le PDF" }),
        { status: 500, headers: { "Content-Type": "application/json", ...PUBLIC_CORS } },
      );
    }

    // Re-stream au client avec CORS OK
    return new Response(blob, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=300",
        ...PUBLIC_CORS,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log.error("proxy-signature-pdf error", { error: message });
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json", ...PUBLIC_CORS } },
    );
  }
});
