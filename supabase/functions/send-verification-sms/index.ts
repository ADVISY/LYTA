import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendVerificationRequest {
  userId: string;
  phoneNumber: string;
  verificationType: "login" | "contract_deposit";
  metadata?: Record<string, unknown>;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, phoneNumber, verificationType, metadata }: SendVerificationRequest = await req.json();

    if (!userId || !phoneNumber) {
      throw new Error("userId et phoneNumber sont requis");
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

      console.log("SMS simulation mode - Twilio Verify non configuré");
      console.log(`Code de vérification pour ${formattedPhone}: ${code}`);

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
        console.error("Error inserting verification:", insertError);
        throw new Error("Erreur lors de la création du code de vérification");
      }

      return new Response(
        JSON.stringify({
          success: true,
          simulated: true,
          message: "Code envoyé (simulation)",
          testCode: code,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
      console.error("Twilio Verify error:", twilioData);
      throw new Error(twilioData.message || "Erreur lors de l'envoi du SMS");
    }

    console.log(`Twilio Verify SMS sent to ${formattedPhone}, SID: ${twilioData.sid}`);

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
      console.error("Error inserting verification record:", insertError);
      // Don't fail - the SMS was already sent
    }

    return new Response(
      JSON.stringify({
        success: true,
        simulated: false,
        message: "Code envoyé par SMS",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in send-verification-sms:", error);
    const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
