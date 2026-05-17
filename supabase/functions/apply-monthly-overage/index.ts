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

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

async function notifyTenantOverage(tenant: { name: string; email?: string | null; admin_email?: string | null }, items: Array<{ resource: string; units: number; total_chf: number }>) {
  const to = tenant.email || tenant.admin_email;
  if (!to || !RESEND_API_KEY) return;
  const total = items.reduce((s, i) => s + i.total_chf, 0);
  const rows = items.map(i =>
    `<tr><td style="padding:8px;border-bottom:1px solid #eee">${RESOURCE_LABELS[i.resource]}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${i.units}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${i.total_chf.toFixed(2)} CHF</td></tr>`
  ).join("");
  const html = `<!doctype html><html><body style="font-family:-apple-system,sans-serif;padding:24px;background:#f5f5f5">
    <div style="max-width:560px;margin:auto;background:white;border-radius:12px;padding:32px">
      <h2>Récap consommation hors quota — ${tenant.name}</h2>
      <p>Voici le récap du mois écoulé. Le montant sera ajouté à ta prochaine facture mensuelle Stripe automatiquement.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0"><thead>
        <tr style="background:#f9f9f9"><th style="padding:8px;text-align:left">Ressource</th><th style="text-align:right;padding:8px">Unités</th><th style="text-align:right;padding:8px">Montant</th></tr>
      </thead><tbody>${rows}
        <tr><td style="padding:12px;font-weight:bold">Total overage</td><td></td><td style="padding:12px;text-align:right;font-weight:bold;color:#1800AD">${total.toFixed(2)} CHF</td></tr>
      </tbody></table>
      <p style="font-size:12px;color:#666">Pour éviter l'overage, upgrade ton plan dans Paramètres → Abonnement.</p>
    </div></body></html>`;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "LYTA <support@lyta.ch>", to: [to],
        subject: `Récap overage — ${total.toFixed(2)} CHF facturés ce mois`,
        html,
      }),
    });
  } catch (e) {
    console.warn("[apply-monthly-overage] email notification failed:", (e as any)?.message);
  }
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
    // Pour grouper les emails par tenant (1 seul mail récap)
    const emailItemsByTenant = new Map<string, { tenant: any; items: any[] }>();
    for (const agg of aggMap.values()) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("id, name, email, admin_email, stripe_customer_id, auto_overage_enabled")
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

        // Accumule pour l'email récap
        const bucket = emailItemsByTenant.get(agg.tenant_id) || { tenant, items: [] };
        bucket.items.push({ resource: agg.resource_type, units: agg.total_units, total_chf: totalCents / 100 });
        emailItemsByTenant.set(agg.tenant_id, bucket);
      } catch (e) {
        log.error("Stripe invoiceItems.create failed", { err: (e as any)?.message, tenant_id: agg.tenant_id });
        results.push({ tenant_id: agg.tenant_id, status: "error", reason: (e as any)?.message });
      }
    }

    // Envoie 1 email récap par tenant (fire-and-forget)
    for (const bucket of emailItemsByTenant.values()) {
      notifyTenantOverage(bucket.tenant, bucket.items);
    }

    return new Response(JSON.stringify({
      ok: true,
      year, month,
      total_events: events.length,
      invoiced: results.filter(r => r.status === "invoiced").length,
      skipped: results.filter(r => r.status === "skipped" || r.status === "no_charge").length,
      errors: results.filter(r => r.status === "error").length,
      tenants_notified: emailItemsByTenant.size,
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
