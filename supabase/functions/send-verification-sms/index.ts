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

    // Generate a 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Expires in 5 minutes
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Delete any existing pending verifications for this user/type
    await supabase
      .from("sms_verifications")
      .delete()
      .eq("user_id", userId)
      .eq("verification_type", verificationType)
      .is("verified_at", null);

    // Insert new verification record
    const { error: insertError } = await supabase
      .from("sms_verifications")
      .insert({
        user_id: userId,
        phone_number: phoneNumber,
        code,
        verification_type: verificationType,
        expires_at: expiresAt,
        metadata: metadata || null,
      });

    if (insertError) {
      console.error("Error inserting verification:", insertError);
      throw new Error("Erreur lors de la création du code de vérification");
    }

    // Send SMS via Twilio
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      console.log("SMS simulation mode - Twilio non configuré");
      console.log(`Code de vérification pour ${phoneNumber}: ${code}`);
      
      return new Response(
        JSON.stringify({
          success: true,
          simulated: true,
          message: "Code envoyé (simulation)",
          // Only return code in simulation mode for testing
          testCode: code,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize phone numbers (Switzerland default) and prevent invalid Twilio sends
    const normalizePhone = (value: string) => {
      let v = (value || "").replace(/\s/g, "");
      if (!v) return v;
      if (v.startsWith("0")) v = "+41" + v.substring(1);
      if (!v.startsWith("+")) v = "+41" + v;
      return v;
    };

    const formattedPhone = normalizePhone(phoneNumber);
    const formattedFrom = normalizePhone(TWILIO_PHONE_NUMBER);

    // Twilio refuses To === From (error 21266). Fall back to simulation to unblock testing.
    if (formattedPhone && formattedFrom && formattedPhone === formattedFrom) {
      console.warn("Twilio misconfigured: To and From are the same", { formattedPhone });
      console.log(`Code de vérification pour ${formattedPhone}: ${code}`);

      return new Response(
        JSON.stringify({
          success: true,
          simulated: true,
          message: "Envoi SMS impossible (numéro expéditeur identique au destinataire). Code fourni en mode simulation.",
          testCode: code,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const message = verificationType === "login" 
      ? `Votre code de connexion LYTA: ${code}. Valide 5 minutes.`
      : `Votre code de vérification pour le dépôt de contrat: ${code}. Valide 5 minutes.`;

    const twilioResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: formattedPhone,
          From: formattedFrom,
          Body: message,
        }),
      }
    );

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error("Twilio error:", twilioData);
      throw new Error("Erreur lors de l'envoi du SMS");
    }

    console.log(`SMS sent to ${formattedPhone}, SID: ${twilioData.sid}`);

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
