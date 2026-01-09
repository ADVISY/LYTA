import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyCodeRequest {
  userId: string;
  code: string;
  verificationType: "login" | "contract_deposit";
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, code, verificationType }: VerifyCodeRequest = await req.json();

    if (!userId || !code) {
      throw new Error("userId et code sont requis");
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
      console.error("Verification not found:", fetchError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Aucune vérification en cours. Veuillez demander un nouveau code." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if expired
    if (new Date(verification.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Le code a expiré. Veuillez demander un nouveau code." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check max attempts
    if (verification.attempts >= verification.max_attempts) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Trop de tentatives. Veuillez demander un nouveau code." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Increment attempts
    await supabase
      .from("sms_verifications")
      .update({ attempts: verification.attempts + 1 })
      .eq("id", verification.id);

    // Verify code
    if (verification.code !== code) {
      const remainingAttempts = verification.max_attempts - verification.attempts - 1;
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Code incorrect. ${remainingAttempts} tentative(s) restante(s).` 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark as verified
    await supabase
      .from("sms_verifications")
      .update({ verified_at: new Date().toISOString() })
      .eq("id", verification.id);

    console.log(`Verification successful for user ${userId}, type: ${verificationType}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Code vérifié avec succès",
        metadata: verification.metadata,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in verify-sms-code:", error);
    const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
