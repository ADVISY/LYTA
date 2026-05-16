/**
 * sync-tenant-stripe
 * ==================
 * Va chercher dans Stripe les customers + subscriptions qui matchent les
 * tenants LYTA par email, et met à jour la BDD automatiquement.
 *
 * Usage :
 *   POST { tenant_id: "uuid" }  → sync 1 tenant
 *   POST { all: true }           → sync TOUS les tenants (admin uniquement)
 *
 * Pour chaque tenant :
 * - Cherche stripe.customers par email du tenant
 * - Pour chaque customer trouvé : list subscriptions actives
 * - Si exactement 1 sub active → link automatique + recalcul MRR/plan/status
 * - Si plusieurs → log "ambigu" + notification king
 * - Si aucune → tenant reste tel quel
 *
 * Promo auto : un tenant qui obtient une sub Stripe passe en billing_mode='paying'
 * sauf s'il est 'internal' (Advisy, Demo) — qu'on respecte.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAuth, AuthError } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("sync-tenant-stripe");

const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const stripe = new Stripe(STRIPE_KEY, { apiVersion: "2024-09-30.acacia" });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const FALLBACK_PRODUCT_TO_PLAN: Record<string, string> = {
  'prod_TjgUGx2FNdlhas': 'start',
  'prod_TjgmLXohud7WAb': 'pro',
  'prod_TjgrBLxInrbnSd': 'prime',
  'prod_Tk0TPGFCuYQu3Q': 'founder',
};

async function getPriceToPlanMap(supabase: ReturnType<typeof createClient>) {
  const { data } = await supabase
    .from('platform_plans')
    .select('id, stripe_product_id, stripe_price_id');
  const productMap: Record<string, string> = { ...FALLBACK_PRODUCT_TO_PLAN };
  const priceMap: Record<string, string> = {};
  (data || []).forEach((p: any) => {
    if (p.stripe_product_id) productMap[p.stripe_product_id] = p.id;
    if (p.stripe_price_id) priceMap[p.stripe_price_id] = p.id;
  });
  return { productMap, priceMap };
}

function resolvePlan(sub: any, productMap: Record<string,string>, priceMap: Record<string,string>): string | null {
  const item = sub.items?.data?.[0];
  if (!item) return null;
  const priceId = item.price?.id;
  const productId = typeof item.price?.product === "string" ? item.price.product : item.price?.product?.id;
  return priceMap[priceId] || productMap[productId] || null;
}

function resolvePaymentStatus(sub: any): string {
  if (sub.status === 'trialing') return 'trialing';
  if (sub.status === 'active')   return 'paid';
  if (sub.status === 'past_due') return 'past_due';
  if (sub.status === 'canceled') return 'cancelled';
  if (sub.status === 'incomplete' || sub.status === 'incomplete_expired') return 'incomplete';
  if (sub.status === 'unpaid') return 'unpaid';
  return sub.status;
}

interface SyncResult {
  tenant_id: string;
  tenant_name: string;
  email: string;
  status: 'updated' | 'no_change' | 'no_stripe_match' | 'ambiguous' | 'error';
  matched_customer_id?: string;
  matched_subscription_id?: string;
  plan?: string;
  mrr?: number;
  message?: string;
}

async function syncOneTenant(
  tenant: any,
  productMap: Record<string,string>,
  priceMap: Record<string,string>,
  supabase: ReturnType<typeof createClient>,
): Promise<SyncResult> {
  const result: SyncResult = {
    tenant_id: tenant.id,
    tenant_name: tenant.name,
    email: tenant.email || tenant.admin_email,
    status: 'no_change',
  };

  const email = (tenant.email || tenant.admin_email || "").trim().toLowerCase();
  if (!email) {
    return { ...result, status: 'error', message: 'Pas d\'email sur le tenant' };
  }

  // Cherche tous les customers Stripe avec cet email
  let customers: any[] = [];
  try {
    const list = await stripe.customers.list({ email, limit: 10 });
    customers = list.data;
  } catch (e) {
    return { ...result, status: 'error', message: `Stripe customers.list failed: ${(e as any)?.message}` };
  }

  if (customers.length === 0) {
    return { ...result, status: 'no_stripe_match', message: 'Aucun customer Stripe avec cet email' };
  }

  // Liste toutes les subs actives sur tous les customers trouvés
  const activeSubs: { customer: any, sub: any }[] = [];
  for (const c of customers) {
    try {
      const subs = await stripe.subscriptions.list({
        customer: c.id,
        status: 'all',
        limit: 10,
      });
      for (const s of subs.data) {
        if (['active','trialing','past_due','unpaid'].includes(s.status)) {
          activeSubs.push({ customer: c, sub: s });
        }
      }
    } catch (e) {
      log.warn('subscriptions.list failed', { customerId: c.id, err: (e as any)?.message });
    }
  }

  if (activeSubs.length === 0) {
    return { ...result, status: 'no_stripe_match', message: `Customer trouvé (${customers[0].id}) mais aucune subscription active` };
  }

  if (activeSubs.length > 1) {
    // Notif king pour intervention manuelle
    await supabase.from('king_notifications').insert({
      title: '⚠️ Sync Stripe ambiguë',
      message: `${tenant.name} a ${activeSubs.length} subscriptions actives sur Stripe (email=${email}). Intervention requise.`,
      kind: 'sync_ambiguous',
      priority: 'high',
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      action_url: `/king/tenants/${tenant.id}`,
      action_label: 'Voir le tenant',
      metadata: { customer_ids: activeSubs.map(a => a.customer.id), sub_ids: activeSubs.map(a => a.sub.id) },
    }).catch(() => null);
    return { ...result, status: 'ambiguous', message: `${activeSubs.length} subs actives — intervention requise` };
  }

  const { customer, sub } = activeSubs[0];
  const plan = resolvePlan(sub, productMap, priceMap);
  const item = sub.items?.data?.[0];
  const unitAmount = item?.price?.unit_amount ?? 0;
  const mrr = unitAmount / 100;
  const trialEndsAt = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;
  const paymentStatus = resolvePaymentStatus(sub);

  // Si tenant est déjà 'internal', on ne change pas son billing_mode même
  // s'il a une sub Stripe (Habib a explicitement marqué Advisy/Demo en internal)
  const newBillingMode = tenant.billing_mode === 'internal' ? 'internal' : 'paying';

  const updatePayload: Record<string, any> = {
    stripe_customer_id: customer.id,
    stripe_subscription_id: sub.id,
    mrr_amount: mrr,
    payment_status: paymentStatus,
    billing_mode: newBillingMode,
    trial_ends_at: trialEndsAt,
    updated_at: new Date().toISOString(),
  };
  if (plan) updatePayload.plan = plan;

  const noChange =
    tenant.stripe_customer_id === customer.id &&
    tenant.stripe_subscription_id === sub.id &&
    Number(tenant.mrr_amount || 0) === mrr &&
    tenant.payment_status === paymentStatus &&
    (tenant.plan === plan || !plan);

  if (noChange) {
    return {
      ...result,
      status: 'no_change',
      matched_customer_id: customer.id,
      matched_subscription_id: sub.id,
      plan: plan || undefined,
      mrr,
      message: 'Déjà à jour',
    };
  }

  const { error: updateErr } = await supabase
    .from('tenants')
    .update(updatePayload)
    .eq('id', tenant.id);

  if (updateErr) {
    return { ...result, status: 'error', message: `Update échoué: ${updateErr.message}` };
  }

  return {
    ...result,
    status: 'updated',
    matched_customer_id: customer.id,
    matched_subscription_id: sub.id,
    plan: plan || undefined,
    mrr,
    message: `Linked ${customer.id} / ${sub.id} (plan=${plan ?? '?'}, mrr=${mrr})`,
  };
}

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
    // Auth requise (king ou admin uniquement)
    const { user } = await requireAuth(req);
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Vérifie le rôle king
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    const isKing = (roles || []).some((r: any) => r.role === 'king' || r.role === 'admin');
    if (!isKing) {
      throw new AuthError('Forbidden — king/admin required', 403);
    }

    const body = (await req.json().catch(() => ({}))) as { tenant_id?: string; all?: boolean };

    const { productMap, priceMap } = await getPriceToPlanMap(supabase);

    if (body.tenant_id) {
      // Sync un seul tenant
      const { data: tenant } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', body.tenant_id)
        .maybeSingle();
      if (!tenant) {
        return new Response(JSON.stringify({ error: 'Tenant introuvable' }), {
          status: 404, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      const result = await syncOneTenant(tenant, productMap, priceMap, supabase);
      log.info('sync-tenant-stripe single', { result });
      return new Response(JSON.stringify({ ok: true, results: [result] }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (body.all) {
      // Sync tous les tenants
      const { data: tenants } = await supabase
        .from('tenants')
        .select('*')
        .neq('billing_mode', 'free');  // skip les explicit free
      const results: SyncResult[] = [];
      for (const t of (tenants || [])) {
        const r = await syncOneTenant(t, productMap, priceMap, supabase);
        results.push(r);
      }
      const summary = {
        total: results.length,
        updated: results.filter(r => r.status === 'updated').length,
        no_change: results.filter(r => r.status === 'no_change').length,
        no_stripe_match: results.filter(r => r.status === 'no_stripe_match').length,
        ambiguous: results.filter(r => r.status === 'ambiguous').length,
        errors: results.filter(r => r.status === 'error').length,
      };
      log.info('sync-tenant-stripe bulk', summary);
      return new Response(JSON.stringify({ ok: true, summary, results }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: 'tenant_id or all=true required' }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: err.status, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    log.error('Unexpected error', { err: (err as any)?.message });
    return new Response(JSON.stringify({ error: 'Internal error', details: (err as any)?.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
