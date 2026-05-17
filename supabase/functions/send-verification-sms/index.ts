import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAuth, AuthError } from "../_shared/auth.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { createLogger } from "../_shared/logger.ts";
import { QuotaError, releaseTenantQuota, reserveTenantQuota } from "../_shared/quota.ts";

const log = createLogger("send-verification-sms");

interface SendVerificationRequest {
  userId: string;
  phoneNumber: string;
  verificationType: "login" | "contract_deposit";
  metadata?: Record<string, unknown>;
}

serve(async (req: Request): Promise<Response> => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  let reservedTenantId: string | null = null;
  let quotaReserved = false;

  try {
    const { user } = await requireAuth(req);
    await checkRateLimit(req, "send-verification-sms", {
      identifier: `user:${user.id}`,
      maxPerWindow: 5,
      windowMs: 10 * 60 * 1000,
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, phoneNumber, verificationType, metadata }: SendVerificationRequest = await req.json();

    if (!userId || !phoneNumber) {
      throw new Error("userId et phoneNumber sont requis");
    }

    if (verificationType !== "login") {
      throw new Error("Type de vérification non supporté");
    }

    if (user.id !== userId) {
      throw new Error("Utilisateur non autorisé pour cette vérification");
    }

    // Normalize phone number to E.164 format
    const normalizePhone = (value: string) => {
      let v = (value || "").trim().replace(/[^\d+]/g, "");
      if (!v) return v;
      if (v.startsWith("00")) v = "+" + v.slice(2);
      if (v.startsWith("+")) return v;
      if (v.startsWith("41") && v.length >= 11) return "+" + v;
      if (v.startsWith("0")) return "+41" + v.slice(1);
      return "+41" + v;
    };

    const formattedPhone = normalizePhone(phoneNumber);

    const { data: assignment } = await supabase
      .from("user_tenant_assignments")
      .select("tenant_id")
      .eq("user_id", user.id)
      .not("tenant_id", "is", null)
      .limit(1)
      .maybeSingle();

    const tenantId = assignment?.tenant_id ?? null;

    // NE PAS consommer le quota SMS du tenant : c'est un SMS de vérification
    // (OTP login / signature). Event système → toujours gratuit, sinon un tenant
    // Start (0 SMS) ne pourrait jamais se connecter.
    // On track quand même côté coûts via trackTwilioSms (sync-external-billing).

    // Delete any existing pending verifications for this user/type
    await supabase
      .from("sms_verifications")
      .delete()
      .eq("user_id", userId)
      .eq("verification_type", verificationType)
      .is("verified_at", null);

    // Check Twilio Verify credentials
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_VERIFY_SERVICE_SID = Deno.env.get("TWILIO_VERIFY_SERVICE_SID");

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_VERIFY_SERVICE_SID) {
      // Simulation mode - generate a local code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      log.info("SMS simulation mode - Twilio Verify non configuré");
      log.info("Code de vérification généré", { phone: formattedPhone, code });

      const { error: insertError } = await supabase
        .from("sms_verifications")
        .insert({
          user_id: userId,
          phone_number: formattedPhone,
          code,
          verification_type: verificationType,
          expires_at: expiresAt,
          metadata: metadata || null,
        });

      if (insertError) {
        log.error("Error inserting verification", { error: insertError });
        throw new Error("Erreur lors de la création du code de vérification");
      }

      return new Response(
        JSON.stringify({
          success: true,
          simulated: true,
          message: "Code envoyé (simulation)",
        }),
        { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Use Twilio Verify API to send verification code
    const twilioResponse = await fetch(
      `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SERVICE_SID}/Verifications`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: formattedPhone,
          Channel: "sms",
        }),
      }
    );

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      log.error("Twilio Verify error", { error: twilioData });
      throw new Error(twilioData.message || "Erreur lors de l'envoi du SMS");
    }

    log.info("Twilio Verify SMS sent", { phone: formattedPhone, sid: twilioData.sid });

    // Store verification record (code managed by Twilio, we just track the attempt)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // Twilio Verify codes last 10 min
    
    const { error: insertError } = await supabase
      .from("sms_verifications")
      .insert({
        user_id: userId,
        phone_number: formattedPhone,
        code: "TWILIO_VERIFY", // Placeholder - Twilio manages the actual code
        verification_type: verificationType,
        expires_at: expiresAt,
        metadata: { ...metadata, twilio_sid: twilioData.sid },
      });

    if (insertError) {
      log.error("Error inserting verification record", { error: insertError });
      // Don't fail - the SMS was already sent
    }

    return new Response(
      JSON.stringify({
        success: true,
        simulated: false,
        message: "Code envoyé par SMS",
      }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    if (quotaReserved && reservedTenantId) {
      await releaseTenantQuota(
        createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!),
        reservedTenantId,
        "sms",
        1
      );
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
    log.error("Error in send-verification-sms", { error: error instanceof Error ? error.message : error });
    const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
