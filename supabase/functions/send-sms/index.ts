import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
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
    await checkRateLimit(req, "send-sms", 10);

    const { recipients, message }: SmsRequest = await req.json();

    if (!recipients || recipients.length === 0) {
      throw new Error("Au moins un destinataire requis");
    }

    if (!message) {
      throw new Error("Message requis");
    }

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
