/**
 * create-checkout-session
 * =======================
 * Appelé par lyta.ch (Lovable) au clic "Commencer mon essai 7 jours".
 * Crée une session Stripe Checkout avec trial 7j sur le plan choisi, puis
 * retourne l'URL pour rediriger le visiteur.
 *
 * Public (pas d'auth) — c'est un endpoint pré-inscription.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("create-checkout-session");

const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const stripe = new Stripe(STRIPE_KEY, { apiVersion: "2024-09-30.acacia" });

const SITE_BASE = Deno.env.get("PUBLIC_SITE_URL") || "https://lyta.ch";
// La page de finalisation post-paiement vit dans app.lyta.ch (ce repo),
// pas sur lyta.ch (Lovable). On contrôle 100% du flow critique.
const APP_BASE  = Deno.env.get("PUBLIC_APP_URL")  || "https://app.lyta.ch";
const DEFAULT_SUCCESS_URL = `${APP_BASE}/finalize?session_id={CHECKOUT_SESSION_ID}`;
const DEFAULT_CANCEL_URL  = `${SITE_BASE}/inscription/echec`;

const TRIAL_DAYS = 7;

interface ReqBody {
  plan_id?: string;        // 'start' | 'pro' | 'prime' | 'founder'
  email?: string;
  success_url?: string;
  cancel_url?: string;
  affiliate_ref?: string;  // ?ref=CODE depuis lyta.ch (tracking apporteur d'affaires)
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as ReqBody;
    const planId = (body.plan_id || "").toLowerCase().trim();
    const email  = (body.email || "").trim().toLowerCase();

    if (!planId) {
      return new Response(JSON.stringify({ error: "plan_id required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "valid email required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Récupère le price_id Stripe depuis la table platform_plans
    const { data: plan, error: planErr } = await supabase
      .from("platform_plans")
      .select("id, display_name, stripe_price_id, stripe_product_id, monthly_price")
      .eq("id", planId)
      .eq("is_active", true)
      .maybeSingle();

    if (planErr || !plan) {
      log.warn("Unknown plan requested", { planId, error: planErr?.message });
      return new Response(JSON.stringify({ error: `Plan inconnu: ${planId}` }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    if (!plan.stripe_price_id) {
      log.error("Plan has no stripe_price_id", { planId });
      return new Response(JSON.stringify({ error: "Plan mal configuré (stripe_price_id manquant)" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Refus si l'email correspond déjà à un tenant actif
    const { data: existingTenant } = await supabase
      .from("tenants")
      .select("id, slug, tenant_status")
      .or(`email.eq.${email},admin_email.eq.${email}`)
      .neq("tenant_status", "suspended")
      .limit(1)
      .maybeSingle();
    if (existingTenant) {
      return new Response(JSON.stringify({
        error: "already_registered",
        message: "Un cabinet est déjà inscrit avec cet email. Connecte-toi à la place.",
        login_url: `${SITE_BASE.replace(/\/$/, "")}/connexion`,
      }), {
        status: 409, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Affiliate tracking : si ref valide trouvé en base, on l'attache aux metadata
    let affiliateRefValidated: string | null = null;
    if (body.affiliate_ref && body.affiliate_ref.trim()) {
      const ref = body.affiliate_ref.trim().toLowerCase();
      const { data: affiliate } = await supabase
        .from("affiliates")
        .select("id, status")
        .eq("status", "active")
        .filter("ref_code", "ilike", ref)
        .maybeSingle();
      if (affiliate) {
        affiliateRefValidated = ref;
      }
    }

    const metadata: Record<string, string> = {
      signup_flow: "true",
      plan_id: planId,
      email,
    };
    if (affiliateRefValidated) metadata.affiliate_ref = affiliateRefValidated;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      customer_email: email,
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        metadata,
      },
      metadata,
      success_url: body.success_url || DEFAULT_SUCCESS_URL,
      cancel_url:  body.cancel_url  || DEFAULT_CANCEL_URL,
      allow_promotion_codes: true,
      // Encourage Stripe à pré-remplir adresse facturation
      billing_address_collection: "auto",
    });

    log.info("Checkout session created", {
      sessionId: session.id, planId, email,
    });

    return new Response(JSON.stringify({
      session_id: session.id,
      checkout_url: session.url,
      plan: {
        id: plan.id,
        display_name: plan.display_name,
        monthly_price: plan.monthly_price,
      },
      trial_days: TRIAL_DAYS,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err) {
    log.error("Stripe checkout creation failed", { err: (err as any)?.message });
    return new Response(JSON.stringify({ error: "Internal error", details: (err as any)?.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
