import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Stripe product IDs mapped to plans
const PRODUCT_TO_PLAN: Record<string, string> = {
  'prod_TjgUGx2FNdlhas': 'start',
  'prod_TjgmLXohud7WAb': 'pro',
  'prod_TjgrBLxInrbnSd': 'prime',
  'prod_Tk0TPGFCuYQu3Q': 'founder',
};

// Price per user for extra seats (20 CHF)
const EXTRA_USER_PRICE_ID = 'price_1SmZtZF7ZITS358Au3FHsdBA';

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // Verify King role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    
    const token = authHeader.replace("Bearer ", "");
    const { data, error: claimsError } = await supabaseClient.auth.getUser(token);
    if (claimsError || !data?.user) throw new Error(`Auth error: ${claimsError?.message || 'User not found'}`);
    
    const user = data.user;
    
    // Check if user is King
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'king')
      .single();
    
    if (!roleData) throw new Error("Unauthorized: King role required");

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Fetch all active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      status: 'active',
      limit: 100,
      expand: ['data.items.data.price'],
    });

    // Fetch all past_due subscriptions too
    const pastDueSubscriptions = await stripe.subscriptions.list({
      status: 'past_due',
      limit: 100,
      expand: ['data.items.data.price'],
    });

    // Combine subscriptions
    const allSubscriptions = [...subscriptions.data, ...pastDueSubscriptions.data];

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
        console.error(`Error fetching customer ${customerId}:`, e);
      }
    }

    // Get recent payments for revenue chart
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    
    const payments = await stripe.paymentIntents.list({
      created: { gte: Math.floor(sixMonthsAgo.getTime() / 1000) },
      limit: 100,
    });

    // Group payments by month
    const monthlyRevenue: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = date.toLocaleDateString('fr-CH', { month: 'short', year: '2-digit' });
      monthlyRevenue[key] = 0;
    }

    for (const payment of payments.data) {
      if (payment.status === 'succeeded') {
        const date = new Date(payment.created * 1000);
        const key = date.toLocaleDateString('fr-CH', { month: 'short', year: '2-digit' });
        if (monthlyRevenue.hasOwnProperty(key)) {
          monthlyRevenue[key] += (payment.amount / 100);
        }
      }
    }

    // Get upcoming invoices value
    let upcomingInvoicesTotal = 0;
    try {
      const invoices = await stripe.invoices.list({
        status: 'open',
        limit: 100,
      });
      upcomingInvoicesTotal = invoices.data.reduce((sum: number, inv: { amount_due: number }) => sum + (inv.amount_due / 100), 0);
    } catch (e) {
      console.error('Error fetching invoices:', e);
    }

    // Prepare revenue chart data
    const revenueChartData = Object.entries(monthlyRevenue).map(([month, revenue]) => ({
      month,
      revenue,
    }));

    return new Response(JSON.stringify({
      mrr: totalMRR,
      arr: totalMRR * 12,
      extraUsersMRR,
      upcomingInvoices: upcomingInvoicesTotal,
      planStats: planCounts,
      revenueChart: revenueChartData,
      totalActiveSubscriptions: allSubscriptions.filter(s => s.status === 'active').length,
      totalPastDueSubscriptions: allSubscriptions.filter(s => s.status === 'past_due').length,
      tenantSubscriptions,
      customerEmails,
    }), {
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
