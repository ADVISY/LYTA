/**
 * send-renewal-reminders
 * ======================
 * Cron quotidien. Pour chaque tenant avec enable_renewal_reminder=true,
 * envoie un email branded aux clients dont une police arrive à échéance
 * dans `renewal_reminder_days_before` jours.
 *
 * Filtre : clients status='actif' uniquement, police status='active'.
 * Idempotence : policies.last_renewal_email_sent_at (skip si déjà envoyé pour
 * cette échéance).
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("send-renewal-reminders");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function buildRenewalHtml(args: {
  firstName: string;
  companyName: string;
  productLabel: string;
  endDate: string;
  daysBefore: number;
  branding: any;
  tenantName: string;
}): { subject: string; html: string } {
  const displayName = args.branding?.display_name || args.branding?.email_sender_name || args.tenantName;
  const primaryColor = args.branding?.primary_color || "#1800AD";
  const logoUrl = args.branding?.logo_url || "";
  const phone = args.branding?.company_phone || "";
  const emailContact = args.branding?.company_email || "";
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${escapeHtml(displayName)}" style="height:48px;max-width:160px;object-fit:contain" />`
    : `<div style="font-size:28px;font-weight:700;color:${primaryColor}">${escapeHtml(displayName)}</div>`;

  const subject = `📋 Votre contrat ${escapeHtml(args.companyName)} arrive à échéance le ${args.endDate}`;
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f5f6fa;font-family:-apple-system,sans-serif">
  <div style="max-width:560px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.06)">
    <div style="background:linear-gradient(135deg,${primaryColor} 0%,#7C3AED 100%);padding:32px;text-align:center">
      <div style="margin-bottom:16px">${logoHtml}</div>
      <h1 style="color:white;margin:0;font-size:22px;font-weight:700">Renouvellement à prévoir</h1>
    </div>
    <div style="padding:32px">
      <p style="font-size:16px;color:#1a1a2e;margin:0 0 16px">Bonjour ${escapeHtml(args.firstName)},</p>
      <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 16px">
        Votre contrat <strong>${escapeHtml(args.productLabel)}</strong> chez <strong>${escapeHtml(args.companyName)}</strong> arrive à échéance dans <strong>${args.daysBefore} jours</strong> (${args.endDate}).
      </p>
      <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 24px">
        C'est l'occasion de vérifier que votre couverture est toujours adaptée à votre situation, et éventuellement de comparer le marché pour optimiser votre prime.
      </p>
      ${phone || emailContact ? `
      <div style="background:#f0f4ff;border-left:4px solid ${primaryColor};padding:16px 20px;margin:24px 0;border-radius:0 8px 8px 0">
        <p style="margin:0;font-size:14px;color:#444"><strong>Contactez-nous</strong></p>
        ${phone ? `<p style="margin:8px 0 0;font-size:14px;color:#444">📞 ${escapeHtml(phone)}</p>` : ""}
        ${emailContact ? `<p style="margin:4px 0 0;font-size:14px;color:#444">✉️ <a href="mailto:${escapeHtml(emailContact)}" style="color:${primaryColor};text-decoration:none">${escapeHtml(emailContact)}</a></p>` : ""}
      </div>
      ` : ""}
      <p style="color:#444;font-size:15px;line-height:1.6;margin:0">À votre disposition,<br><strong>L'équipe ${escapeHtml(displayName)}</strong></p>
    </div>
  </div>
  </body></html>`;
  return { subject, html };
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const bearerToken = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (bearerToken !== SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized (service_role required)" }), {
      status: 403, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY non configurée" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const body = (await req.json().catch(() => ({}))) as { dry_run?: boolean; target_tenant_id?: string };
  const dryRun = !!body.dry_run;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Tenants activés
  let q = supabase.from("tenant_email_automation")
    .select("tenant_id, renewal_reminder_days_before")
    .eq("enable_renewal_reminder", true);
  if (body.target_tenant_id) q = q.eq("tenant_id", body.target_tenant_id);
  const { data: settings } = await q;
  if (!settings || settings.length === 0) {
    return new Response(JSON.stringify({ ok: true, message: "Aucun tenant avec renewal_reminder activé", sent: 0 }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const tenantIds = settings.map((s: any) => s.tenant_id);
  const daysByTenant: Record<string, number> = {};
  settings.forEach((s: any) => { daysByTenant[s.tenant_id] = s.renewal_reminder_days_before || 30; });

  const { data: tenantsData } = await supabase
    .from("tenants")
    .select(`id, name, slug, tenant_branding (display_name, logo_url, primary_color, email_sender_name, company_phone, company_email)`)
    .in("id", tenantIds);
  const tenantsById = new Map<string, any>();
  (tenantsData || []).forEach((t: any) => tenantsById.set(t.id, t));

  let totalSent = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  const events: any[] = [];

  for (const tenantId of tenantIds) {
    const tenant = tenantsById.get(tenantId);
    if (!tenant) continue;
    const branding = Array.isArray(tenant.tenant_branding) ? tenant.tenant_branding[0] : tenant.tenant_branding;
    const N = daysByTenant[tenantId];

    // target end_date = today + N
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + N);
    const targetDateStr = targetDate.toISOString().slice(0, 10);

    // Policies arrivant à échéance ce jour-là
    const { data: policies, error: pErr } = await supabase
      .from("policies")
      .select(`id, company_name, product_type, end_date, last_renewal_email_sent_at, clients:client_id (id, first_name, last_name, email, status)`)
      .eq("tenant_id", tenantId)
      .eq("end_date", targetDateStr)
      .eq("status", "active");
    if (pErr) {
      log.warn("policies fetch failed", { tenantId, err: pErr.message });
      totalErrors += 1;
      continue;
    }

    log.info(`Tenant ${tenant.name} : ${policies?.length || 0} polices à renouveler le ${targetDateStr}`);

    for (const p of (policies || []) as any[]) {
      const client = Array.isArray(p.clients) ? p.clients[0] : p.clients;
      if (!client) continue;
      if (client.status !== "actif") { totalSkipped += 1; continue; }
      if (!client.email) { totalSkipped += 1; continue; }

      // Idempotence : skip si déjà envoyé dans les 60 jours pour cette police
      if (p.last_renewal_email_sent_at) {
        const lastSent = new Date(p.last_renewal_email_sent_at);
        const daysSince = (Date.now() - lastSent.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < 60) { totalSkipped += 1; continue; }
      }

      const firstName = (client.first_name || "client").trim();
      const productLabel = p.product_type || "votre contrat";
      const endDateFr = new Date(p.end_date).toLocaleDateString("fr-CH");
      const { subject, html } = buildRenewalHtml({
        firstName, companyName: p.company_name || "votre assureur", productLabel,
        endDate: endDateFr, daysBefore: N, branding, tenantName: tenant.name,
      });

      if (dryRun) {
        events.push({ tenant_id: tenantId, policy_id: p.id, email: client.email, status: "dry_run" });
        continue;
      }

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: `${branding?.email_sender_name || tenant.name} <support@lyta.ch>`,
            to: [client.email], subject, html,
          }),
        });
        if (!res.ok) {
          totalErrors += 1;
          events.push({ tenant_id: tenantId, policy_id: p.id, email: client.email, status: "error", error: `Resend ${res.status}` });
          continue;
        }
        totalSent += 1;
        events.push({ tenant_id: tenantId, policy_id: p.id, email: client.email, status: "sent" });
        await supabase.from("policies").update({ last_renewal_email_sent_at: new Date().toISOString() }).eq("id", p.id);
      } catch (e) {
        totalErrors += 1;
        events.push({ tenant_id: tenantId, policy_id: p.id, email: client.email, status: "error", error: (e as any)?.message });
      }
    }
  }

  if (totalSent > 0 || totalErrors > 0) {
    await supabase.from("king_notifications").insert({
      title: `📋 Renouvellements : ${totalSent} envoyés`,
      message: `${totalSent} email(s) renouvellement envoyé(s). ${totalErrors} échec(s). ${totalSkipped} skip.`,
      kind: "renewal_reminders_sent",
      priority: totalErrors > 0 ? "normal" : "low",
      metadata: { sent: totalSent, errors: totalErrors, skipped: totalSkipped, dry_run: dryRun },
    }).catch(() => null);
  }

  return new Response(JSON.stringify({
    ok: true, sent: totalSent, skipped: totalSkipped, errors: totalErrors, dry_run: dryRun, events,
  }), { headers: { ...cors, "Content-Type": "application/json" } });
});
