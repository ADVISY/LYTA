/**
 * list-tenant-invoices
 * ====================
 * King-only : retourne l'historique des invoices Stripe pour un tenant donné.
 * Pull direct depuis l'API Stripe via stripe_customer_id du tenant.
 *
 * Body : { tenant_id: "uuid", limit?: 50 }
 * Réponse : { invoices: [{ id, number, created, amount_paid, amount_due,
 *   status, hosted_invoice_url, invoice_pdf, period_start, period_end }], ... }
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAuth, AuthError } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("list-tenant-invoices");

const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const stripe = new Stripe(STRIPE_KEY, { apiVersion: "2024-09-30.acacia" });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    // King-only
    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id);
    const isKing = (roles || []).some((r: any) => r.role === "king" || r.role === "admin");
    if (!isKing) {
      throw new AuthError("Forbidden — king/admin required", 403);
    }

    const body = (await req.json().catch(() => ({}))) as { tenant_id?: string; limit?: number };
    if (!body.tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, name, slug, email, stripe_customer_id, stripe_subscription_id, billing_mode")
      .eq("id", body.tenant_id)
      .maybeSingle();
    if (!tenant) {
      return new Response(JSON.stringify({ error: "Tenant introuvable" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (!tenant.stripe_customer_id) {
      return new Response(JSON.stringify({
        tenant: { id: tenant.id, name: tenant.name, billing_mode: tenant.billing_mode },
        invoices: [],
        total_paid_chf: 0,
        upcoming: null,
        stripe_customer_url: null,
        warning: "Aucun Stripe customer lié à ce tenant. Lance 'Sync Stripe' depuis la fiche pour le rattacher.",
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const limit = Math.min(Math.max(body.limit ?? 50, 1), 100);

    // Récupère les invoices + upcoming
    const [invoicesList, upcoming] = await Promise.all([
      stripe.invoices.list({
        customer: tenant.stripe_customer_id,
        limit,
      }),
      stripe.invoices.retrieveUpcoming({ customer: tenant.stripe_customer_id }).catch(() => null),
    ]);

    const invoices = invoicesList.data.map(inv => ({
      id: inv.id,
      number: inv.number,
      created: inv.created,
      created_iso: new Date(inv.created * 1000).toISOString(),
      amount_paid_chf: (inv.amount_paid ?? 0) / 100,
      amount_due_chf: (inv.amount_due ?? 0) / 100,
      amount_remaining_chf: (inv.amount_remaining ?? 0) / 100,
      total_chf: (inv.total ?? 0) / 100,
      currency: inv.currency?.toUpperCase() || "CHF",
      status: inv.status, // 'draft' | 'open' | 'paid' | 'uncollectible' | 'void'
      paid: inv.paid,
      hosted_invoice_url: inv.hosted_invoice_url,
      invoice_pdf: inv.invoice_pdf,
      period_start_iso: inv.period_start ? new Date(inv.period_start * 1000).toISOString() : null,
      period_end_iso: inv.period_end ? new Date(inv.period_end * 1000).toISOString() : null,
      due_date_iso: inv.due_date ? new Date(inv.due_date * 1000).toISOString() : null,
      description: inv.description,
    }));

    const totalPaidChf = invoices
      .filter(i => i.status === "paid")
      .reduce((sum, i) => sum + i.amount_paid_chf, 0);

    return new Response(JSON.stringify({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        billing_mode: tenant.billing_mode,
        stripe_customer_id: tenant.stripe_customer_id,
        stripe_subscription_id: tenant.stripe_subscription_id,
      },
      invoices,
      total_paid_chf: totalPaidChf,
      upcoming: upcoming ? {
        amount_due_chf: ((upcoming as any).amount_due ?? 0) / 100,
        period_start_iso: (upcoming as any).period_start ? new Date((upcoming as any).period_start * 1000).toISOString() : null,
        period_end_iso: (upcoming as any).period_end ? new Date((upcoming as any).period_end * 1000).toISOString() : null,
      } : null,
      stripe_customer_url: `https://dashboard.stripe.com/customers/${tenant.stripe_customer_id}`,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err) {
    if (err instanceof AuthError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: err.status, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    log.error("Failed to list invoices", { err: (err as any)?.message });
    return new Response(JSON.stringify({ error: "Internal error", details: (err as any)?.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
