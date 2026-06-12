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

interface TwilioSender {
  params: Record<string, string>;
  label: string;
}

interface TwilioPhoneNumber {
  phone_number?: string;
  capabilities?: {
    sms?: boolean;
    mms?: boolean;
    voice?: boolean;
  };
}

function normalizePhone(value: string): string {
  // Strip everything except digits and the leading `+`. Spaces, dashes,
  // parentheses, dots, no-break spaces — all gone.
  let phone = (value || "").trim().replace(/[^\d+]/g, "");
  if (!phone) return "";

  // 0041 79 ... → +41 79 ...
  if (phone.startsWith("00")) phone = `+${phone.slice(2)}`;

  // Defensive cleanup against double prefixes typed by humans.
  // Examples observed:
  //   "+41+41791234567"  → user typed +41 again over an already-prefixed
  //                        number from a saved record
  //   "++41791234567"    → double-tap on the keyboard
  //   "+41+791234567"    → less likely but cheap to handle
  while (/^\++/.test(phone) && (phone.match(/^\++/)?.[0].length ?? 0) > 1) {
    phone = `+${phone.replace(/^\++/, "")}`;
  }
  // "+41+41…" or "+41+…" → keep one +41 only
  phone = phone.replace(/^\+41\+/, "+");
  // Normalise a "+0…" anomaly (someone typed +0... instead of +41 0…)
  if (/^\+0/.test(phone)) phone = `+41${phone.slice(2)}`;

  // "+410791234567" → user kept the leading 0 of the Swiss national
  // format AFTER adding the country code → strip the 0 so we don't
  // ship 13 digits to Twilio.
  if (/^\+410\d{9}$/.test(phone)) {
    phone = `+41${phone.slice(4)}`;
  }
  // Same idea for France: "+330612345678" → "+33612345678"
  if (/^\+330\d{9}$/.test(phone)) {
    phone = `+33${phone.slice(4)}`;
  }

  if (phone.startsWith("+")) return phone;

  // No prefix shape recognised → assume Swiss
  if (phone.startsWith("41") && phone.length >= 11) return `+${phone}`;
  if (phone.startsWith("0")) return `+41${phone.slice(1)}`;
  return `+41${phone}`;
}

function assertValidPhone(phone: string, name: string): void {
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    throw new Error(`Numero SMS invalide pour ${name || "un destinataire"}: ${phone || "vide"}`);
  }
}

function isE164Phone(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(value);
}

function isMessagingServiceSid(value: string): boolean {
  return /^MG[0-9a-f]{32}$/i.test(value);
}

function isPhoneNumberSid(value: string): boolean {
  return /^PN[0-9a-f]{32}$/i.test(value);
}

function isAlphaSenderId(value: string): boolean {
  return /^[a-zA-Z0-9 ]{1,11}$/.test(value);
}

async function fetchTwilioJson(
  accountSid: string,
  authToken: string,
  path: string,
): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/${path}`,
    {
      headers: {
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      },
    },
  );

  return {
    ok: response.ok,
    data: await response.json(),
  };
}

async function findSmsCapableTwilioNumber(
  accountSid: string,
  authToken: string,
): Promise<string | null> {
  const { ok, data } = await fetchTwilioJson(
    accountSid,
    authToken,
    "IncomingPhoneNumbers.json?PageSize=100",
  );

  if (!ok) {
    return null;
  }

  const numbers = Array.isArray(data.incoming_phone_numbers)
    ? data.incoming_phone_numbers as TwilioPhoneNumber[]
    : [];

  const smsCapableNumber = numbers.find((number) => (
    number.capabilities?.sms === true &&
    typeof number.phone_number === "string" &&
    isE164Phone(number.phone_number)
  ));

  return smsCapableNumber?.phone_number ?? null;
}

async function resolveTwilioSender(
  accountSid: string,
  authToken: string,
  configuredSender: string,
): Promise<TwilioSender> {
  const sender = configuredSender.trim();

  if (isMessagingServiceSid(sender)) {
    return {
      params: { MessagingServiceSid: sender },
      label: sender,
    };
  }

  if (isE164Phone(sender) || isAlphaSenderId(sender)) {
    return {
      params: { From: sender },
      label: sender,
    };
  }

  if (isPhoneNumberSid(sender)) {
    const { ok, data } = await fetchTwilioJson(
      accountSid,
      authToken,
      `IncomingPhoneNumbers/${sender}.json`,
    );

    if (!ok) {
      throw new Error(
        data.message ||
          `Configuration Twilio invalide: impossible de resoudre le numero ${sender}`,
      );
    }

    const resolvedPhone = typeof data.phone_number === "string" ? data.phone_number.trim() : "";
    if (!isE164Phone(resolvedPhone)) {
      throw new Error(
        "Configuration Twilio invalide: le SID PN ne contient pas de numero expediteur E.164",
      );
    }

    const capabilities = data.capabilities as TwilioPhoneNumber["capabilities"] | undefined;
    if (capabilities?.sms !== true) {
      const fallbackPhone = await findSmsCapableTwilioNumber(accountSid, authToken);
      if (fallbackPhone) {
        log.warn("Twilio sender fallback to SMS-capable number", {
          configuredSender: sender,
          resolvedPhone,
          fallbackPhone,
        });
        return {
          params: { From: fallbackPhone },
          label: fallbackPhone,
        };
      }

      throw new Error(
        `Configuration Twilio invalide: le numero expediteur ${resolvedPhone} n'est pas compatible SMS. Configurez TWILIO_PHONE_NUMBER avec un numero SMS-capable ou TWILIO_MESSAGING_SERVICE_SID avec un service MG...`,
      );
    }

    return {
      params: { From: resolvedPhone },
      label: resolvedPhone,
    };
  }

  throw new Error(
    "Configuration Twilio invalide: utilisez un numero +..., un Sender ID alphanumerique, un SID PN... resolvable, ou un TWILIO_MESSAGING_SERVICE_SID MG...",
  );
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
    log.info("send-sms: starting", {
      hasAuth: !!req.headers.get("Authorization"),
      hasApikey: !!req.headers.get("apikey"),
    });

    // -- AUTH (durci juin 2026) ----------------------------------------
    // Historique : la fn "send-sms" avait été dégradée mai 2026 vers un
    // "light auth" qui acceptait un Bearer invalide pour contourner un
    // bug getUser() côté Supabase qui plantait sporadiquement. Mais le
    // code SUIVANT référençait `user.id` (jamais défini) → ReferenceError
    // déguisée en plantage silencieux. Et un Bearer falsifié bypasserait
    // l'auth — autorisant n'importe qui à déclencher des SMS payants.
    //
    // Fix : on durcit en revenant à un vrai check, MAIS avec un fallback
    // explicite + rate-limit serré pour ne pas re-tomber dans le 401
    // cascade qui avait motivé le bypass initial.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new AuthError("Missing Authorization header");
    }
    const userToken = authHeader.replace("Bearer ", "");

    let resolvedUserId: string | null = null;
    try {
      const verify = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { auth: { persistSession: false } },
      );
      const { data: userData, error: userErr } = await verify.auth.getUser(userToken);
      if (userErr) {
        log.warn("send-sms: getUser failed", { error: userErr.message });
      } else if (userData?.user?.id) {
        resolvedUserId = userData.user.id;
        log.info("send-sms: auth OK", { userId: resolvedUserId });
      }
    } catch (verifyErr) {
      log.warn("send-sms: getUser threw", {
        error: verifyErr instanceof Error ? verifyErr.message : String(verifyErr),
      });
    }

    // Sécurité : on REFUSE l'envoi si on n'a pas pu résoudre l'user.
    // Avant juin 2026, le code laissait passer (light-auth) + tombait
    // ensuite sur ReferenceError `user.id` à la ligne 304. Maintenant :
    // pas de user résolu → 401 propre, pas d'envoi de SMS.
    if (!resolvedUserId) {
      throw new AuthError("Token utilisateur invalide ou expiré");
    }

    try {
      await checkRateLimit(req, "send-sms", 10);
    } catch (rlErr) {
      log.error("send-sms: rate limit hit", {
        error: rlErr instanceof Error ? rlErr.message : String(rlErr),
      });
      throw rlErr;
    }

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
      // Vérif que le user est membre du tenant cible (anti-pivot cross-tenant)
      await requireTenantAccess(resolvedUserId, tenantId);
    } else {
      // Pas de tenantId fourni → on essaie de déduire depuis l'assignment
      // utilisateur. Si plusieurs tenants, on prend le premier (cas rare).
      const { data: assignment } = await supabase
        .from("user_tenant_assignments")
        .select("tenant_id")
        .eq("user_id", resolvedUserId)
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
    const TWILIO_MESSAGING_SERVICE_SID = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID");
    const configuredSender = TWILIO_MESSAGING_SERVICE_SID || TWILIO_PHONE_NUMBER;

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !configuredSender) {
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

    const sender = await resolveTwilioSender(
      TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN,
      configuredSender,
    );
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
              ...sender.params,
              Body: personalizedMessage,
            }),
          }
        );

        const data = await response.json();
        results.push({
          phone: recipient.phone,
          success: response.ok,
          sid: data.sid,
          from: response.ok ? sender.label : undefined,
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
