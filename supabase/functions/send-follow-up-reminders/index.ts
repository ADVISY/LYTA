/**
 * send-follow-up-reminders
 * ========================
 * Cron quotidien. Pour chaque tenant avec enable_follow_up_reminder=true,
 * envoie un email branded aux PROSPECTS (status='prospect') créés depuis
 * `follow_up_reminder_days` jours et qui n'ont pas converti.
 *
 * But : relancer doucement les leads dormants. Pas spam : 1 seul follow-up
 * par prospect (last_follow_up_email_sent_at NULL ou > 90 jours).
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("send-follow-up-reminders");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function buildFollowUpHtml(args: { firstName: string; branding: any; tenantName: string }): { subject: string; html: string } {
  const displayName = args.branding?.display_name || args.branding?.email_sender_name || args.tenantName;
  const primaryColor = args.branding?.primary_color || "#1800AD";
  const logoUrl = args.branding?.logo_url || "";
  const phone = args.branding?.company_phone || "";
  const emailContact = args.branding?.company_email || "";
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${escapeHtml(displayName)}" style="height:48px;max-width:160px;object-fit:contain" />`
    : `<div style="font-size:28px;font-weight:700;color:${primaryColor}">${escapeHtml(displayName)}</div>`;

  const subject = `Pouvons-nous vous aider ${args.firstName} ?`;
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f5f6fa;font-family:-apple-system,sans-serif">
  <div style="max-width:560px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.06)">
    <div style="background:linear-gradient(135deg,${primaryColor} 0%,#7C3AED 100%);padding:32px;text-align:center">
      <div style="margin-bottom:16px">${logoHtml}</div>
      <h1 style="color:white;margin:0;font-size:22px;font-weight:700">On reste à votre écoute</h1>
    </div>
    <div style="padding:32px">
      <p style="font-size:16px;color:#1a1a2e;margin:0 0 16px">Bonjour ${escapeHtml(args.firstName)},</p>
      <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 16px">
        Vous nous avez contactés il y a quelque temps pour échanger sur vos assurances. Nous voulions simplement nous assurer que vous avez bien reçu tout ce dont vous avez besoin.
      </p>
      <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 24px">
        Si vous avez encore des questions ou souhaitez reprendre la discussion, nous sommes là — sans pression et sans engagement.
      </p>
      ${phone || emailContact ? `
      <div style="background:#f0f4ff;border-left:4px solid ${primaryColor};padding:16px 20px;margin:24px 0;border-radius:0 8px 8px 0">
        <p style="margin:0;font-size:14px;color:#444"><strong>Pour nous joindre</strong></p>
        ${phone ? `<p style="margin:8px 0 0;font-size:14px;color:#444">📞 ${escapeHtml(phone)}</p>` : ""}
        ${emailContact ? `<p style="margin:4px 0 0;font-size:14px;color:#444">✉️ <a href="mailto:${escapeHtml(emailContact)}" style="color:${primaryColor};text-decoration:none">${escapeHtml(emailContact)}</a></p>` : ""}
      </div>
      ` : ""}
      <p style="color:#444;font-size:15px;line-height:1.6;margin:0">À très vite,<br><strong>L'équipe ${escapeHtml(displayName)}</strong></p>
      <p style="color:#888;font-size:11px;margin-top:24px;border-top:1px solid #eee;padding-top:12px">Si vous ne souhaitez plus recevoir ce type de relance, répondez simplement à ce mail.</p>
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

  let q = supabase.from("tenant_email_automation")
    .select("tenant_id, follow_up_reminder_days")
    .eq("enable_follow_up_reminder", true);
  if (body.target_tenant_id) q = q.eq("tenant_id", body.target_tenant_id);
  const { data: settings } = await q;
  if (!settings || settings.length === 0) {
    return new Response(JSON.stringify({ ok: true, message: "Aucun tenant avec follow_up activé", sent: 0 }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const tenantIds = settings.map((s: any) => s.tenant_id);
  const daysByTenant: Record<string, number> = {};
  settings.forEach((s: any) => { daysByTenant[s.tenant_id] = s.follow_up_reminder_days || 7; });

  const { data: tenantsData } = await supabase
    .from("tenants")
    .select(`id, name, slug, tenant_branding (display_name, logo_url, primary_color, email_sender_name, company_phone, company_email)`)
    .in("id", tenantIds);
  const tenantsById = new Map<string, any>();
  (tenantsData || []).forEach((t: any) => tenantsById.set(t.id, t));

  let totalSent = 0, totalSkipped = 0, totalErrors = 0;
  const events: any[] = [];
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  for (const tenantId of tenantIds) {
    const tenant = tenantsById.get(tenantId);
    if (!tenant) continue;
    const branding = Array.isArray(tenant.tenant_branding) ? tenant.tenant_branding[0] : tenant.tenant_branding;
    const N = daysByTenant[tenantId];

    const cutoff = new Date(Date.now() - N * 24 * 60 * 60 * 1000).toISOString();

    // Prospects créés il y a >= N jours, jamais relancés (ou > 90j),
    // status='prospect' toujours
    const { data: prospects, error: pErr } = await supabase
      .from("clients")
      .select("id, first_name, last_name, email, status, created_at, last_follow_up_email_sent_at")
      .eq("tenant_id", tenantId)
      .eq("status", "prospect")
      .not("email", "is", null)
      .lt("created_at", cutoff)
      .or(`last_follow_up_email_sent_at.is.null,last_follow_up_email_sent_at.lt.${ninetyDaysAgo}`)
      .limit(50);  // safety cap par tenant pour éviter d'envoyer 1000 mails d'un coup
    if (pErr) {
      log.warn("prospects fetch failed", { tenantId, err: pErr.message });
      totalErrors += 1;
      continue;
    }

    log.info(`Tenant ${tenant.name} : ${prospects?.length || 0} prospects à relancer`);

    for (const c of (prospects || []) as any[]) {
      if (!c.email) { totalSkipped += 1; continue; }
      const firstName = (c.first_name || "client").trim();
      const { subject, html } = buildFollowUpHtml({ firstName, branding, tenantName: tenant.name });

      if (dryRun) {
        events.push({ tenant_id: tenantId, client_id: c.id, email: c.email, status: "dry_run" });
        continue;
      }
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: `${branding?.email_sender_name || tenant.name} <support@lyta.ch>`,
            to: [c.email], subject, html,
          }),
        });
        if (!res.ok) {
          totalErrors += 1;
          events.push({ tenant_id: tenantId, client_id: c.id, email: c.email, status: "error", error: `Resend ${res.status}` });
          continue;
        }
        totalSent += 1;
        events.push({ tenant_id: tenantId, client_id: c.id, email: c.email, status: "sent" });
        await supabase.from("clients").update({ last_follow_up_email_sent_at: new Date().toISOString() }).eq("id", c.id);
      } catch (e) {
        totalErrors += 1;
        events.push({ tenant_id: tenantId, client_id: c.id, email: c.email, status: "error", error: (e as any)?.message });
      }
    }
  }

  if (totalSent > 0 || totalErrors > 0) {
    await supabase.from("king_notifications").insert({
      title: `🔔 Relances prospects : ${totalSent} envoyés`,
      message: `${totalSent} email(s) follow-up envoyé(s). ${totalErrors} échec(s). ${totalSkipped} skip.`,
      kind: "follow_up_reminders_sent",
      priority: totalErrors > 0 ? "normal" : "low",
      metadata: { sent: totalSent, errors: totalErrors, skipped: totalSkipped, dry_run: dryRun },
    }).catch(() => null);
  }

  return new Response(JSON.stringify({
    ok: true, sent: totalSent, skipped: totalSkipped, errors: totalErrors, dry_run: dryRun, events,
  }), { headers: { ...cors, "Content-Type": "application/json" } });
});
