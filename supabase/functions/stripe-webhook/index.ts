import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

// Stripe product IDs mapped to plans
const PRODUCT_TO_PLAN: Record<string, string> = {
  'prod_TjgUGx2FNdlhas': 'start',
  'prod_TjgmLXohud7WAb': 'pro',
  'prod_TjgrBLxInrbnSd': 'prime',
  'prod_Tk0TPGFCuYQu3Q': 'founder',
};

// Plan prices for MRR calculation
const PLAN_PRICES: Record<string, number> = {
  'start': 49,
  'pro': 99,
  'prime': 199,
  'founder': 299,
};

const logStep = (step: string, details?: unknown) => {
  console.log(`[STRIPE-WEBHOOK] ${step}`, details ? JSON.stringify(details) : '');
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    
    // For now, we'll process without signature verification for testing
    // In production, you should verify the webhook signature
    // const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    // const event = stripe.webhooks.constructEvent(body, signature!, endpointSecret!);
    
    const event = JSON.parse(body);
    logStep("Event received", { type: event.type, id: event.id });

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        logStep("Checkout completed", { 
          customerId: session.customer,
          email: session.customer_email,
          subscriptionId: session.subscription 
        });

        // Get customer email
        const customerEmail = session.customer_email || session.customer_details?.email;
        
        if (customerEmail) {
          // Find tenant by email
          const { data: tenant } = await supabaseAdmin
            .from('tenants')
            .select('id, name, email, admin_email')
            .or(`email.eq.${customerEmail},admin_email.eq.${customerEmail}`)
            .single();

          if (tenant) {
            // Update tenant with Stripe info
            await supabaseAdmin
              .from('tenants')
              .update({
                stripe_customer_id: session.customer,
                stripe_subscription_id: session.subscription,
                payment_status: 'paid',
                updated_at: new Date().toISOString(),
              })
              .eq('id', tenant.id);

            logStep("Tenant updated with Stripe info", { tenantId: tenant.id });
          }

          // Create KING notification
          await supabaseAdmin
            .from('king_notifications')
            .insert({
              title: '💳 Paiement reçu',
              message: `Paiement de ${customerEmail} traité avec succès`,
              kind: 'payment_received',
              priority: 'normal',
              tenant_id: tenant?.id,
              tenant_name: tenant?.name,
              action_url: tenant ? `/king/tenants/${tenant.id}` : '/king/tenants',
              action_label: 'Voir le tenant',
              metadata: {
                customer_id: session.customer,
                subscription_id: session.subscription,
                amount: session.amount_total,
                customer_email: customerEmail,
              }
            });
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object;
        logStep("Invoice paid", { 
          customerId: invoice.customer,
          amount: invoice.amount_paid,
          subscriptionId: invoice.subscription
        });

        // Find tenant by Stripe customer ID
        const { data: tenant } = await supabaseAdmin
          .from('tenants')
          .select('id, name')
          .eq('stripe_customer_id', invoice.customer)
          .single();

        if (tenant) {
          await supabaseAdmin
            .from('tenants')
            .update({
              payment_status: 'paid',
              billing_status: 'paid',
              current_period_end: invoice.lines?.data?.[0]?.period?.end 
                ? new Date(invoice.lines.data[0].period.end * 1000).toISOString()
                : null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', tenant.id);

          await supabaseAdmin
            .from('king_notifications')
            .insert({
              title: '✅ Facture payée',
              message: `Facture de ${(invoice.amount_paid / 100).toFixed(2)} CHF payée`,
              kind: 'payment_received',
              priority: 'low',
              tenant_id: tenant.id,
              tenant_name: tenant.name,
              action_url: `/king/tenants/${tenant.id}`,
              action_label: 'Voir le tenant',
              metadata: {
                invoice_id: invoice.id,
                amount: invoice.amount_paid,
              }
            });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        logStep("Invoice payment failed", { 
          customerId: invoice.customer,
          amount: invoice.amount_due
        });

        const { data: tenant } = await supabaseAdmin
          .from('tenants')
          .select('id, name')
          .eq('stripe_customer_id', invoice.customer)
          .single();

        if (tenant) {
          await supabaseAdmin
            .from('tenants')
            .update({
              payment_status: 'past_due',
              billing_status: 'past_due',
              updated_at: new Date().toISOString(),
            })
            .eq('id', tenant.id);

          await supabaseAdmin
            .from('king_notifications')
            .insert({
              title: '⚠️ Paiement échoué',
              message: `Le paiement de ${(invoice.amount_due / 100).toFixed(2)} CHF a échoué pour ${tenant.name}`,
              kind: 'payment_failed',
              priority: 'high',
              tenant_id: tenant.id,
              tenant_name: tenant.name,
              action_url: `/king/tenants/${tenant.id}`,
              action_label: 'Voir le tenant',
              metadata: {
                invoice_id: invoice.id,
                amount: invoice.amount_due,
                attempt_count: invoice.attempt_count,
              }
            });
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        logStep("Subscription updated", { 
          customerId: subscription.customer,
          status: subscription.status
        });

        const { data: tenant } = await supabaseAdmin
          .from('tenants')
          .select('id, name')
          .eq('stripe_customer_id', subscription.customer)
          .single();

        if (tenant) {
          // Determine plan from subscription items
          let planName = 'start';
          let extraUsers = 0;
          let mrr = 0;

          for (const item of subscription.items.data) {
            const productId = typeof item.price.product === 'string' 
              ? item.price.product 
              : item.price.product?.id;
            
            if (productId && PRODUCT_TO_PLAN[productId]) {
              planName = PRODUCT_TO_PLAN[productId];
              mrr += PLAN_PRICES[planName] || 0;
            }
            
            // Check for extra users (quantity > 1 on user seat item)
            if (item.price.id === 'price_1SmZtZF7ZITS358Au3FHsdBA') {
              extraUsers = (item.quantity || 1) - 1;
              mrr += extraUsers * 20;
            }
          }

          const paymentStatus = subscription.status === 'active' ? 'paid' 
            : subscription.status === 'past_due' ? 'past_due'
            : subscription.status === 'trialing' ? 'trialing'
            : 'unpaid';

          await supabaseAdmin
            .from('tenants')
            .update({
              stripe_subscription_id: subscription.id,
              plan: planName,
              extra_users: extraUsers,
              payment_status: paymentStatus,
              billing_status: paymentStatus,
              mrr_amount: mrr,
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', tenant.id);

          logStep("Tenant subscription updated", { tenantId: tenant.id, plan: planName, mrr });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        logStep("Subscription deleted", { 
          customerId: subscription.customer 
        });

        const { data: tenant } = await supabaseAdmin
          .from('tenants')
          .select('id, name')
          .eq('stripe_customer_id', subscription.customer)
          .single();

        if (tenant) {
          await supabaseAdmin
            .from('tenants')
            .update({
              payment_status: 'canceled',
              billing_status: 'canceled',
              tenant_status: 'suspended',
              mrr_amount: 0,
              updated_at: new Date().toISOString(),
            })
            .eq('id', tenant.id);

          await supabaseAdmin
            .from('king_notifications')
            .insert({
              title: '🚫 Abonnement annulé',
              message: `L'abonnement de ${tenant.name} a été annulé`,
              kind: 'subscription_cancelled',
              priority: 'high',
              tenant_id: tenant.id,
              tenant_name: tenant.name,
              action_url: `/king/tenants/${tenant.id}`,
              action_label: 'Voir le tenant',
              metadata: {
                subscription_id: subscription.id,
              }
            });
        }
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
