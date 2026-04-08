import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAuth, AuthError } from "../_shared/auth.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("send-sms");

interface SmsRequest {
  recipients: { phone: string; name: string }[];
  message: string;
}

serve(async (req: Request): Promise<Response> => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { user } = await requireAuth(req);
    await checkRateLimit(req, "send-sms", 10);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { recipients, message }: SmsRequest = await req.json();

    if (!recipients || recipients.length === 0) {
      throw new Error("Au moins un destinataire requis");
    }

    if (!message) {
      throw new Error("Message requis");
    }

    const { data: assignment } = await supabase
      .from("user_tenant_assignments")
      .select("tenant_id")
      .eq("user_id", user.id)
      .not("tenant_id", "is", null)
      .limit(1)
      .maybeSingle();

    const tenantId = assignment?.tenant_id ?? null;

    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      log.info("SMS simulation - Twilio non configuré");
      // Simulate success for demo purposes
      return new Response(
        JSON.stringify({
          success: true,
          sent: recipients.length,
          simulated: true,
          message: "SMS simulé (Twilio non configuré)",
        }),
        { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const results = [];

    for (const recipient of recipients) {
      // Replace variables in message (company_name should be passed from frontend with tenant branding)
      let personalizedMessage = message
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
        results.push({ phone: recipient.phone, success: response.ok, sid: data.sid });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({ phone: recipient.phone, success: false, error: errorMessage });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    if (tenantId && successCount > 0) {
      await supabase.rpc("increment_tenant_consumption", {
        p_tenant_id: tenantId,
        p_type: "sms",
        p_amount: successCount,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        total: recipients.length,
        results,
      }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
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
    log.error("SMS error", { error: error instanceof Error ? error.message : error });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
