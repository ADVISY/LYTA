import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAuth, AuthError } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("king-stripe-stats");

// Stripe product IDs mapped to plans (fallback if DB unavailable)
const FALLBACK_PRODUCT_TO_PLAN: Record<string, string> = {
  'prod_TjgUGx2FNdlhas': 'start',
  'prod_TjgmLXohud7WAb': 'pro',
  'prod_TjgrBLxInrbnSd': 'prime',
  'prod_Tk0TPGFCuYQu3Q': 'founder',
};

// Price per user for extra seats — fallback (20 CHF)
const FALLBACK_EXTRA_USER_PRICE_ID = 'price_1SmZtZF7ZITS358Au3FHsdBA';

async function getProductToPlanMap(supabaseAdmin: ReturnType<typeof createClient>): Promise<Record<string, string>> {
  const { data, error } = await supabaseAdmin
    .from('platform_plans')
    .select('id, stripe_product_id')
    .eq('is_active', true);

  if (error || !data || data.length === 0) {
    log.warn("Failed to fetch plan mapping from DB, using fallback", { error: error?.message });
    return FALLBACK_PRODUCT_TO_PLAN;
  }

  return Object.fromEntries(
    data
      .filter((p: any) => p.stripe_product_id)
      .map((p: any) => [p.stripe_product_id, p.id])
  );
}

async function getExtraUserPriceId(supabaseAdmin: ReturnType<typeof createClient>): Promise<string> {
  const { data } = await supabaseAdmin
    .from('platform_settings')
    .select('value')
    .eq('key', 'extra_user_price_id')
    .single();
  return (data?.value as string) || FALLBACK_EXTRA_USER_PRICE_ID;
}

async function collectStripeList<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of iterable) {
    items.push(item);
  }
  return items;
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Verify caller identity via shared auth
    const { user } = await requireAuth(req);
    log.info("User verified", { userId: user.id });

    // Create Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const PRODUCT_TO_PLAN = await getProductToPlanMap(supabaseAdmin);
    const EXTRA_USER_PRICE_ID = await getExtraUserPriceId(supabaseAdmin);

    // Check if user is King
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'king')
      .single();
    
    if (roleError) {
      log.error("Role check error", { error: roleError });
    }
    
    if (!roleData) throw new Error("Unauthorized: King role required");

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const activeSubscriptions = await collectStripeList(
      stripe.subscriptions.list({
        status: 'active',
        limit: 100,
        expand: ['data.items.data.price'],
      })
    );

    const pastDueSubscriptions = await collectStripeList(
      stripe.subscriptions.list({
        status: 'past_due',
        limit: 100,
        expand: ['data.items.data.price'],
      })
    );

    const trialingSubscriptions = await collectStripeList(
      stripe.subscriptions.list({
        status: 'trialing',
        limit: 100,
        expand: ['data.items.data.price'],
      })
    );

    const allSubscriptions = [...activeSubscriptions, ...pastDueSubscriptions, ...trialingSubscriptions];

    // Calculate MRR and stats
    let totalMRR = 0;
    let extraUsersMRR = 0;
    const planCounts: Record<string, { count: number; mrr: number }> = {
      start: { count: 0, mrr: 0 },
      pro: { count: 0, mrr: 0 },
      prime: { count: 0, mrr: 0 },
      founder: { count: 0, mrr: 0 },
    };
    
    const tenantSubscriptions: Record<string, { 
      plan: string; 
      mrr: number; 
      extraUsers: number;
      status: string;
      subscriptionId: string;
      customerId: string;
      currentPeriodEnd: string;
    }> = {};

    for (const sub of allSubscriptions) {
      let subMRR = 0;
      let planName = 'start';
      let extraUsers = 0;

      for (const item of sub.items.data) {
        const price = item.price;
        const productId = typeof price.product === 'string' ? price.product : price.product?.id;
        const amount = price.unit_amount || 0;
        const quantity = item.quantity || 1;
        
        // Convert to monthly if yearly
        let monthlyAmount = amount;
        if (price.recurring?.interval === 'year') {
          monthlyAmount = Math.round(amount / 12);
        }
        
        const itemMRR = (monthlyAmount * quantity) / 100; // Convert from cents
        subMRR += itemMRR;

        // Check if this is a plan subscription
        if (productId && PRODUCT_TO_PLAN[productId]) {
          planName = PRODUCT_TO_PLAN[productId];
          planCounts[planName].count++;
          planCounts[planName].mrr += itemMRR;
        }
        
        // Check if extra users
        if (price.id === EXTRA_USER_PRICE_ID) {
          extraUsers = quantity;
          extraUsersMRR += itemMRR;
        }
      }

      totalMRR += subMRR;

      // Store subscription by customer email (will be matched to tenant later)
      tenantSubscriptions[sub.customer as string] = {
        plan: planName,
        mrr: subMRR,
        extraUsers,
        status: sub.status,
        subscriptionId: sub.id,
        customerId: sub.customer as string,
        currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
      };
    }

    // Get customer emails to match with tenants
    const customerIds = Object.keys(tenantSubscriptions);
    const customerEmails: Record<string, string> = {};
    
    for (const customerId of customerIds) {
      try {
        const customer = await stripe.customers.retrieve(customerId);
        if (customer && !customer.deleted && customer.email) {
          customerEmails[customerId] = customer.email;
        }
      } catch (e) {
        log.error(`Error fetching customer`, { customerId, error: e instanceof Error ? e.message : e });
      }
    }

    // Get recent payments for revenue chart
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    
    const paidInvoices = await collectStripeList(
      stripe.invoices.list({
        created: { gte: Math.floor(sixMonthsAgo.getTime() / 1000) },
        limit: 100,
      })
    );

    // Group payments by month — 12 mois glissants + 12 mois N-1 (pour YoY)
    const monthlyRevenue: Record<string, number> = {};
    const monthlyRevenuePrevYear: Record<string, number> = {};
    const keyByMonthIdx: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = date.toLocaleDateString('fr-CH', { month: 'short', year: '2-digit' });
      monthlyRevenue[key] = 0;
      monthlyRevenuePrevYear[key] = 0;
      keyByMonthIdx.push(key);
    }

    // Cutoffs pour matcher invoice → mois N ou N-1
    const startN = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const startNMinus1 = new Date(now.getFullYear() - 1, now.getMonth() - 11, 1);
    const endNMinus1 = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1);

    for (const invoice of paidInvoices) {
      if (invoice.status !== 'paid' && !invoice.paid) continue;
      const paidAt = invoice.status_transitions?.paid_at || invoice.created;
      const date = new Date(paidAt * 1000);
      const amount = (invoice.amount_paid || invoice.amount_due || 0) / 100;

      if (date >= startN) {
        const key = date.toLocaleDateString('fr-CH', { month: 'short', year: '2-digit' });
        if (monthlyRevenue.hasOwnProperty(key)) monthlyRevenue[key] += amount;
      } else if (date >= startNMinus1 && date < endNMinus1) {
        // Map à la position équivalente de cette année (même mois) pour comparaison
        const monthsAgo = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
        const idx = 11 - (monthsAgo - 12);
        if (idx >= 0 && idx < keyByMonthIdx.length) {
          monthlyRevenuePrevYear[keyByMonthIdx[idx]] += amount;
        }
      }
    }

    // Get upcoming invoices value
    let upcomingInvoicesTotal = 0;
    try {
      const openInvoices = await collectStripeList(
        stripe.invoices.list({
          status: 'open',
          limit: 100,
        })
      );
      upcomingInvoicesTotal = openInvoices.reduce((sum: number, inv: { amount_due: number }) => sum + (inv.amount_due / 100), 0);
    } catch (e) {
      log.error('Error fetching invoices', { error: e instanceof Error ? e.message : e });
    }

    // Prepare revenue chart data (12 mois + revenue_prev_year pour YoY)
    const revenueChartData = Object.entries(monthlyRevenue).map(([month, revenue]) => ({
      month,
      revenue,
      revenue_prev_year: monthlyRevenuePrevYear[month] || 0,
    }));

    return new Response(JSON.stringify({
      mrr: totalMRR,
      arr: totalMRR * 12,
      extraUsersMRR,
      upcomingInvoices: upcomingInvoicesTotal,
      planStats: planCounts,
      revenueChart: revenueChartData,
      totalActiveSubscriptions: activeSubscriptions.length,
      totalPastDueSubscriptions: pastDueSubscriptions.length,
      totalTrialingSubscriptions: trialingSubscriptions.length,
      tenantSubscriptions,
      customerEmails,
    }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        status: error.status,
      });
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error("Error", { error: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      status: 500,
    });
  }
});
