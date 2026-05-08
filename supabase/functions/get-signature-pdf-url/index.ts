// Public endpoint: given a valid signature_request token, returns a short-lived
// signed URL for the document under preview_file_key (used by /signer/:token to
// display imported PDFs).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("get-signature-pdf-url");

serve(async (req: Request): Promise<Response> => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { token } = await req.json();
    if (!token) throw new Error("token is required");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: sr, error: srErr } = await supabaseAdmin
      .from("signature_requests")
      .select("id, preview_file_key, status, expires_at")
      .eq("access_token", token)
      .maybeSingle();

    if (srErr || !sr) {
      return new Response(
        JSON.stringify({ error: "Lien invalide" }),
        { status: 404, headers: { "Content-Type": "application/json", ...getCorsHeaders(req) } },
      );
    }

    if (!sr.preview_file_key) {
      return new Response(
        JSON.stringify({ error: "Aucun document attaché" }),
        { status: 404, headers: { "Content-Type": "application/json", ...getCorsHeaders(req) } },
      );
    }
    if (new Date(sr.expires_at as string).getTime() < Date.now()) {
      return new Response(
        JSON.stringify({ error: "Lien expiré" }),
        { status: 410, headers: { "Content-Type": "application/json", ...getCorsHeaders(req) } },
      );
    }
    if (["cancelled", "refused"].includes(sr.status as string)) {
      return new Response(
        JSON.stringify({ error: "Demande non active" }),
        { status: 410, headers: { "Content-Type": "application/json", ...getCorsHeaders(req) } },
      );
    }

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("documents")
      .createSignedUrl(sr.preview_file_key as string, 3600);

    if (signErr || !signed?.signedUrl) {
      log.error("Sign URL failed", { signErr });
      throw new Error("Impossible de générer l'URL");
    }

    return new Response(
      JSON.stringify({ url: signed.signedUrl }),
      { status: 200, headers: { "Content-Type": "application/json", ...getCorsHeaders(req) } },
    );
  } catch (error: unknown) {
    log.error("get-signature-pdf-url error", { error: error instanceof Error ? error.message : String(error) });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...getCorsHeaders(req) } },
    );
  }
});
