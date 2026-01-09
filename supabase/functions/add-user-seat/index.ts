import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LYTA_USER_PRICE_ID = "price_1SmZtZF7ZITS358Au3FHsdBA";

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADD-USER-SEAT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Get user's tenant
    const { data: tenantAssignment, error: tenantError } = await supabaseClient
      .from("user_tenant_assignments")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (tenantError || !tenantAssignment) {
      throw new Error("User is not assigned to any tenant");
    }

    const tenantId = tenantAssignment.tenant_id;
    logStep("Found tenant", { tenantId });

    // Get tenant data
    const { data: tenant, error: fetchError } = await supabaseClient
      .from("tenants")
      .select("id, name, stripe_customer_id, stripe_subscription_id, seats_included, extra_users")
      .eq("id", tenantId)
      .single();

    if (fetchError || !tenant) {
      throw new Error("Tenant not found");
    }
    logStep("Tenant data", { 
      name: tenant.name, 
      stripeCustomerId: tenant.stripe_customer_id,
      stripeSubscriptionId: tenant.stripe_subscription_id 
    });

    if (!tenant.stripe_customer_id || !tenant.stripe_subscription_id) {
      throw new Error("Tenant does not have an active Stripe subscription");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Get current subscription to check for existing seat items
    const subscription = await stripe.subscriptions.retrieve(tenant.stripe_subscription_id);
    logStep("Subscription retrieved", { subscriptionId: subscription.id, status: subscription.status });

    // Check if user seat price already exists in subscription
    const existingSeatItem = subscription.items.data.find(
      (item: { price: { id: string }; quantity?: number; id: string }) => item.price.id === LYTA_USER_PRICE_ID
    );

    if (existingSeatItem) {
      // Increment quantity on existing item
      logStep("Incrementing existing seat item", { 
        itemId: existingSeatItem.id, 
        currentQuantity: existingSeatItem.quantity 
      });

      await stripe.subscriptions.update(tenant.stripe_subscription_id, {
        items: [
          {
            id: existingSeatItem.id,
            quantity: (existingSeatItem.quantity || 0) + 1,
          },
        ],
        proration_behavior: "create_prorations",
      });

      // Update tenant extra_users
      const newExtraUsers = (tenant.extra_users || 0) + 1;
      await supabaseClient
        .from("tenants")
        .update({ extra_users: newExtraUsers })
        .eq("id", tenantId);

      logStep("Seat added via subscription update", { newExtraUsers });

      return new Response(JSON.stringify({ 
        success: true, 
        method: "subscription_update",
        extra_users: newExtraUsers 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } else {
      // Create a checkout session to add the seat as a new line item
      logStep("Creating checkout session for new seat item");

      const origin = req.headers.get("origin") || "https://lyta.app";
      
      const session = await stripe.checkout.sessions.create({
        customer: tenant.stripe_customer_id,
        mode: "subscription",
        line_items: [
          {
            price: LYTA_USER_PRICE_ID,
            quantity: 1,
          },
        ],
        success_url: `${origin}/crm/parametres?tab=comptes&seat_added=true`,
        cancel_url: `${origin}/crm/parametres?tab=comptes&seat_cancelled=true`,
        metadata: {
          tenant_id: tenantId,
          action: "add_user_seat",
        },
        subscription_data: {
          metadata: {
            tenant_id: tenantId,
          },
        },
      });

      logStep("Checkout session created", { sessionId: session.id, url: session.url });

      return new Response(JSON.stringify({ 
        success: true, 
        method: "checkout",
        url: session.url 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
