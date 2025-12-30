import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SmsRequest {
  recipients: { phone: string; name: string }[];
  message: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
      console.log("SMS simulation - Twilio non configuré");
      // Simulate success for demo purposes
      return new Response(
        JSON.stringify({
          success: true,
          sent: recipients.length,
          simulated: true,
          message: "SMS simulé (Twilio non configuré)",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = [];

    for (const recipient of recipients) {
      // Replace variables in message
      let personalizedMessage = message
        .replace(/\{\{client_name\}\}/g, recipient.name)
        .replace(/\{\{company_name\}\}/g, "Advisy");

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
      } catch (error) {
        results.push({ phone: recipient.phone, success: false, error: error.message });
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
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("SMS error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
