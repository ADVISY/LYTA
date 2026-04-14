import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAuth, requireTenantAccess, AuthError } from "../_shared/auth.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { createLogger } from "../_shared/logger.ts";
import { QuotaError, releaseTenantQuota, reserveTenantQuota } from "../_shared/quota.ts";

const log = createLogger("send-sms");

interface SmsRequest {
  recipients: { phone: string; name: string }[];
  message: string;
  tenantId?: string;
}

function normalizePhone(value: string): string {
  let phone = (value || "").trim().replace(/[^\d+]/g, "");
  if (!phone) return "";
  if (phone.startsWith("00")) phone = `+${phone.slice(2)}`;
  if (phone.startsWith("+")) return phone;
  if (phone.startsWith("41") && phone.length >= 11) return `+${phone}`;
  if (phone.startsWith("0")) return `+41${phone.slice(1)}`;
  return `+41${phone}`;
}

function assertValidPhone(phone: string, name: string): void {
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    throw new Error(`Numero SMS invalide pour ${name || "un destinataire"}: ${phone || "vide"}`);
  }
}

serve(async (req: Request): Promise<Response> => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  let reservedTenantId: string | null = null;
  let reservedAmount = 0;

  try {
    const { user } = await requireAuth(req);
    await checkRateLimit(req, "send-sms", 10);

    const { recipients, message, tenantId: requestedTenantId }: SmsRequest = await req.json();

    if (!recipients || recipients.length === 0) {
      throw new Error("Au moins un destinataire requis");
    }

    if (!message) {
      throw new Error("Message requis");
    }

    const normalizedRecipients = recipients.map((recipient) => {
      const phone = normalizePhone(recipient.phone);
      assertValidPhone(phone, recipient.name);
      return { ...recipient, phone };
    });

    let tenantId = requestedTenantId ?? null;
    if (tenantId) {
      await requireTenantAccess(user.id, tenantId);
    } else {
      const { data: assignment } = await supabase
        .from("user_tenant_assignments")
        .select("tenant_id")
        .eq("user_id", user.id)
        .not("tenant_id", "is", null)
        .limit(1)
        .maybeSingle();

      tenantId = assignment?.tenant_id ?? null;
    }

    if (tenantId) {
      await reserveTenantQuota(supabase, tenantId, "sms", normalizedRecipients.length);
      reservedTenantId = tenantId;
      reservedAmount = normalizedRecipients.length;
    }

    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      log.info("SMS simulation - Twilio non configuré");
      if (reservedTenantId && reservedAmount > 0) {
        await releaseTenantQuota(supabase, reservedTenantId, "sms", reservedAmount);
        reservedAmount = 0;
      }
      // Simulate success for demo purposes
      return new Response(
        JSON.stringify({
          success: true,
          sent: normalizedRecipients.length,
          simulated: true,
          message: "SMS simulé (Twilio non configuré)",
        }),
        { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const results = [];

    for (const recipient of normalizedRecipients) {
      // Replace variables in message (company_name should be passed from frontend with tenant branding)
      const personalizedMessage = message
        .replace(/\{\{client_name\}\}/g, recipient.name);

      try {
        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              To: recipient.phone,
              From: TWILIO_PHONE_NUMBER,
              Body: personalizedMessage,
            }),
          }
        );

        const data = await response.json();
        results.push({
          phone: recipient.phone,
          success: response.ok,
          sid: data.sid,
          error: response.ok ? undefined : data.message || data.error_message || data.code || "Erreur Twilio",
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({ phone: recipient.phone, success: false, error: errorMessage });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    if (reservedTenantId && reservedAmount > successCount) {
      await releaseTenantQuota(supabase, reservedTenantId, "sms", reservedAmount - successCount);
      reservedAmount = successCount;
    }

    if (successCount === 0) {
      if (reservedTenantId && reservedAmount > 0) {
        await releaseTenantQuota(supabase, reservedTenantId, "sms", reservedAmount);
        reservedAmount = 0;
      }

      const firstError = results.find((result) => !result.success)?.error || "Aucun SMS n'a pu etre envoye";
      return new Response(
        JSON.stringify({
          success: false,
          error: firstError,
          sent: 0,
          total: normalizedRecipients.length,
          results,
        }),
        { status: 502, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        failed: normalizedRecipients.length - successCount,
        total: normalizedRecipients.length,
        results,
      }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    if (reservedTenantId && reservedAmount > 0) {
      await releaseTenantQuota(supabase, reservedTenantId, "sms", reservedAmount);
    }
    if (error instanceof AuthError) {
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: error.status,
          headers: {
            ...getCorsHeaders(req),
            "Content-Type": "application/json",
          },
        }
      );
    }
    if (error instanceof RateLimitError) {
      return new Response(
        JSON.stringify({ error: "Trop de requêtes, réessayez plus tard" }),
        {
          status: 429,
          headers: {
            ...getCorsHeaders(req),
            "Content-Type": "application/json",
            "Retry-After": String(error.retryAfter),
          },
        }
      );
    }
    if (error instanceof QuotaError) {
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: error.status,
          headers: {
            ...getCorsHeaders(req),
            "Content-Type": "application/json",
          },
        }
      );
    }
    log.error("SMS error", { error: error instanceof Error ? error.message : error });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
