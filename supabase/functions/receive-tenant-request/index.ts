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
      stripeSessionId 
    } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Insert tenant request
    const { data: tenant, error } = await supabase.from("tenants").insert({
      name: companyName,
      slug: subdomain,
      status: "pending",
      settings: {
        contact_name: contactName,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        plan_id: planId,
        stripe_session_id: stripeSessionId,
      }
    }).select().single();

    if (error) throw error;

    // Send notification email to admin
    await sendEmail(
      ["admin@e-advisy.ch"],
      `🎉 Nouveau client Lyta : ${companyName}`,
      `
        <h1>Nouvelle demande de création de tenant</h1>
        <p><strong>Entreprise:</strong> ${companyName}</p>
        <p><strong>Contact:</strong> ${contactName}</p>
        <p><strong>Email:</strong> ${contactEmail}</p>
        <p><strong>Téléphone:</strong> ${contactPhone || "Non renseigné"}</p>
        <p><strong>Sous-domaine:</strong> ${subdomain}.lyta.ch</p>
        <p><strong>Plan:</strong> ${planId}</p>
        <p><a href="https://lyta.ch/king/tenants">Gérer dans le dashboard</a></p>
      `
    );

    return new Response(JSON.stringify({ success: true, tenant }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
