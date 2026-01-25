import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationEmailRequest {
  notification_id: string;
  client_id: string;
  notification_kind: string;
  title: string;
  message: string;
  payload?: Record<string, unknown>;
}

interface TenantBranding {
  display_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  company_email: string | null;
  company_phone: string | null;
  company_website: string | null;
  company_address: string | null;
  email_sender_name: string | null;
  email_sender_address: string | null;
}

const getEmailTemplate = (
  kind: string,
  title: string,
  message: string,
  clientName: string,
  branding: TenantBranding,
  payload?: Record<string, unknown>
): { subject: string; html: string } => {
  const displayName = branding.display_name || "Votre cabinet";
  const primaryColor = branding.primary_color || "#0EA5E9";
  const logoUrl = branding.logo_url;
  const website = branding.company_website || "";
  const phone = branding.company_phone || "";
  const address = branding.company_address || "";

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${displayName}" style="max-height: 60px; max-width: 200px;" />`
    : `<h2 style="color: ${primaryColor}; margin: 0;">${displayName}</h2>`;

  const iconMap: Record<string, string> = {
    contract: "📋",
    document: "📄",
    claim: "⚡",
    message: "💬",
    invoice: "🧾",
  };

  const icon = iconMap[kind] || "🔔";
  const subjectPrefix = icon;

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
                ${icon} ${title}
              </h1>
              <p style="margin: 0 0 24px; color: #71717a; font-size: 14px;">
                Bonjour ${clientName},
              </p>
              
              <div style="background: #f4f4f5; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <p style="margin: 0; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                  ${message}
                </p>
              </div>
              
              <p style="margin: 0 0 24px; color: #71717a; font-size: 14px;">
                Connectez-vous à votre espace client pour voir les détails.
              </p>
              
              <a href="${website}" style="display: inline-block; background: ${primaryColor}; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
                Accéder à mon espace
              </a>
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
                Cet email a été envoyé automatiquement suite à une activité sur votre compte.
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
    subject: `${subjectPrefix} ${title} - ${displayName}`,
    html,
  };
};

const handler = async (req: Request): Promise<Response> => {
  console.log("send-client-notification-email invoked");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      throw new Error("Email service not configured");
    }

    const RESEND_API_URL = "https://api.resend.com/emails";
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: NotificationEmailRequest = await req.json();
    const { client_id, notification_kind, title, message, payload } = body;

    console.log(`Processing notification email for client ${client_id}, kind: ${notification_kind}`);

    // Get client info
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, first_name, last_name, email, tenant_id")
      .eq("id", client_id)
      .single();

    if (clientError || !client) {
      console.error("Client not found:", clientError);
      throw new Error("Client not found");
    }

    if (!client.email) {
      console.log("Client has no email, skipping notification");
      return new Response(JSON.stringify({ success: false, reason: "no_email" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get tenant branding
    const { data: branding } = await supabase
      .from("tenant_branding")
      .select("*")
      .eq("tenant_id", client.tenant_id)
      .single();

    const tenantBranding: TenantBranding = branding || {
      display_name: "Votre cabinet",
      logo_url: null,
      primary_color: "#0EA5E9",
      company_email: null,
      company_phone: null,
      company_website: null,
      company_address: null,
      email_sender_name: null,
      email_sender_address: null,
    };

    const clientName = [client.first_name, client.last_name].filter(Boolean).join(" ") || "Client";

    const { subject, html } = getEmailTemplate(
      notification_kind,
      title,
      message,
      clientName,
      tenantBranding,
      payload
    );

    const senderEmail = tenantBranding.email_sender_address || "noreply@e-advisy.ch";
    const senderName = tenantBranding.email_sender_name || tenantBranding.display_name || "Votre cabinet";

    console.log(`Sending email to ${client.email} from ${senderName} <${senderEmail}>`);

    const emailResponse = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${senderName} <${senderEmail}>`,
        to: [client.email],
        subject,
        html,
      }),
    });

    const emailResult = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error("Resend API error:", emailResult);
      throw new Error(emailResult.message || "Failed to send email");
    }

    console.log("Email sent successfully:", emailResult);

    return new Response(JSON.stringify({ success: true, emailId: emailResult.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error sending notification email:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
