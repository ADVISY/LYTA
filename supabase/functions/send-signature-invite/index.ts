// Sends a signature invitation email + SMS to the client for a freshly created signature_request.
// Called by the CRM when a broker clicks "Envoyer pour signature à distance".
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAuth, requireTenantAccess, AuthError } from "../_shared/auth.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { getSenderAddress } from "../_shared/email-sender.ts";
import { createLogger } from "../_shared/logger.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const log = createLogger("send-signature-invite");

interface InviteRequest {
  signatureRequestId: string;
  appOrigin?: string;
}

const documentKindLabel = (kind: string): string => {
  switch (kind) {
    case "mandat_gestion": return "Mandat de gestion";
    case "procuration": return "Procuration";
    case "resiliation_lca_45": return "Résiliation LCA art. 45";
    default: return "Document";
  }
};

const buildEmailHtml = (params: {
  clientName: string;
  signLink: string;
  documentLabel: string;
  brokerName: string;
  primaryColor: string;
  logoUrl: string | null;
  expiresAt: string;
}) => {
  const { clientName, signLink, documentLabel, brokerName, primaryColor, logoUrl, expiresAt } = params;
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${brokerName}" style="height: 40px; max-width: 160px; object-fit: contain;" />`
    : `<div style="font-size: 28px; font-weight: 700; color: #ffffff;">${brokerName}</div>`;

  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a2e;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(24,0,173,0.08);overflow:hidden;">
      <div style="background:linear-gradient(135deg,${primaryColor} 0%,#4F46E5 50%,#7C3AED 100%);padding:40px 40px 50px;text-align:center;">
        ${logoHtml}
        <h1 style="color:#fff;font-size:24px;font-weight:700;margin:20px 0 0;">Document à signer</h1>
        <p style="color:rgba(255,255,255,0.85);font-size:15px;margin-top:8px;">${documentLabel}</p>
      </div>
      <div style="padding:36px 40px;">
        <p style="font-size:18px;font-weight:600;color:${primaryColor};margin-bottom:16px;">Bonjour ${clientName},</p>
        <p style="color:#4a4a68;font-size:15px;line-height:1.7;">
          Votre conseiller <strong>${brokerName}</strong> a préparé un <strong>${documentLabel.toLowerCase()}</strong>
          qu'il vous invite à signer électroniquement.
        </p>
        <p style="color:#4a4a68;font-size:15px;line-height:1.7;">
          Cliquez sur le bouton ci-dessous pour consulter le document et apposer votre signature.
          La procédure ne prend que quelques minutes et fonctionne aussi bien sur mobile que sur ordinateur.
        </p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${signLink}" style="display:inline-block;background:linear-gradient(135deg,${primaryColor} 0%,#4F46E5 100%);color:#fff;padding:16px 40px;text-decoration:none;border-radius:50px;font-weight:600;font-size:15px;box-shadow:0 4px 14px rgba(24,0,173,0.35);">
            Consulter et signer →
          </a>
        </div>
        <div style="background:#f0f4ff;border-left:4px solid ${primaryColor};padding:16px 20px;border-radius:0 12px 12px 0;margin:24px 0;">
          <p style="margin:0;color:#4a4a68;font-size:14px;">
            <strong>🔒 Sécurité :</strong> ce lien personnel expire le <strong>${expiresAt}</strong>.
            Ne le transférez à personne.
          </p>
        </div>
        <p style="color:#6b7280;font-size:13px;line-height:1.6;margin-top:24px;">
          Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
          <a href="${signLink}" style="color:${primaryColor};word-break:break-all;">${signLink}</a>
        </p>
        <div style="margin-top:36px;padding-top:24px;border-top:1px solid #e5e7eb;">
          <p style="color:#6b7280;font-size:14px;margin:0;">Cordialement,</p>
          <p style="font-weight:600;color:${primaryColor};font-size:16px;margin:4px 0 0;">L'équipe ${brokerName}</p>
        </div>
      </div>
      <div style="background:#f8fafc;padding:24px 40px;text-align:center;border-top:1px solid #e5e7eb;">
        <p style="color:#9ca3af;font-size:11px;margin:0;">
          Cet email a été envoyé automatiquement. Si vous n'attendiez pas ce document, vous pouvez l'ignorer.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
};

serve(async (req: Request): Promise<Response> => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { user } = await requireAuth(req);
    await checkRateLimit(req, "send-signature-invite", 30);

    if (!RESEND_API_KEY) {
      throw new Error("Configuration email manquante: RESEND_API_KEY");
    }

    const { signatureRequestId, appOrigin }: InviteRequest = await req.json();
    if (!signatureRequestId) {
      throw new Error("signatureRequestId is required");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Load the signature request
    const { data: sr, error: srErr } = await supabaseAdmin
      .from("signature_requests")
      .select("id, tenant_id, client_id, document_kind, access_token, expires_at, status, created_by")
      .eq("id", signatureRequestId)
      .single();

    if (srErr || !sr) {
      throw new AuthError("Signature request not found", 404);
    }

    // Confirm caller has access to that tenant
    await requireTenantAccess(user.id, sr.tenant_id as string);

    if (!["pending", "viewed"].includes(sr.status as string)) {
      throw new Error(`Cannot send invitation for request with status "${sr.status}"`);
    }

    // Load client + tenant branding
    const [{ data: client }, { data: tenant }] = await Promise.all([
      supabaseAdmin
        .from("clients")
        .select("id, first_name, last_name, company_name, email, mobile, phone")
        .eq("id", sr.client_id as string)
        .single(),
      supabaseAdmin
        .from("tenants")
        .select(`
          id, name,
          tenant_branding (
            display_name, logo_url, primary_color,
            email_sender_name, email_sender_address,
            company_address, company_phone, company_email, company_website,
            email_footer_text
          )
        `)
        .eq("id", sr.tenant_id as string)
        .single(),
    ]);

    if (!client) throw new Error("Client introuvable");

    const branding = (tenant?.tenant_branding && (tenant.tenant_branding as any[])[0]) || null;
    const tenantName = (tenant?.name as string) || "Cabinet";
    const brokerName = branding?.display_name || branding?.email_sender_name || tenantName;
    const primaryColor = branding?.primary_color || "#1800AD";
    const logoUrl = branding?.logo_url || null;

    const recipientName = (client.company_name as string) ||
      `${(client.first_name as string) || ""} ${(client.last_name as string) || ""}`.trim() ||
      "Client";

    // Build the public sign URL. Origin must come from the caller because
    // the function does not know the front-end URL of the tenant.
    const origin = (appOrigin || "").replace(/\/$/, "") ||
      (branding?.company_website ? `https://${branding.company_website.replace(/^https?:\/\//, "")}` : "https://app.lyta.ch");
    const signLink = `${origin}/signer/${sr.access_token}`;
    const expiresHuman = new Date(sr.expires_at as string).toLocaleDateString("fr-CH", { day: "2-digit", month: "long", year: "numeric" });
    const documentLabel = documentKindLabel(sr.document_kind as string);

    const warnings: string[] = [];

    // Send email
    if (client.email) {
      const html = buildEmailHtml({
        clientName: recipientName,
        signLink,
        documentLabel,
        brokerName,
        primaryColor,
        logoUrl,
        expiresAt: expiresHuman,
      });
      const { fromAddress } = getSenderAddress(branding, tenantName);

      const emailSubject = `${documentLabel} à signer - ${brokerName}`;
      const emailResp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [client.email],
          subject: emailSubject,
          html,
        }),
      });

      let resendMessageId: string | null = null;
      let emailErrorMessage: string | null = null;
      if (!emailResp.ok) {
        const txt = await emailResp.text();
        log.error("Resend error", { status: emailResp.status, txt });
        emailErrorMessage = txt || `Resend ${emailResp.status}`;
        warnings.push("Email non envoyé.");
      } else {
        try {
          const respJson = await emailResp.json();
          resendMessageId = (respJson as { id?: string })?.id ?? null;
        } catch {
          /* ignore parse error */
        }
      }

      // Centralised tenant_email_log entry — feeds Suivi emails
      // (Habib 10/05). signature_invite kind so the broker can
      // filter to all signing-link emails sent.
      try {
        await supabaseAdmin
          .from("tenant_email_log")
          .insert({
            tenant_id: sr.tenant_id,
            kind: "signature_invite",
            recipient_email: client.email,
            recipient_name: recipientName,
            sender_name: brokerName,
            subject: emailSubject,
            status: emailErrorMessage ? "failed" : "sent",
            error_message: emailErrorMessage,
            resend_message_id: resendMessageId,
            related_entity_type: "signature_request",
            related_entity_id: sr.id,
            context: { document_kind: sr.document_kind, sign_link: signLink },
            triggered_by: sr.created_by,
            sent_at: emailErrorMessage ? null : new Date().toISOString(),
          });
      } catch (logErr) {
        log.warn("tenant_email_log insert failed", { err: String(logErr) });
      }
    } else {
      warnings.push("Aucune adresse email cliente.");
    }

    // Send SMS via internal function
    const phone = (client.mobile as string) || (client.phone as string);
    if (phone) {
      try {
        const authHeader = req.headers.get("Authorization") || "";
        const smsResp = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-sms`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": authHeader,
              "apikey": Deno.env.get("SUPABASE_ANON_KEY") || "",
            },
            body: JSON.stringify({
              recipients: [{ phone, name: recipientName }],
              tenantId: sr.tenant_id,
              message: `Bonjour ${recipientName}, ${brokerName} vous invite à signer votre ${documentLabel.toLowerCase()}: ${signLink} (expire le ${expiresHuman}).`,
            }),
          },
        );
        if (!smsResp.ok) {
          warnings.push("SMS non envoyé.");
        }
      } catch (err) {
        log.error("SMS send failed", { err: String(err) });
        warnings.push("SMS non envoyé.");
      }
    } else {
      warnings.push("Aucun numéro mobile.");
    }

    log.info("Invitation processed", { signatureRequestId: sr.id, warnings });

    return new Response(
      JSON.stringify({ success: true, warnings, signLink }),
      { status: 200, headers: { "Content-Type": "application/json", ...getCorsHeaders(req) } },
    );
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: error.status, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }
    if (error instanceof RateLimitError) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded" }),
        { status: 429, headers: { ...getCorsHeaders(req), "Content-Type": "application/json", "Retry-After": String(error.retryAfter) } },
      );
    }
    log.error("send-signature-invite error", { error: error instanceof Error ? error.message : String(error) });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...getCorsHeaders(req) } },
    );
  }
});
