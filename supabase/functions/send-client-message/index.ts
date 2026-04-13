import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAuth, AuthError } from "../_shared/auth.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { getSenderAddress } from "../_shared/email-sender.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("send-client-message");

interface ClientMessageRequest {
  message: string;
  clientId?: string;
}

const getMessageEmailTemplate = (
  message: string,
  clientName: string,
  clientEmail: string,
  branding: {
    display_name: string | null;
    logo_url: string | null;
    primary_color: string | null;
    company_email: string | null;
    company_phone: string | null;
    company_website: string | null;
    company_address: string | null;
  }
): { subject: string; html: string } => {
  const displayName = branding.display_name || "Cabinet";
  const primaryColor = branding.primary_color || "#0EA5E9";
  const logoUrl = branding.logo_url;
  const address = branding.company_address || "";
  const phone = branding.company_phone || "";

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${displayName}" style="max-height: 60px; max-width: 200px;" />`
    : `<h2 style="color: ${primaryColor}; margin: 0;">${displayName}</h2>`;

  const timestamp = new Date().toLocaleString("fr-CH", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Zurich",
  });

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd); padding: 32px; text-align: center;">
              ${logoHtml}
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin: 0 0 8px; color: #18181b; font-size: 24px;">
                💬 Nouveau message client
              </h1>
              <p style="margin: 0 0 24px; color: #71717a; font-size: 14px;">
                Message reçu de <strong>${clientName}</strong> (${clientEmail})
              </p>

              <div style="background: #f4f4f5; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <p style="margin: 0; color: #3f3f46; font-size: 16px; line-height: 1.6; white-space: pre-wrap;">
                  ${message}
                </p>
              </div>

              <p style="margin: 0 0 8px; color: #71717a; font-size: 12px;">
                Envoyé le ${timestamp}
              </p>

              <p style="margin: 16px 0 0; color: #71717a; font-size: 14px;">
                Vous pouvez répondre directement à ce client en envoyant un email à <a href="mailto:${clientEmail}" style="color: ${primaryColor};">${clientEmail}</a>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #fafafa; padding: 24px 32px; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0 0 8px; color: #52525b; font-size: 14px; font-weight: 600;">
                ${displayName}
              </p>
              ${address ? `<p style="margin: 0 0 4px; color: #71717a; font-size: 12px;">${address}</p>` : ""}
              ${phone ? `<p style="margin: 0 0 4px; color: #71717a; font-size: 12px;">📞 ${phone}</p>` : ""}
              <p style="margin: 16px 0 0; color: #a1a1aa; font-size: 11px;">
                Ce message a été envoyé depuis l'espace client.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return {
    subject: `💬 Nouveau message de ${clientName} - ${displayName}`,
    html,
  };
};

const handler = async (req: Request): Promise<Response> => {
  log.info("send-client-message invoked");

  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { user } = await requireAuth(req);

    await checkRateLimit(req, "send-client-message", 5);

    const body: ClientMessageRequest = await req.json();
    const { message, clientId: requestedClientId } = body;

    if (!message || !message.trim()) {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the user's profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, first_name, last_name")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      log.error("Profile not found", { error: profileError });
      throw new Error("User profile not found");
    }

    // Get tenant assignment for this user
    const { data: tenantAssignment, error: tenantError } = await supabase
      .from("user_tenant_assignments")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (tenantError || !tenantAssignment) {
      log.error("Tenant assignment not found", { error: tenantError });
      throw new Error("Tenant not found for user");
    }

    const tenantId = tenantAssignment.tenant_id;

    // Find the client record linked to this user to get assigned_agent_id.
    // If the frontend sends a clientId, validate that it is the user's own client record.
    const clientQuery = supabase
      .from("clients")
      .select("id, assigned_agent_id, first_name, last_name, email")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId);

    const { data: clientRecord, error: clientError } = requestedClientId
      ? await clientQuery.eq("id", requestedClientId).maybeSingle()
      : await clientQuery.maybeSingle();

    if (clientError || !clientRecord) {
      log.error("Client record not found for user", { userId: user.id, tenantId, requestedClientId, error: clientError?.message });
      return new Response(
        JSON.stringify({ error: "Compte client non lie a une fiche client. Contactez votre conseiller." }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const clientName = [clientRecord.first_name || profile.first_name, clientRecord.last_name || profile.last_name]
      .filter(Boolean)
      .join(" ") || "Client";
    const clientEmail = clientRecord.email || profile.email || user.email || "";

    const { data: savedMessage, error: saveMessageError } = await supabase
      .from("messages_clients")
      .insert({
        client_id: clientRecord.id,
        direction: "sortant",
        channel: "email",
        content: message.trim(),
      })
      .select("id, created_at")
      .single();

    if (saveMessageError) {
      log.error("Failed to save client message", { error: saveMessageError.message, clientId: clientRecord.id });
      throw new Error("Impossible d'enregistrer le message");
    }

    let recipientEmail: string | null = null;

    // Try to get collaborateur email via assigned_agent_id
    if (clientRecord?.assigned_agent_id) {
      // The assigned_agent_id references another client record (type collaborateur)
      const { data: agent, error: agentError } = await supabase
        .from("clients")
        .select("email")
        .eq("id", clientRecord.assigned_agent_id)
        .single();

      if (!agentError && agent?.email) {
        recipientEmail = agent.email;
        log.info("Found assigned agent email", { email: recipientEmail });
      }
    }

    // Fallback: get tenant admin email
    if (!recipientEmail) {
      const { data: tenant, error: tenantInfoError } = await supabase
        .from("tenants")
        .select("admin_email")
        .eq("id", tenantId)
        .single();

      if (!tenantInfoError && tenant?.admin_email) {
        recipientEmail = tenant.admin_email;
        log.info("Using tenant admin email as fallback", { email: recipientEmail });
      }
    }

    // Final fallback: get tenant branding company email
    if (!recipientEmail) {
      const { data: brandingData } = await supabase
        .from("tenant_branding")
        .select("company_email")
        .eq("tenant_id", tenantId)
        .single();

      if (brandingData?.company_email) {
        recipientEmail = brandingData.company_email;
        log.info("Using branding company email as fallback", { email: recipientEmail });
      }
    }

    if (!recipientEmail) {
      log.warn("No recipient email found; message saved without email notification", { messageId: savedMessage.id, tenantId });
      return new Response(
        JSON.stringify({
          success: true,
          messageId: savedMessage.id,
          emailSent: false,
          warning: "Message enregistre, mais aucun email destinataire n'est configure pour ce cabinet.",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
        }
      );
    }

    // Get tenant branding for email template
    const { data: branding } = await supabase
      .from("tenant_branding")
      .select("display_name, logo_url, primary_color, company_email, company_phone, company_website, company_address, email_sender_name, email_sender_address")
      .eq("tenant_id", tenantId)
      .single();

    const tenantBranding = branding || {
      display_name: "Cabinet",
      logo_url: null,
      primary_color: "#0EA5E9",
      company_email: null,
      company_phone: null,
      company_website: null,
      company_address: null,
      email_sender_name: null,
      email_sender_address: null,
    };

    const { subject, html } = getMessageEmailTemplate(
      message.trim(),
      clientName,
      clientEmail,
      tenantBranding
    );

    const { fromAddress } = getSenderAddress(tenantBranding, tenantBranding.display_name || "Cabinet");

    if (!RESEND_API_KEY) {
      log.warn("RESEND_API_KEY not configured; message saved without email notification", { messageId: savedMessage.id });
      return new Response(
        JSON.stringify({
          success: true,
          messageId: savedMessage.id,
          emailSent: false,
          warning: "Message enregistre, mais la notification email n'est pas configuree.",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
        }
      );
    }

    log.info("Sending client message email", { to: recipientEmail, from: fromAddress, client: clientName });

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [recipientEmail],
        reply_to: clientEmail,
        subject,
        html,
      }),
    });

    const emailResultText = await emailResponse.text();
    let emailResult: Record<string, unknown> = {};
    try {
      emailResult = emailResultText ? JSON.parse(emailResultText) : {};
    } catch {
      emailResult = { message: emailResultText };
    }

    if (!emailResponse.ok) {
      log.error("Resend API error; message saved without email notification", { error: emailResult, messageId: savedMessage.id });
      return new Response(
        JSON.stringify({
          success: true,
          messageId: savedMessage.id,
          emailSent: false,
          warning: "Message enregistre, mais la notification email n'a pas pu etre envoyee.",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
        }
      );
    }

    log.info("Client message email sent successfully", { emailId: emailResult.id });

    return new Response(
      JSON.stringify({ success: true, messageId: savedMessage.id, emailSent: true, emailId: emailResult.id }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
      }
    );
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: (error as AuthError).status, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }
    if (error instanceof RateLimitError) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded" }),
        {
          status: 429,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json", "Retry-After": String(error.retryAfter) },
        }
      );
    }
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    log.error("Error sending client message", { error: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
      }
    );
  }
};

serve(handler);
