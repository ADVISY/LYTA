import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

async function sendEmail(to: string[], subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Lyta <notifications@e-advisy.ch>",
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // Insert tenant request with status 'pending'
    const { data: tenant, error } = await supabase.from("tenants").insert({
      name: companyName,
      slug: subdomain,
      email: contactEmail,
      phone: contactPhone,
      contact_name: contactName,
      plan_id: planId,
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
            <a href="https://app.lyta.ch/king/tenants" 
               style="background: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Gérer dans le dashboard
            </a>
          </div>
        </div>
      `
    );

    return new Response(JSON.stringify({ success: true, tenant }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    console.error("Full error:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
