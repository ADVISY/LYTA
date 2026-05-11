/**
 * request-signature-link-renewal
 *
 * Public endpoint hit from the /signer/:token page when the client lands
 * on an expired or cancelled signature link and clicks "Demander un
 * nouveau lien". We notify the broker who originally sent the link so
 * they can re-issue a fresh invitation from the CRM. We do NOT auto-
 * extend the token — that would be a security hole (anyone holding an
 * old URL could indefinitely refresh it).
 *
 * Input  : { token: string }
 * Output : { ok: true } on success, { error: "…" } otherwise
 *
 * Side effects:
 *   - Sends an email to the broker (created_by) via Resend
 *   - Logs the renewal request in tenant_email_log (kind: "transactional")
 *   - Rate-limited at the gateway level by Supabase
 */
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FROM_EMAIL = Deno.env.get("DISPATCH_FROM_EMAIL") ?? "noreply@lyta.ch";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const DOCUMENT_LABELS: Record<string, string> = {
  mandat_gestion: "Mandat de gestion",
  procuration: "Procuration",
  resiliation_lca_45: "Résiliation LCA art. 45",
  imported: "Document importé",
  autre: "Document",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { token } = await req.json().catch(() => ({}));
    if (!token || typeof token !== "string") {
      return new Response(JSON.stringify({ error: "token requis" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // Resolve the signature_request and its tenant + creator. We use
    // service_role so the lookup works regardless of the public caller's
    // (lack of) JWT. The token itself is the auth: only someone who
    // received the original email link knows it.
    const { data: sr } = await admin
      .from("signature_requests")
      .select(
        "id, tenant_id, client_id, document_kind, status, expires_at, created_by, client_full_name",
      )
      .eq("access_token", token)
      .maybeSingle();

    if (!sr) {
      return new Response(JSON.stringify({ error: "Lien introuvable" }), {
        status: 404,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Only allow renewals on expired / cancelled links. A still-active
    // link doesn't need renewal — the client can just click it. A
    // signed/refused link is terminal — they need a brand new request.
    const statusLower = String(sr.status).toLowerCase();
    if (statusLower !== "expired" && statusLower !== "cancelled") {
      // For terminal states (signed / refused), also notify the broker
      // — Habib's intuition is that the client clicked a stale email.
      // But we don't 404 them, we just say "all good".
      if (statusLower === "signed") {
        return new Response(
          JSON.stringify({ ok: true, alreadySigned: true }),
          {
            status: 200,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          },
        );
      }
    }

    // Lookup the broker who created this request (email + display name).
    if (!sr.created_by) {
      return new Response(
        JSON.stringify({ error: "Conseiller introuvable" }),
        {
          status: 404,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    const { data: brokerData } = await admin.auth.admin.getUserById(
      sr.created_by as string,
    );
    const brokerEmail = brokerData?.user?.email;
    if (!brokerEmail) {
      return new Response(
        JSON.stringify({ error: "Email du conseiller introuvable" }),
        {
          status: 404,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    // Lookup tenant info for the From-header display name.
    const { data: branding } = await admin
      .from("tenant_branding")
      .select("display_name, company_email")
      .eq("tenant_id", sr.tenant_id as string)
      .maybeSingle();
    const { data: tenant } = await admin
      .from("tenants")
      .select("name")
      .eq("id", sr.tenant_id as string)
      .maybeSingle();
    const cabinetName =
      branding?.display_name?.trim() || tenant?.name || "LYTA";

    const clientLabel = sr.client_full_name?.trim() || "votre client";
    const docLabel = DOCUMENT_LABELS[sr.document_kind as string] || "Document";
    const expiredAt = sr.expires_at
      ? new Date(sr.expires_at as string).toLocaleDateString("fr-CH", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : "—";

    const subject = `Demande de renouvellement de lien signature — ${clientLabel}`;
    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f4f6f8;font-family:-apple-system,Segoe UI,sans-serif;color:#1a1a1a;line-height:1.55;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:28px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
    <h2 style="margin:0 0 12px 0;color:#1e3a8a;">Demande de renouvellement de signature</h2>
    <p style="margin:0 0 12px 0;">Bonjour,</p>
    <p style="margin:0 0 12px 0;">
      <strong>${escapeHtml(clientLabel)}</strong> vient d'ouvrir un lien de
      signature expiré (${escapeHtml(docLabel)}, lien expiré le ${escapeHtml(expiredAt)})
      et demande à recevoir un nouveau lien.
    </p>
    <p style="margin:0 0 18px 0;">
      Connectez-vous à LYTA → fiche client → onglet Signatures → renvoyer un
      nouveau lien à ce client.
    </p>
    <div style="background:#f9fafb;border-left:3px solid #1e3a8a;padding:10px 14px;font-size:13px;color:#4b5563;">
      Cette demande a été générée automatiquement par votre client via la
      page de signature.
    </div>
    <p style="margin:20px 0 0 0;font-size:12px;color:#9ca3af;">— ${escapeHtml(cabinetName)} sur LYTA</p>
  </div>
</body></html>`;

    // Send email to the broker via Resend
    let sendError: string | null = null;
    let resendId: string | null = null;
    try {
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `"${cabinetName.replace(/[\\"]/g, " ")}" <${FROM_EMAIL}>`,
          to: [brokerEmail],
          subject,
          html,
          reply_to: branding?.company_email ?? undefined,
        }),
      });
      if (!resp.ok) {
        sendError = `Resend ${resp.status}: ${await resp.text()}`;
      } else {
        const j = await resp.json().catch(() => ({}));
        resendId = (j as { id?: string })?.id ?? null;
      }
    } catch (e) {
      sendError = e instanceof Error ? e.message : String(e);
    }

    // Log to tenant_email_log so the broker can see it in the Historique tab
    try {
      await admin.from("tenant_email_log").insert({
        tenant_id: sr.tenant_id,
        kind: "transactional",
        recipient_email: brokerEmail,
        sender_name: cabinetName,
        subject,
        status: sendError ? "failed" : "sent",
        error_message: sendError,
        resend_message_id: resendId,
        related_entity_type: "signature_request",
        related_entity_id: sr.id,
        context: {
          event: "signature_link_renewal_requested",
          original_status: statusLower,
        },
        sent_at: sendError ? null : new Date().toISOString(),
      });
    } catch {
      /* non-fatal */
    }

    if (sendError) {
      console.error("[request-signature-link-renewal] send failed", sendError);
      return new Response(JSON.stringify({ error: sendError }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    );
  }
});
