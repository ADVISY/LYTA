/**
 * send-birthday-emails
 * ====================
 * Cron quotidien (09:00 Europe/Zurich). Pour chaque tenant avec
 * tenant_email_automation.enable_birthday_email=true, balaie les clients
 * dont c'est l'anniversaire aujourd'hui (mois+jour, peu importe l'année)
 * et envoie un email branded via Resend.
 *
 * Sécurité : appelable uniquement via service_role (cron pg_net OU king).
 *
 * Body : { dry_run?: boolean, target_tenant_id?: string } (optionnels, debug)
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("send-birthday-emails");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

interface TenantBranding {
  display_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  email_sender_name: string | null;
  email_footer_text: string | null;
  company_phone: string | null;
  company_email: string | null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildBirthdayHtml(args: {
  firstName: string;
  branding: TenantBranding | null;
  tenantName: string;
}): { subject: string; html: string } {
  const displayName = args.branding?.display_name || args.branding?.email_sender_name || args.tenantName;
  const primaryColor = args.branding?.primary_color || "#1800AD";
  const logoUrl = args.branding?.logo_url || "";
  const footerText = args.branding?.email_footer_text || "Votre partenaire assurance de confiance";

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${escapeHtml(displayName)}" style="height:48px;max-width:160px;object-fit:contain" />`
    : `<div style="font-size:28px;font-weight:700;color:${primaryColor}">${escapeHtml(displayName)}</div>`;

  const subject = `🎂 Joyeux anniversaire ${args.firstName} !`;
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f5f6fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:560px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.06)">
    <div style="background:linear-gradient(135deg,${primaryColor} 0%,#7C3AED 100%);padding:48px 32px;text-align:center">
      <div style="margin-bottom:16px">${logoHtml}</div>
      <div style="font-size:64px;line-height:1">🎂</div>
      <h1 style="color:white;margin:16px 0 0;font-size:28px;font-weight:700">Joyeux anniversaire !</h1>
    </div>
    <div style="padding:32px">
      <p style="font-size:18px;color:#1a1a2e;margin:0 0 16px">Cher ${escapeHtml(args.firstName)},</p>
      <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 16px">
        Toute l'équipe de <strong>${escapeHtml(displayName)}</strong> vous souhaite un très joyeux anniversaire et une excellente année à venir.
      </p>
      <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 16px">
        Merci de nous faire confiance pour vos assurances. C'est un plaisir de vous accompagner.
      </p>
      <p style="color:#444;font-size:15px;line-height:1.6;margin:0">
        Toute notre équipe vous adresse ses meilleurs vœux 🎉
      </p>
    </div>
    <div style="background:#f8fafc;padding:24px 32px;text-align:center;border-top:1px solid #e5e7eb">
      <p style="color:#6b7280;font-size:13px;margin:0 0 8px"><strong>${escapeHtml(displayName)}</strong></p>
      <p style="color:#6b7280;font-size:12px;margin:0">${escapeHtml(footerText)}</p>
      ${args.branding?.company_phone ? `<p style="color:#6b7280;font-size:12px;margin:8px 0 0">📞 ${escapeHtml(args.branding.company_phone)}</p>` : ""}
      ${args.branding?.company_email ? `<p style="color:#6b7280;font-size:12px;margin:4px 0 0">✉️ <a href="mailto:${escapeHtml(args.branding.company_email)}" style="color:${primaryColor};text-decoration:none">${escapeHtml(args.branding.company_email)}</a></p>` : ""}
    </div>
  </div>
  </body></html>`;
  return { subject, html };
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  // Auth : seul service_role peut appeler (cron OU king)
  const authHeader = req.headers.get("authorization") || "";
  const bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
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
  const targetTenantId = body.target_tenant_id?.trim() || null;

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Date d'aujourd'hui : on extrait MOIS + JOUR (peu importe l'année)
  // On utilise le fuseau Europe/Zurich pour matcher la perception locale
  const now = new Date();
  const swissNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Zurich" }));
  const todayMonth = String(swissNow.getMonth() + 1).padStart(2, "0");
  const todayDay = String(swissNow.getDate()).padStart(2, "0");
  const todayMD = `${todayMonth}-${todayDay}`;

  log.info("Running birthday emails", { todayMD, dryRun, targetTenantId });

  // 1) Tenants avec birthday email activé
  let tenantQuery = supabase
    .from("tenant_email_automation")
    .select("tenant_id")
    .eq("enable_birthday_email", true);
  if (targetTenantId) tenantQuery = tenantQuery.eq("tenant_id", targetTenantId);

  const { data: enabledTenants, error: tErr } = await tenantQuery;
  if (tErr) {
    log.error("Failed to fetch tenants", { err: tErr.message });
    return new Response(JSON.stringify({ error: tErr.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const tenantIds = (enabledTenants || []).map((t: any) => t.tenant_id).filter(Boolean);
  if (tenantIds.length === 0) {
    return new Response(JSON.stringify({ ok: true, message: "Aucun tenant avec birthday_email activé", todayMD, sent: 0 }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // 2) Récupère les tenants + branding en une requête
  const { data: tenantsData } = await supabase
    .from("tenants")
    .select(`id, name, slug, tenant_branding (display_name, logo_url, primary_color, email_sender_name, email_footer_text, company_phone, company_email)`)
    .in("id", tenantIds);
  const tenantsById = new Map<string, any>();
  (tenantsData || []).forEach((t: any) => tenantsById.set(t.id, t));

  // 3) Pour chaque tenant, cherche les clients avec birthdate match
  const sentEvents: any[] = [];
  let totalSent = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const tenantId of tenantIds) {
    const tenant = tenantsById.get(tenantId);
    if (!tenant) {
      log.warn("Tenant introuvable, skip", { tenantId });
      continue;
    }
    const branding = Array.isArray(tenant.tenant_branding) ? tenant.tenant_branding[0] : tenant.tenant_branding;

    // Postgres : `to_char(birthdate, 'MM-DD') = todayMD` impossible via PostgREST.
    // Alternative : pull tous les clients du tenant avec birthdate non null +
    // email, et filter en mémoire (acceptable < 10k clients/tenant).
    // Filtre business : seulement les clients ACTIFS (pas prospect, ni dormant,
    // ni résilié). Pas de mail anniversaire à un prospect qu'on n'a pas signé.
    const { data: clients, error: cErr } = await supabase
      .from("clients")
      .select("id, first_name, last_name, email, birthdate, type_adresse, status")
      .eq("tenant_id", tenantId)
      .eq("status", "actif")
      .not("birthdate", "is", null)
      .not("email", "is", null);
    if (cErr) {
      log.warn("Failed to fetch clients", { tenantId, err: cErr.message });
      totalErrors += 1;
      continue;
    }

    const birthdayClients = (clients || []).filter((c: any) => {
      if (!c.birthdate || !c.email) return false;
      const md = String(c.birthdate).slice(5, 10); // YYYY-MM-DD → MM-DD
      return md === todayMD;
    });

    log.info(`Tenant ${tenant.name} : ${birthdayClients.length} anniversaires aujourd'hui`, { tenantId });

    // Idempotence : on récupère last_birthday_email_sent_at pour ces clients
    const birthdayClientIds = birthdayClients.map((c: any) => c.id);
    const { data: idemRows } = birthdayClientIds.length > 0
      ? await supabase
          .from("clients")
          .select("id, last_birthday_email_sent_at")
          .in("id", birthdayClientIds)
      : { data: [] };
    const lastSentByClient = new Map<string, string | null>();
    (idemRows || []).forEach((r: any) => lastSentByClient.set(r.id, r.last_birthday_email_sent_at));

    const todayYMD = `${swissNow.getFullYear()}-${todayMD}`;

    for (const c of birthdayClients) {
      // Idempotence : skip si déjà envoyé aujourd'hui
      const lastSent = lastSentByClient.get(c.id);
      if (lastSent && String(lastSent).slice(0, 10) === todayYMD) {
        log.info(`Birthday already sent today for client ${c.id} — skip`);
        totalSkipped += 1;
        continue;
      }

      const firstName = (c.first_name || "client").trim();
      const { subject, html } = buildBirthdayHtml({
        firstName,
        branding,
        tenantName: tenant.name,
      });

      if (dryRun) {
        log.info(`[DRY RUN] would send to ${c.email}`, { tenantId, clientId: c.id });
        sentEvents.push({ tenant_id: tenantId, client_id: c.id, email: c.email, status: "dry_run" });
        continue;
      }

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${branding?.email_sender_name || tenant.name} <support@lyta.ch>`,
            to: [c.email],
            subject,
            html,
          }),
        });
        if (!res.ok) {
          const txt = await res.text();
          log.warn(`Resend failed for ${c.email}`, { status: res.status, body: txt.slice(0, 200) });
          totalErrors += 1;
          sentEvents.push({ tenant_id: tenantId, client_id: c.id, email: c.email, status: "error", error: `Resend ${res.status}` });
          continue;
        }
        totalSent += 1;
        sentEvents.push({ tenant_id: tenantId, client_id: c.id, email: c.email, status: "sent" });

        // Marque l'envoi pour idempotence (évite double envoi le même jour si
        // le cron retry ou si on déclenche manuellement)
        await supabase
          .from("clients")
          .update({ last_birthday_email_sent_at: new Date().toISOString() })
          .eq("id", c.id)
          .catch((e: any) => log.warn("clients update last_birthday_email_sent_at failed", { err: e?.message }));
      } catch (e) {
        totalErrors += 1;
        log.warn(`Birthday email exception for ${c.email}`, { err: (e as any)?.message });
        sentEvents.push({ tenant_id: tenantId, client_id: c.id, email: c.email, status: "error", error: (e as any)?.message });
      }
    }
  }

  // Notification king (récap quotidien)
  if (totalSent > 0 || totalErrors > 0) {
    await supabase.from("king_notifications").insert({
      title: `🎂 Anniversaires : ${totalSent} envoyés`,
      message: `${totalSent} email(s) anniversaire envoyé(s) aujourd'hui. ${totalErrors} échec(s). ${totalSkipped} déjà envoyés.`,
      kind: "birthday_emails_sent",
      priority: totalErrors > 0 ? "normal" : "low",
      metadata: { todayMD, sent: totalSent, errors: totalErrors, skipped: totalSkipped, dry_run: dryRun },
    }).catch(() => null);
  }

  return new Response(JSON.stringify({
    ok: true,
    todayMD,
    tenants_checked: tenantIds.length,
    sent: totalSent,
    skipped: totalSkipped,
    errors: totalErrors,
    dry_run: dryRun,
    events: sentEvents,
  }), { headers: { ...cors, "Content-Type": "application/json" } });
});
