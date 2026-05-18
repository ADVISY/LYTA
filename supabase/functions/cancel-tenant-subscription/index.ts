/**
 * cancel-tenant-subscription
 * ===========================
 * Annulation self-service de l'abonnement par le tenant admin.
 *
 * 1. Vérifie que l'appelant est admin du tenant (via requireAuth + user_tenant_roles)
 * 2. Cancel la subscription Stripe avec cancel_at_period_end=true
 *    (le tenant garde son accès jusqu'à la fin de la période payée)
 * 3. Update tenants.cancel_at_period_end + cancellation_requested_at
 * 4. Envoie un email à support@lyta.ch via Resend
 * 5. Insert une notif king priority high
 *
 * Body : { reason?: string } (raison optionnelle de l'annulation pour le king)
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAuth, AuthError } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("cancel-tenant-subscription");

const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const stripe = new Stripe(STRIPE_KEY, { apiVersion: "2024-09-30.acacia" });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPPORT_EMAIL = Deno.env.get("SUPPORT_EMAIL") || "support@lyta.ch";

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
    const { user } = await requireAuth(req);
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Trouve le tenant de l'utilisateur via user_tenant_assignments
    const { data: assignment } = await supabase
      .from("user_tenant_assignments")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!assignment?.tenant_id) {
      throw new AuthError("Aucun tenant associé à ton compte", 403);
    }
    const tenantId = assignment.tenant_id;

    // Vérifie que l'utilisateur est admin (role admin sur user_roles OU king)
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const userRoles = (roles || []).map((r: any) => r.role);
    const isAdmin = userRoles.includes("admin") || userRoles.includes("king");
    if (!isAdmin) {
      throw new AuthError("Seul un administrateur du cabinet peut annuler l'abonnement", 403);
    }

    const body = (await req.json().catch(() => ({}))) as { reason?: string };
    const reason = (body.reason || "").trim().slice(0, 1000);

    // Récupère le tenant + sa subscription Stripe
    const { data: tenant, error: tenantErr } = await supabase
      .from("tenants")
      .select("id, name, slug, email, admin_email, plan, stripe_customer_id, stripe_subscription_id, mrr_amount, billing_mode")
      .eq("id", tenantId)
      .single();
    if (tenantErr || !tenant) {
      throw new AuthError("Tenant introuvable", 404);
    }

    if (tenant.billing_mode === "internal") {
      throw new AuthError("Ce tenant est en facturation interne (pas de Stripe à annuler)", 400);
    }
    if (!tenant.stripe_subscription_id) {
      throw new AuthError("Aucune subscription Stripe active pour ce tenant", 400);
    }

    // Cancel sur Stripe : cancel_at_period_end = true (le user garde l'accès
    // jusqu'à la fin de la période payée — pas de remboursement pro-rata)
    let stripeSub: any;
    try {
      stripeSub = await stripe.subscriptions.update(tenant.stripe_subscription_id, {
        cancel_at_period_end: true,
        metadata: {
          cancellation_requested_by: user.email || user.id,
          cancellation_reason: reason || "(non précisée)",
          cancellation_requested_at: new Date().toISOString(),
        },
      });
    } catch (e) {
      log.error("Stripe subscription update failed", { err: (e as any)?.message });
      throw new AuthError(`Erreur Stripe : ${(e as any)?.message || "annulation impossible"}`, 502);
    }

    const periodEnd = stripeSub.current_period_end
      ? new Date(stripeSub.current_period_end * 1000).toISOString()
      : null;

    // Update DB tenant — on garde status='active' tant que la période n'est
    // pas terminée. Le webhook customer.subscription.deleted basculera en
    // 'cancelled' à la fin.
    await supabase
      .from("tenants")
      .update({
        cancel_at_period_end: true,
        cancellation_requested_at: new Date().toISOString(),
        cancellation_reason: reason || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tenantId);

    // Notif King priorité haute
    await supabase.from("king_notifications").insert({
      title: "🚪 Demande d'annulation",
      message: `${tenant.name} (plan ${tenant.plan || "?"}) a demandé l'annulation. Période payée jusqu'au ${periodEnd ? new Date(periodEnd).toLocaleDateString("fr-CH") : "?"}.`,
      kind: "subscription_cancellation_requested",
      priority: "high",
      tenant_id: tenantId,
      tenant_name: tenant.name,
      action_url: `/king/tenants/${tenantId}`,
      action_label: "Voir le tenant",
      metadata: {
        cancellation_requested_by: user.email || user.id,
        cancellation_reason: reason || null,
        mrr_lost: tenant.mrr_amount,
        plan: tenant.plan,
        period_end: periodEnd,
        stripe_subscription_id: tenant.stripe_subscription_id,
      },
    }).catch(() => null);

    // Email support@lyta.ch via Resend (fire-and-forget)
    if (RESEND_API_KEY) {
      const html = `<!doctype html><html><body style="font-family:-apple-system,sans-serif;background:#f5f5f5;padding:24px;margin:0">
        <div style="max-width:560px;margin:auto;background:white;border-radius:12px;padding:32px">
          <h2 style="color:#dc2626;margin:0 0 12px">🚪 Annulation abonnement demandée</h2>
          <p style="color:#444">Le cabinet <strong>${tenant.name}</strong> vient d'annuler son abonnement LYTA depuis l'espace tenant.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:8px 0;color:#888">Tenant</td><td style="padding:8px 0"><strong>${tenant.name}</strong> (${tenant.slug}.lyta.ch)</td></tr>
            <tr><td style="padding:8px 0;color:#888">Plan</td><td style="padding:8px 0">${tenant.plan || "—"}</td></tr>
            <tr><td style="padding:8px 0;color:#888">MRR perdu</td><td style="padding:8px 0"><strong>${tenant.mrr_amount || 0} CHF/mois</strong></td></tr>
            <tr><td style="padding:8px 0;color:#888">Demandé par</td><td style="padding:8px 0">${user.email || user.id}</td></tr>
            <tr><td style="padding:8px 0;color:#888">Fin de période payée</td><td style="padding:8px 0">${periodEnd ? new Date(periodEnd).toLocaleString("fr-CH") : "—"}</td></tr>
            ${reason ? `<tr><td style="padding:8px 0;color:#888;vertical-align:top">Raison</td><td style="padding:8px 0;white-space:pre-wrap">${reason.replace(/</g, "&lt;")}</td></tr>` : ""}
          </table>
          <p style="font-size:13px;color:#666;margin-top:16px">L'accès du tenant reste actif jusqu'à la fin de la période payée. Le webhook Stripe basculera automatiquement le tenant en 'cancelled' à l'expiration.</p>
          <p style="margin-top:24px">
            <a href="https://app.lyta.ch/king/tenants/${tenantId}" style="background:#1800AD;color:white;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600">Ouvrir dans King</a>
          </p>
        </div></body></html>`;
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "LYTA Alerts <support@lyta.ch>",
          to: [SUPPORT_EMAIL],
          subject: `🚪 Annulation — ${tenant.name} (${tenant.mrr_amount || 0} CHF/mois)`,
          html,
        }),
      }).catch(e => log.warn("Resend support email failed", { err: (e as any)?.message }));
    } else {
      log.warn("RESEND_API_KEY absent — email support non envoyé");
    }

    return new Response(JSON.stringify({
      ok: true,
      cancel_at_period_end: true,
      period_end: periodEnd,
      message: `Annulation enregistrée. Ton accès reste actif jusqu'au ${periodEnd ? new Date(periodEnd).toLocaleDateString("fr-CH") : "?"}.`,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err) {
    if (err instanceof AuthError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: err.status, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    log.error("Unexpected error", { err: (err as any)?.message });
    return new Response(JSON.stringify({ error: "Internal error", details: (err as any)?.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
