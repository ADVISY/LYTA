/**
 * sync-external-billing
 * =====================
 * King-only : pull les usages réels depuis Resend (emails) et Twilio (SMS)
 * via leurs APIs, et les insère dans platform_usage_logs.
 *
 * - Resend : GET /emails (paginé) depuis le dernier log Resend
 * - Twilio : GET /Accounts/{SID}/Usage/Records.json (déjà agrégé par jour)
 *
 * Idempotent : utilise les `external_ref` (id Resend, id Twilio record) pour
 * ne pas dupliquer les logs.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAuth, AuthError } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("sync-external-billing");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");

const USD_TO_CHF = 0.88;
const RESEND_COST_PER_EMAIL_CHF = 0.000352;

interface SyncResult {
  provider: string;
  inserted: number;
  skipped: number;
  total_cost_chf: number;
  error?: string;
}

async function syncResend(supabase: any): Promise<SyncResult> {
  const result: SyncResult = { provider: "resend", inserted: 0, skipped: 0, total_cost_chf: 0 };
  if (!RESEND_API_KEY) {
    return { ...result, error: "RESEND_API_KEY missing" };
  }

  // Récupère le dernier log Resend pour reprendre où on s'est arrêté
  const { data: lastLog } = await supabase
    .from("platform_usage_logs")
    .select("created_at")
    .eq("provider", "resend")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const since = lastLog?.created_at ? new Date(lastLog.created_at) : new Date(Date.now() - 30 * 24 * 3600_000);

  // Pull les emails Resend (paginé)
  let after: string | undefined = undefined;
  const allEmails: any[] = [];
  for (let i = 0; i < 20; i++) {  // max 20 pages = 2000 emails
    const url = new URL("https://api.resend.com/emails");
    url.searchParams.set("limit", "100");
    if (after) url.searchParams.set("after", after);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
    });
    if (!res.ok) {
      return { ...result, error: `Resend API ${res.status}: ${await res.text()}` };
    }
    const data = await res.json() as { data: any[] };
    const batch = data.data || [];
    if (batch.length === 0) break;

    // Stop dès qu'on dépasse since
    const recent = batch.filter(e => new Date(e.created_at) > since);
    allEmails.push(...recent);
    if (recent.length < batch.length) break;  // on a touché le mur du since

    after = batch[batch.length - 1].id;
  }

  if (allEmails.length === 0) {
    return result;
  }

  // Récup les external_ref déjà loggés pour idempotence
  const ids = allEmails.map(e => e.id);
  const { data: existing } = await supabase
    .from("platform_usage_logs")
    .select("external_ref")
    .eq("provider", "resend")
    .in("external_ref", ids);
  const existingSet = new Set((existing || []).map((r: any) => r.external_ref));

  // Insert les nouveaux
  const toInsert = allEmails
    .filter(e => !existingSet.has(e.id))
    .map(e => ({
      provider: "resend",
      event_type: "email_sent",
      tenant_id: null,
      input_units: 1,
      cost_chf: RESEND_COST_PER_EMAIL_CHF,
      external_ref: e.id,
      created_at: e.created_at,
      metadata: { to: e.to, from: e.from, subject: e.subject, last_event: e.last_event },
    }));

  if (toInsert.length > 0) {
    const { error: insErr } = await supabase.from("platform_usage_logs").insert(toInsert);
    if (insErr) return { ...result, error: insErr.message };
    result.inserted = toInsert.length;
    result.total_cost_chf = toInsert.length * RESEND_COST_PER_EMAIL_CHF;
  }
  result.skipped = allEmails.length - result.inserted;
  return result;
}

async function syncTwilio(supabase: any): Promise<SyncResult> {
  const result: SyncResult = { provider: "twilio", inserted: 0, skipped: 0, total_cost_chf: 0 };
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    return { ...result, error: "TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN missing" };
  }

  // Date depuis laquelle on pull (30 derniers jours par défaut, ou depuis le dernier log)
  const { data: lastLog } = await supabase
    .from("platform_usage_logs")
    .select("created_at")
    .eq("provider", "twilio")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const startDate = lastLog?.created_at
    ? new Date(lastLog.created_at).toISOString().slice(0, 10)
    : new Date(Date.now() - 30 * 24 * 3600_000).toISOString().slice(0, 10);

  // Twilio Usage Records (déjà agrégés par jour, par catégorie)
  // https://www.twilio.com/docs/usage/api/usage-record
  const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  const url = new URL(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Usage/Records/Daily.json`);
  url.searchParams.set("Category", "sms");
  url.searchParams.set("StartDate", startDate);
  url.searchParams.set("PageSize", "100");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) {
    return { ...result, error: `Twilio API ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as { usage_records: any[] };
  const records = data.usage_records || [];

  if (records.length === 0) return result;

  // Idempotence : external_ref = "twilio_daily_sms_YYYY-MM-DD"
  const refs = records.map(r => `twilio_daily_sms_${r.start_date}`);
  const { data: existing } = await supabase
    .from("platform_usage_logs")
    .select("external_ref")
    .eq("provider", "twilio")
    .in("external_ref", refs);
  const existingSet = new Set((existing || []).map((r: any) => r.external_ref));

  const toInsert = records
    .filter(r => !existingSet.has(`twilio_daily_sms_${r.start_date}`) && Number(r.count) > 0)
    .map(r => {
      const priceUsd = Math.abs(Number(r.price || 0));  // peut être négatif
      return {
        provider: "twilio",
        event_type: "sms_sent",
        tenant_id: null,
        input_units: Number(r.count) || 0,
        cost_chf: priceUsd * USD_TO_CHF,
        external_ref: `twilio_daily_sms_${r.start_date}`,
        created_at: `${r.start_date}T12:00:00Z`,  // midi du jour pour bucket clair
        metadata: { start_date: r.start_date, end_date: r.end_date, count_unit: r.count_unit, price_unit: r.price_unit },
      };
    });

  if (toInsert.length > 0) {
    const { error: insErr } = await supabase.from("platform_usage_logs").insert(toInsert);
    if (insErr) return { ...result, error: insErr.message };
    result.inserted = toInsert.length;
    result.total_cost_chf = toInsert.reduce((s, r) => s + Number(r.cost_chf), 0);
  }
  result.skipped = records.length - result.inserted;
  return result;
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
    const isKing = (roles || []).some((r: any) => r.role === "king" || r.role === "admin");
    if (!isKing) throw new AuthError("Forbidden — king/admin required", 403);

    const body = (await req.json().catch(() => ({}))) as { providers?: string[] };
    const providers = body.providers || ["resend", "twilio"];

    const results: SyncResult[] = [];
    if (providers.includes("resend")) {
      results.push(await syncResend(supabase));
    }
    if (providers.includes("twilio")) {
      results.push(await syncTwilio(supabase));
    }

    return new Response(JSON.stringify({
      ok: true,
      results,
      summary: {
        total_inserted: results.reduce((s, r) => s + r.inserted, 0),
        total_cost_chf: results.reduce((s, r) => s + r.total_cost_chf, 0),
      },
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
