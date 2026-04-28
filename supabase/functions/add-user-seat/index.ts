import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAuth, AuthError } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logger.ts";

const FALLBACK_USER_PRICE_ID = "price_1SmZtZF7ZITS358Au3FHsdBA";

const log = createLogger("add-user-seat");

async function syncTenantUserLimit(
  supabaseClient: ReturnType<typeof createClient>,
  tenantId: string,
  totalSeats: number,
) {
  const { error } = await supabaseClient
    .from("tenant_limits")
    .upsert(
      {
        tenant_id: tenantId,
        users_limit: totalSeats,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id" },
    );

  if (error) {
    log.warn("Failed to sync tenant user limit", { tenantId, totalSeats, error: error.message });
  }
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    log.info("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    // Verify caller identity via shared auth
    const { user } = await requireAuth(req);
    log.info("User authenticated", { userId: user.id });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { data: priceIdSetting } = await supabaseClient
      .from('platform_settings' as any)
      .select('value')
      .eq('key', 'extra_user_price_id')
      .single();
    const LYTA_USER_PRICE_ID = (priceIdSetting?.value as string) || FALLBACK_USER_PRICE_ID;

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
    log.info("Found tenant", { tenantId });

    // Get tenant data
    const { data: tenant, error: fetchError } = await supabaseClient
      .from("tenants")
      .select("id, name, stripe_customer_id, stripe_subscription_id, seats_included, extra_users")
      .eq("id", tenantId)
      .single();

    if (fetchError || !tenant) {
      throw new Error("Tenant not found");
    }
    log.info("Tenant data", {
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
    log.info("Subscription retrieved", { subscriptionId: subscription.id, status: subscription.status });

    const nextExtraUsers = (tenant.extra_users || 0) + 1;
    const idempotencyKey = `tenant:${tenantId}:extra-users:${tenant.extra_users || 0}:subscription:${tenant.stripe_subscription_id}`;

    // Check if user seat price already exists in subscription
    const existingSeatItem = subscription.items.data.find(
      (item: { price: { id: string }; quantity?: number; id: string }) => item.price.id === LYTA_USER_PRICE_ID
    );

    if (existingSeatItem) {
      // Increment quantity on existing item
      log.info("Incrementing existing seat item", {
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
      }, {
        idempotencyKey,
      });

      await supabaseClient
        .from("tenants")
        .update({ extra_users: nextExtraUsers })
        .eq("id", tenantId);

      await syncTenantUserLimit(supabaseClient, tenantId, (tenant.seats_included || 1) + nextExtraUsers);

      log.info("Seat added via subscription update", { newExtraUsers: nextExtraUsers });

      return new Response(JSON.stringify({ 
        success: true, 
        method: "subscription_update",
        extra_users: nextExtraUsers 
      }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        status: 200,
      });
    } else {
      log.info("Creating new seat item on existing subscription", {
        subscriptionId: tenant.stripe_subscription_id,
        priceId: LYTA_USER_PRICE_ID,
      });

      await stripe.subscriptionItems.create({
        subscription: tenant.stripe_subscription_id,
        price: LYTA_USER_PRICE_ID,
        quantity: 1,
        proration_behavior: "create_prorations",
        metadata: {
          tenant_id: tenantId,
          action: "add_user_seat",
        },
      }, {
        idempotencyKey,
      });

      await supabaseClient
        .from("tenants")
        .update({ extra_users: nextExtraUsers })
        .eq("id", tenantId);

      await syncTenantUserLimit(supabaseClient, tenantId, (tenant.seats_included || 1) + nextExtraUsers);

      log.info("Seat added via subscription item creation", { newExtraUsers: nextExtraUsers });

      return new Response(JSON.stringify({ 
        success: true, 
        method: "subscription_update",
        extra_users: nextExtraUsers 
      }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        status: 200,
      });
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        status: error.status,
      });
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      status: 500,
    });
  }
});
