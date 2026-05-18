import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("stripe-webhook");

// Stripe product IDs mapped to plans (fallback if DB unavailable)
const FALLBACK_PRODUCT_TO_PLAN: Record<string, string> = {
  'prod_TjgUGx2FNdlhas': 'start',
  'prod_TjgmLXohud7WAb': 'pro',
  'prod_TjgrBLxInrbnSd': 'prime',
  'prod_Tk0TPGFCuYQu3Q': 'founder',
};

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

// --- Plan pricing from DB (with hardcoded fallback) ---

interface PlanPricing {
  monthlyPrices: Record<string, number>;
  extraSeatPrices: Record<string, number>;
}

const FALLBACK_PRICING: PlanPricing = {
  monthlyPrices: { start: 69, pro: 150, prime: 250, founder: 150 },
  extraSeatPrices: { start: 20, pro: 20, prime: 20, founder: 20 },
};

// URL de base de l'app (app.lyta.ch). Override via PUBLIC_APP_URL si besoin.
const APP_BASE_URL = Deno.env.get("PUBLIC_APP_URL") || "https://app.lyta.ch";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

/**
 * Envoie un email post-paiement avec le lien /finalize. Filet de secours :
 * même si Stripe ne redirige pas correctement (ou si l'utilisateur ferme
 * l'onglet), il a un email actionnable dans sa boîte.
 *
 * Fire-and-forget : on log les erreurs mais on ne fait pas crasher le webhook.
 */
async function sendFinalizeEmail(args: {
  email: string;
  sessionId: string;
  planLabel?: string | null;
}): Promise<void> {
  if (!RESEND_API_KEY) {
    log.warn("RESEND_API_KEY not configured — skipping finalize email");
    return;
  }
  const finalizeUrl = `${APP_BASE_URL}/finalize?session_id=${encodeURIComponent(args.sessionId)}`;
  const planLine = args.planLabel
    ? `<p style="margin:0 0 16px;color:#444">Plan choisi : <strong>${args.planLabel}</strong></p>`
    : "";
  const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f6fa;padding:24px;margin:0">
    <div style="max-width:560px;margin:auto;background:white;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.06)">
      <h2 style="margin:0 0 8px;color:#1800AD">Paiement reçu ✅</h2>
      <p style="margin:0 0 16px;color:#444">Merci pour ton inscription à LYTA. Il reste une dernière étape : nous donner le nom de ton cabinet pour activer ton espace.</p>
      ${planLine}
      <p style="margin:24px 0">
        <a href="${finalizeUrl}" style="display:inline-block;background:#1800AD;color:white;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Finaliser mon inscription</a>
      </p>
      <p style="margin:16px 0 0;font-size:12px;color:#888">Le lien expire avec ta session Stripe (24h). Si tu rencontres un souci, écris-nous à <a href="mailto:support@lyta.ch">support@lyta.ch</a>.</p>
    </div></body></html>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "LYTA <support@lyta.ch>",
        to: [args.email],
        subject: "Active ton cabinet LYTA — dernière étape (2 min)",
        html,
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      log.warn("Resend finalize email non-OK", { status: res.status, body: txt.slice(0, 200) });
    } else {
      log.info("Finalize email sent", { email: args.email, sessionId: args.sessionId });
    }
  } catch (e) {
    log.warn("Resend finalize email failed", { err: (e as any)?.message });
  }
}

async function getPlanPricing(supabaseAdmin: ReturnType<typeof createClient>): Promise<PlanPricing> {
  const { data, error } = await supabaseAdmin
    .from('platform_plans')
    .select('id, monthly_price, extra_seat_price')
    .eq('is_active', true);

  if (error || !data || data.length === 0) {
    log.warn("Failed to fetch plan pricing from DB, using fallback", { error: error?.message });
    return FALLBACK_PRICING;
  }

  return {
    monthlyPrices: Object.fromEntries(data.map((p: { id: string; monthly_price: number }) => [p.id, Number(p.monthly_price)])),
    extraSeatPrices: Object.fromEntries(data.map((p: { id: string; extra_seat_price: number }) => [p.id, Number(p.extra_seat_price)])),
  };
}


serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    log.error("STRIPE_SECRET_KEY not configured");
    return new Response(
      JSON.stringify({ error: "Stripe not configured" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
  const stripe = new Stripe(stripeKey, {
    apiVersion: "2025-08-27.basil",
  });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  const PRODUCT_TO_PLAN = await getProductToPlanMap(supabaseAdmin);

  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!endpointSecret) {
      log.error("STRIPE_WEBHOOK_SECRET not configured");
      return new Response(
        JSON.stringify({ error: "Webhook not configured" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    if (!signature) {
      return new Response(
        JSON.stringify({ error: "Missing stripe-signature header" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    let event;
    try {
      // IMPORTANT : utiliser constructEventAsync (et non constructEvent
      // synchrone) car l'Edge Runtime Deno n'a pas le crypto Node — seule
      // la version async passe par WebCrypto et fonctionne correctement.
      event = await stripe.webhooks.constructEventAsync(body, signature, endpointSecret);
    } catch (err) {
      log.error("Signature verification failed", { error: err.message });
      return new Response(
        JSON.stringify({ error: "Invalid signature", details: err.message }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }
    log.info("Event received", { type: event.type, id: event.id });

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const customerEmail = session.customer_email || session.customer_details?.email;
        log.info("Checkout completed", {
          customerId: session.customer,
          email: customerEmail,
          subscriptionId: session.subscription,
          signupFlow: session.metadata?.signup_flow === 'true',
          hasMetadata: !!session.metadata?.signup_flow,
        });

        if (!customerEmail) {
          log.warn("checkout.session.completed sans customer_email — skip", { sessionId: session.id });
          break;
        }

        // Existing tenant ? (paiement renouvellement ou changement de plan)
        const { data: tenant } = await supabaseAdmin
          .from('tenants')
          .select('id, name, email, admin_email')
          .or(`email.eq.${customerEmail},admin_email.eq.${customerEmail}`)
          .maybeSingle();

        // Pas de tenant → c'est un self-signup (paiement initial), peu importe
        // que les metadata signup_flow soient présentes (Stripe Payment Link
        // sur lyta.ch n'a pas forcément les metadata car il ne passe pas par
        // notre fonction create-checkout-session).
        const isSelfSignup = !tenant;

        if (isSelfSignup) {
          // Dérive plan_id : d'abord depuis metadata, sinon depuis line items
          // (cas Payment Link Lovable → on retrouve le plan via product_id)
          let planId: string | null = session.metadata?.plan_id || null;
          if (!planId) {
            try {
              const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
              const productId = lineItems.data[0]?.price?.product;
              if (typeof productId === 'string' && PRODUCT_TO_PLAN[productId]) {
                planId = PRODUCT_TO_PLAN[productId];
                log.info("plan_id derived from product_id", { productId, planId });
              }
            } catch (e) {
              log.warn("Failed to derive plan_id from line items", { err: (e as any)?.message });
            }
          }

          await supabaseAdmin
            .from('pending_signups')
            .upsert({
              stripe_session_id: session.id,
              stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id,
              stripe_subscription_id: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
              customer_email: customerEmail,
              plan_id: planId,
              amount_chf: (session.amount_total ?? 0) / 100,
              status: 'pending',
            }, { onConflict: 'stripe_session_id' });
          log.info('pending_signups upserted (self-signup)', { sessionId: session.id, planId });

          // Email finalize (fire-and-forget)
          let planLabel: string | null = null;
          if (planId) {
            const { data: plan } = await supabaseAdmin
              .from('platform_plans').select('display_name').eq('id', planId).maybeSingle();
            planLabel = (plan as any)?.display_name || planId;
          }
          sendFinalizeEmail({ email: customerEmail, sessionId: session.id, planLabel });
        } else {
          // Existing tenant — update Stripe info
          await supabaseAdmin
            .from('tenants')
            .update({
              stripe_customer_id: session.customer,
              stripe_subscription_id: session.subscription,
              payment_status: 'paid',
              updated_at: new Date().toISOString(),
            })
            .eq('id', tenant.id);
          log.info("Existing tenant updated with Stripe info", { tenantId: tenant.id });
        }

        // KING notification (toujours)
        await supabaseAdmin
          .from('king_notifications')
          .insert({
            title: isSelfSignup ? '🆕 Nouveau paiement self-signup' : '💳 Paiement reçu',
            message: `${customerEmail} — ${(session.amount_total ?? 0) / 100} CHF ${isSelfSignup ? '(en attente de finalisation)' : ''}`,
            kind: isSelfSignup ? 'self_signup_paid' : 'payment_received',
            priority: 'normal',
            tenant_id: tenant?.id,
            tenant_name: tenant?.name,
            action_url: isSelfSignup ? '/king/tenants' : `/king/tenants/${tenant?.id}`,
            action_label: isSelfSignup ? 'Voir inscriptions en attente' : 'Voir le tenant',
            metadata: {
              customer_id: session.customer,
              subscription_id: session.subscription,
              amount: session.amount_total,
              customer_email: customerEmail,
              stripe_session_id: session.id,
              is_self_signup: isSelfSignup,
            }
          });
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object;
        log.info("Invoice paid", {
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

          // Affiliate : calcule auto la commission si tenant lié + éligible
          try {
            const { data: commissionId } = await supabaseAdmin.rpc('generate_affiliate_commission', {
              p_tenant_id: tenant.id,
              p_payment_id: invoice.id,
              p_payment_amount: (invoice.amount_paid ?? 0) / 100,
              p_payment_date: new Date(((invoice.status_transitions?.paid_at || invoice.created) ?? Date.now() / 1000) * 1000).toISOString(),
            });
            if (commissionId) {
              log.info('Affiliate commission generated', { commissionId, tenantId: tenant.id });
            }
          } catch (e) {
            log.warn('generate_affiliate_commission failed', { err: (e as any)?.message });
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        log.warn("Invoice payment failed", {
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
        log.info("Subscription updated", {
          customerId: subscription.customer,
          status: subscription.status
        });

        const { data: tenant } = await supabaseAdmin
          .from('tenants')
          .select('id, name')
          .eq('stripe_customer_id', subscription.customer)
          .single();

        if (tenant) {
          // Fetch plan pricing from DB (with hardcoded fallback)
          const pricing = await getPlanPricing(supabaseAdmin);

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
              mrr += pricing.monthlyPrices[planName] || 0;
            }

            // Check for extra users (quantity > 1 on user seat item)
            if (item.price.id === 'price_1SmZtZF7ZITS358Au3FHsdBA') {
              extraUsers = (item.quantity || 1) - 1;
              mrr += extraUsers * (pricing.extraSeatPrices[planName] || 20);
            }
          }

          const paymentStatus = subscription.status === 'active' ? 'paid'
            : subscription.status === 'past_due' ? 'past_due'
            : subscription.status === 'trialing' ? 'trialing'
            : 'unpaid';

          // Auto-transition status visuel : trial → actif quand Stripe confirme
          // le premier paiement réussi (subscription.status passe de 'trialing'
          // à 'active'). Le tenant passe automatiquement de 'test'/'pending_setup'
          // à 'active' → visible en vert dans le dashboard King.
          const updates: Record<string, any> = {
            stripe_subscription_id: subscription.id,
            plan: planName,
            extra_users: extraUsers,
            payment_status: paymentStatus,
            billing_status: paymentStatus,
            mrr_amount: mrr,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          };

          // Récupère le status actuel pour décider de la transition
          const { data: currentTenant } = await supabaseAdmin
            .from('tenants')
            .select('status, tenant_status')
            .eq('id', tenant.id)
            .single();

          let activated = false;
          if (subscription.status === 'active') {
            // Trial terminé + paiement OK → on bascule actif (si pas déjà)
            if (currentTenant?.status !== 'active') {
              updates.status = 'active';
              activated = true;
            }
            if (currentTenant?.tenant_status !== 'active') {
              updates.tenant_status = 'active';
              activated = true;
            }
          } else if (['unpaid', 'canceled', 'incomplete_expired'].includes(subscription.status)) {
            // Échec paiement après trial → suspendre
            if (currentTenant?.status !== 'suspended') {
              updates.status = 'suspended';
              updates.suspended_at = new Date().toISOString();
              updates.suspension_reason = `Stripe subscription status: ${subscription.status}`;
            }
          }

          await supabaseAdmin
            .from('tenants')
            .update(updates)
            .eq('id', tenant.id);

          log.info("Tenant subscription updated", { tenantId: tenant.id, plan: planName, mrr, activated });

          // Notification king sur la transition active
          if (activated) {
            await supabaseAdmin.from('king_notifications').insert({
              title: '🎉 Cabinet actif (fin trial)',
              message: `${tenant.name} a complété son trial et est passé en payant — MRR +${mrr} CHF`,
              kind: 'tenant_activated',
              priority: 'normal',
              tenant_id: tenant.id,
              tenant_name: tenant.name,
              action_url: `/king/tenants/${tenant.id}`,
              action_label: 'Voir le tenant',
              metadata: { plan: planName, mrr, subscription_id: subscription.id },
            });
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        log.warn("Subscription deleted", {
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

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        log.info("Payment intent succeeded", {
          customerId: paymentIntent.customer,
          amount: paymentIntent.amount
        });

        // Try to find tenant by customer ID
        if (paymentIntent.customer) {
          const { data: tenant } = await supabaseAdmin
            .from('tenants')
            .select('id, name, stripe_customer_id')
            .eq('stripe_customer_id', paymentIntent.customer)
            .single();

          if (tenant) {
            // Update payment status
            await supabaseAdmin
              .from('tenants')
              .update({
                payment_status: 'paid',
                updated_at: new Date().toISOString(),
              })
              .eq('id', tenant.id);

            log.info("Tenant payment updated via payment_intent", { tenantId: tenant.id });
          } else {
            // Customer exists but no tenant linked - try to find by receipt_email
            const receiptEmail = paymentIntent.receipt_email;
            if (receiptEmail) {
              const { data: tenantByEmail } = await supabaseAdmin
                .from('tenants')
                .select('id, name')
                .or(`email.eq.${receiptEmail},admin_email.eq.${receiptEmail}`)
                .single();

              if (tenantByEmail) {
                await supabaseAdmin
                  .from('tenants')
                  .update({
                    stripe_customer_id: paymentIntent.customer,
                    payment_status: 'paid',
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', tenantByEmail.id);

                log.info("Tenant linked and updated via email", { tenantId: tenantByEmail.id });

                await supabaseAdmin
                  .from('king_notifications')
                  .insert({
                    title: '💳 Nouveau paiement',
                    message: `Paiement de ${(paymentIntent.amount / 100).toFixed(2)} CHF reçu`,
                    kind: 'payment_received',
                    priority: 'normal',
                    tenant_id: tenantByEmail.id,
                    tenant_name: tenantByEmail.name,
                    action_url: `/king/tenants/${tenantByEmail.id}`,
                    action_label: 'Voir le tenant',
                    metadata: {
                      payment_intent_id: paymentIntent.id,
                      amount: paymentIntent.amount,
                    }
                  });
              }
            }
          }
        }
        break;
      }

      case 'subscription_schedule.canceled': {
        const schedule = event.data.object;
        log.warn("Subscription schedule canceled", {
          customerId: schedule.customer
        });

        if (schedule.customer) {
          const { data: tenant } = await supabaseAdmin
            .from('tenants')
            .select('id, name')
            .eq('stripe_customer_id', schedule.customer)
            .single();

          if (tenant) {
            await supabaseAdmin
              .from('king_notifications')
              .insert({
                title: '⚠️ Abonnement programmé annulé',
                message: `Le schedule d'abonnement de ${tenant.name} a été annulé`,
                kind: 'subscription_cancelled',
                priority: 'normal',
                tenant_id: tenant.id,
                tenant_name: tenant.name,
                action_url: `/king/tenants/${tenant.id}`,
                action_label: 'Voir le tenant',
                metadata: {
                  schedule_id: schedule.id,
                }
              });
          }
        }
        break;
      }

      default:
        log.info("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error("Webhook handler failed", { error: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      // 500 so Stripe retries on transient failures (Stripe does not retry 4xx)
      status: 500,
    });
  }
});
