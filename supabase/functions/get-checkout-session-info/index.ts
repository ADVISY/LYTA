/**
 * get-checkout-session-info
 * =========================
 * Appelé par lyta.ch/access au chargement de la page (avec ?session_id=cs_xxx
 * dans l'URL post-redirect Stripe). Retourne les infos utiles pour pré-remplir
 * le formulaire (email du payeur, plan choisi, statut paiement).
 *
 * Public — info non sensible (l'utilisateur connaît son session_id depuis l'URL).
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("get-checkout-session-info");

const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const stripe = new Stripe(STRIPE_KEY, { apiVersion: "2024-09-30.acacia" });

serve(async (req) => {
  const cors = getCorsHeaders(req);
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { session_id?: string };
    const sessionId = body.session_id?.trim();
    if (!sessionId) {
      return new Response(JSON.stringify({ error: "session_id required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Récupère la session + subscription Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "customer"],
    });

    if (!session) {
      return new Response(JSON.stringify({ error: "Session introuvable" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const email = session.customer_email
      || session.customer_details?.email
      || (typeof session.customer === "object" && session.customer && "email" in session.customer ? (session.customer as any).email : null)
      || null;

    const planId = session.metadata?.plan_id || null;

    // Check si un tenant a déjà été provisionné pour cette session (idempotence côté UI)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: existingTenant } = await supabase
      .from("tenants")
      .select("id, slug, name, tenant_status")
      .eq("signup_session_id", sessionId)
      .maybeSingle();

    let planInfo: { id: string; display_name: string; monthly_price: number } | null = null;
    if (planId) {
      const { data: plan } = await supabase
        .from("platform_plans")
        .select("id, display_name, monthly_price")
        .eq("id", planId)
        .maybeSingle();
      if (plan) {
        planInfo = {
          id: plan.id,
          display_name: plan.display_name,
          monthly_price: Number(plan.monthly_price),
        };
      }
    }

    // Date de fin du trial = subscription.trial_end (timestamp Unix Stripe)
    const subscription = session.subscription && typeof session.subscription === "object"
      ? session.subscription
      : null;
    const trialEndUnix = subscription && "trial_end" in subscription ? (subscription as any).trial_end : null;
    const trialEndsAt = trialEndUnix ? new Date(trialEndUnix * 1000).toISOString() : null;

    return new Response(JSON.stringify({
      session_id: sessionId,
      payment_status: session.payment_status,    // 'paid' | 'unpaid' | 'no_payment_required'
      checkout_status: session.status,            // 'open' | 'complete' | 'expired'
      email,
      plan: planInfo,
      trial_ends_at: trialEndsAt,
      // Si le tenant est déjà créé pour cette session → on le renvoie
      // pour que la page /access puisse rediriger direct vers /merci au lieu
      // de re-afficher le formulaire.
      already_provisioned: !!existingTenant,
      tenant: existingTenant ? {
        id: existingTenant.id,
        slug: existingTenant.slug,
        name: existingTenant.name,
        tenant_status: existingTenant.tenant_status,
        url: `https://${existingTenant.slug}.lyta.ch`,
      } : null,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err) {
    log.error("Failed to fetch checkout session", { err: (err as any)?.message });
    return new Response(JSON.stringify({ error: "Internal error", details: (err as any)?.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
