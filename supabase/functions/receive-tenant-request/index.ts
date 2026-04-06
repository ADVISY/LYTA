import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("receive-tenant-request");

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

async function sendEmail(to: string[], subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Lyta <support@lyta.ch>",
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to send email: ${error}`);
  }

  return res.json();
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    await checkRateLimit(req, "receive-tenant-request", 5);

    const {
      companyName,
      contactName, 
      contactEmail, 
      contactPhone, 
      subdomain, 
      planId, 
      stripeSessionId,
      primaryColor,
      secondaryColor,
      backofficeEmail,
      adminEmail,
      logoUrl
    } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate plan_id exists in platform_plans before inserting
    let validPlanId = planId || null;
    if (validPlanId) {
      const { data: plan } = await supabase
        .from("platform_plans")
        .select("id")
        .eq("id", validPlanId)
        .maybeSingle();

      if (!plan) {
        // Fallback to 'start' plan if provided plan_id is invalid
        const { data: defaultPlan } = await supabase
          .from("platform_plans")
          .select("id")
          .eq("slug", "start")
          .maybeSingle();
        validPlanId = defaultPlan?.id || null;
        log.warn("Invalid plan_id provided, falling back to default", { originalPlanId: planId, resolvedPlanId: validPlanId });
      }
    }

    // Insert tenant request with status 'pending'
    const { data: tenant, error } = await supabase.from("tenants").insert({
      name: companyName,
      slug: subdomain,
      email: contactEmail,
      phone: contactPhone,
      contact_name: contactName,
      plan_id: validPlanId,
      stripe_session_id: stripeSessionId,
      backoffice_email: backofficeEmail,
      admin_email: adminEmail,
      status: "pending",
    }).select().single();

    if (error) throw error;

    // Create branding entry if colors or logo provided
    if (primaryColor || secondaryColor || logoUrl) {
      await supabase.from("tenant_branding").insert({
        tenant_id: tenant.id,
        display_name: companyName,
        primary_color: primaryColor || "#3B82F6",
        secondary_color: secondaryColor || "#10B981",
        logo_url: logoUrl || null,
      });
    }

    // Create KING notification for the new tenant request
    await supabase.from("king_notifications").insert({
      kind: "tenant_request",
      priority: "high",
      title: `🎉 Nouvelle demande : ${companyName}`,
      message: `${contactName || 'Nouveau client'} (${contactEmail}) a soumis une demande pour ${subdomain}.lyta.ch avec le plan ${planId || 'start'}.`,
      tenant_id: tenant.id,
      tenant_name: companyName,
      action_label: "Gérer la demande",
      action_url: `/king/tenants/${tenant.id}`,
      metadata: {
        plan_id: planId,
        subdomain: subdomain,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        stripe_session_id: stripeSessionId,
      }
    });

    // Send notification email to admin
    await sendEmail(
      ["support@lyta.ch"],
      `🎉 Nouvelle demande Lyta : ${companyName}`,
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1a1a2e;">Nouvelle demande de tenant</h1>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0; color: #333;">Informations entreprise</h2>
            <p><strong>Entreprise:</strong> ${companyName}</p>
            <p><strong>Contact:</strong> ${contactName}</p>
            <p><strong>Email:</strong> ${contactEmail}</p>
            <p><strong>Téléphone:</strong> ${contactPhone || "Non renseigné"}</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0; color: #333;">Configuration</h2>
            <p><strong>Sous-domaine:</strong> ${subdomain}.lyta.ch</p>
            <p><strong>Plan:</strong> ${planId}</p>
            <p><strong>Email backoffice:</strong> ${backofficeEmail || "Non renseigné"}</p>
            <p><strong>Email admin:</strong> ${adminEmail || "Non renseigné"}</p>
            ${stripeSessionId ? `<p><strong>Session Stripe:</strong> ${stripeSessionId}</p>` : ''}
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://app.lyta.ch/king/tenants/${tenant.id}" 
               style="background: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Gérer la demande
            </a>
          </div>
        </div>
      `
    );

    return new Response(JSON.stringify({ success: true, tenant }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    if (error instanceof RateLimitError) {
      return new Response(
        JSON.stringify({ error: "Trop de requêtes, réessayez plus tard" }),
        {
          status: 429,
          headers: {
            ...getCorsHeaders(req),
            "Content-Type": "application/json",
            "Retry-After": String(error.retryAfter),
          },
        }
      );
    }
    log.error("Full error", { error: error instanceof Error ? { message: error.message, stack: error.stack } : error });
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      status: 500,
    });
  }
});
