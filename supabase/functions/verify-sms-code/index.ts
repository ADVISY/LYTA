import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAuth, AuthError } from "../_shared/auth.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("verify-sms-code");

interface VerifyCodeRequest {
  userId: string;
  code: string;
  verificationType: "login" | "contract_deposit";
}

serve(async (req: Request): Promise<Response> => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { user } = await requireAuth(req);
    await checkRateLimit(req, "verify-sms-code", 10);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, code, verificationType }: VerifyCodeRequest = await req.json();

    if (!userId || !code) {
      throw new Error("userId et code sont requis");
    }

    if (verificationType !== "login") {
      throw new Error("Type de vérification non supporté");
    }

    if (user.id !== userId) {
      throw new Error("Utilisateur non autorisé pour cette vérification");
    }

    // Find the verification record
    const { data: verification, error: fetchError } = await supabase
      .from("sms_verifications")
      .select("*")
      .eq("user_id", userId)
      .eq("verification_type", verificationType)
      .is("verified_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !verification) {
      log.error("Verification not found", { error: fetchError });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Aucune vérification en cours. Veuillez demander un nouveau code." 
        }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Check if expired
    if (new Date(verification.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Le code a expiré. Veuillez demander un nouveau code." 
        }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Check max attempts
    if (verification.attempts >= verification.max_attempts) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Trop de tentatives. Veuillez demander un nouveau code." 
        }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Increment attempts
    await supabase
      .from("sms_verifications")
      .update({ attempts: verification.attempts + 1 })
      .eq("id", verification.id);

    // Check if using Twilio Verify API
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_VERIFY_SERVICE_SID = Deno.env.get("TWILIO_VERIFY_SERVICE_SID");

    const useTwilioVerify = verification.code === "TWILIO_VERIFY" && 
      TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_VERIFY_SERVICE_SID;

    if (useTwilioVerify) {
      // Use Twilio Verify API to check code
      const twilioResponse = await fetch(
        `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SERVICE_SID}/VerificationCheck`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: verification.phone_number,
            Code: code,
          }),
        }
      );

      const twilioData = await twilioResponse.json();

      if (!twilioResponse.ok || twilioData.status !== "approved") {
        log.error("Twilio Verify check failed", { error: twilioData });
        const remainingAttempts = verification.max_attempts - verification.attempts - 1;
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Code incorrect. ${remainingAttempts} tentative(s) restante(s).` 
          }),
          { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }

      log.info("Twilio Verify check approved", { phone: verification.phone_number });
    } else {
      // Fallback: verify code stored in database (simulation mode)
      if (verification.code !== code) {
        const remainingAttempts = verification.max_attempts - verification.attempts - 1;
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Code incorrect. ${remainingAttempts} tentative(s) restante(s).` 
          }),
          { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }
    }

    // Mark as verified
    await supabase
      .from("sms_verifications")
      .update({ verified_at: new Date().toISOString() })
      .eq("id", verification.id);

    log.info("Verification successful", { userId, verificationType });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Code vérifié avec succès",
        metadata: verification.metadata,
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
    log.error("Error in verify-sms-code", { error: error instanceof Error ? error.message : error });
    const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
