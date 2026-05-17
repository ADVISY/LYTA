/**
 * apply-monthly-overage
 * =====================
 * King-only ou cron : pour chaque tenant avec auto_overage_enabled, prend
 * les tenant_overage_events status='pending' du mois passé et crée des
 * invoice items Stripe → la prochaine facture mensuelle inclut auto le
 * dépassement.
 *
 * Body : { period?: { year, month } } (par défaut = mois écoulé)
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAuth, AuthError } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logger.ts";
import { auditLog } from "../_shared/audit-log.ts";

const log = createLogger("apply-monthly-overage");

const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const stripe = new Stripe(STRIPE_KEY, { apiVersion: "2024-09-30.acacia" });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const RESOURCE_LABELS: Record<string, string> = {
  ai_docs: "Scans Smartflow",
  sms: "SMS campagnes",
  email: "Emails marketing",
};

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
    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id);
    const isKing = (roles || []).some((r: any) => r.role === "king");
    if (!isKing) throw new AuthError("Forbidden — king required", 403);

    const body = (await req.json().catch(() => ({}))) as { period?: { year: number; month: number } };

    // Période = mois écoulé par défaut (si on est en juin, on facture mai)
    const now = new Date();
    let year: number, month: number;
    if (body.period) {
      year = body.period.year;
      month = body.period.month;
    } else {
      year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      month = now.getMonth() === 0 ? 12 : now.getMonth();
    }

    // Agrège les overage events par (tenant, resource_type)
    const { data: events, error: evErr } = await supabase
      .from("tenant_overage_events")
      .select("id, tenant_id, resource_type, units, unit_price_chf_cents, status")
      .eq("period_year", year)
      .eq("period_month", month)
      .eq("status", "pending");
    if (evErr) throw evErr;

    if (!events || events.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: "Aucun overage à facturer", year, month, invoiced: 0 }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Group by (tenant, resource_type)
    type Agg = { tenant_id: string; resource_type: string; total_units: number; unit_price_chf_cents: number; event_ids: number[] };
    const aggMap = new Map<string, Agg>();
    for (const e of events) {
      const key = `${e.tenant_id}|${e.resource_type}`;
      const cur = aggMap.get(key);
      if (cur) {
        cur.total_units += e.units;
        cur.event_ids.push(e.id);
      } else {
        aggMap.set(key, {
          tenant_id: e.tenant_id,
          resource_type: e.resource_type,
          total_units: e.units,
          unit_price_chf_cents: e.unit_price_chf_cents,
          event_ids: [e.id],
        });
      }
    }

    // Pour chaque tenant, créer les invoice items Stripe
    const results: any[] = [];
    for (const agg of aggMap.values()) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("id, name, stripe_customer_id, auto_overage_enabled")
        .eq("id", agg.tenant_id)
        .maybeSingle();

      if (!tenant?.stripe_customer_id) {
        results.push({ tenant_id: agg.tenant_id, status: "skipped", reason: "no stripe_customer_id" });
        continue;
      }
      if (!tenant.auto_overage_enabled) {
        results.push({ tenant_id: agg.tenant_id, status: "skipped", reason: "auto_overage disabled" });
        continue;
      }

      const totalCents = agg.total_units * agg.unit_price_chf_cents;
      if (totalCents <= 0) {
        // marquer events invoiced même si 0
        await supabase.from("tenant_overage_events")
          .update({ status: "invoiced", invoiced_at: new Date().toISOString() })
          .in("id", agg.event_ids);
        results.push({ tenant_id: agg.tenant_id, status: "no_charge", reason: "0 CHF" });
        continue;
      }

      const description = `${RESOURCE_LABELS[agg.resource_type] || agg.resource_type} hors quota — ${agg.total_units} unités (${month}/${year})`;

      try {
        const item = await stripe.invoiceItems.create({
          customer: tenant.stripe_customer_id,
          amount: totalCents,
          currency: "chf",
          description,
          metadata: {
            tenant_id: tenant.id,
            resource_type: agg.resource_type,
            period_year: String(year),
            period_month: String(month),
            units: String(agg.total_units),
          },
        });

        await supabase.from("tenant_overage_events")
          .update({
            status: "invoiced",
            invoiced_at: new Date().toISOString(),
            stripe_invoice_item_id: item.id,
          })
          .in("id", agg.event_ids);

        await auditLog({
          actionType: "tenant.overage_invoiced",
          actorUserId: user.id,
          actorRole: "king",
          actorEmail: user.email,
          targetType: "tenant",
          targetId: tenant.id,
          targetLabel: tenant.name,
          metadata: {
            resource_type: agg.resource_type,
            period_year: year, period_month: month,
            units: agg.total_units,
            amount_chf: totalCents / 100,
            stripe_invoice_item_id: item.id,
          },
        });

        results.push({
          tenant_id: agg.tenant_id, tenant_name: tenant.name,
          status: "invoiced", resource_type: agg.resource_type,
          units: agg.total_units, amount_chf: totalCents / 100,
          stripe_invoice_item_id: item.id,
        });
      } catch (e) {
        log.error("Stripe invoiceItems.create failed", { err: (e as any)?.message, tenant_id: agg.tenant_id });
        results.push({ tenant_id: agg.tenant_id, status: "error", reason: (e as any)?.message });
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      year, month,
      total_events: events.length,
      invoiced: results.filter(r => r.status === "invoiced").length,
      skipped: results.filter(r => r.status === "skipped" || r.status === "no_charge").length,
      errors: results.filter(r => r.status === "error").length,
      results,
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
