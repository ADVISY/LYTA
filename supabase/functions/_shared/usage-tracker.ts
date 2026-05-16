/**
 * Usage tracker — log les appels facturés dans platform_usage_logs.
 *
 * Fire-and-forget : si l'INSERT échoue (perm refusée, table down, …),
 * on logge l'erreur mais on bloque PAS le flow principal du caller.
 *
 * Coûts OpenAI gpt-5 (2025-2026 indicatif, à ajuster si Anthropic Anthropic
 * Anthropic^H^H^H^H^H OpenAI met à jour ses tarifs) :
 *   - gpt-5      : $2 / 1M tokens input, $10 / 1M tokens output
 *   - gpt-5-mini : $0.25 / 1M tokens input, $1.25 / 1M tokens output
 *
 * Conversion CHF approximative : 1 USD = 0.88 CHF.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const USD_TO_CHF = 0.88;

const OPENAI_PRICING_USD_PER_M_TOKENS: Record<string, { input: number; output: number }> = {
  "gpt-5":        { input: 2.0,  output: 10.0 },
  "gpt-5-mini":   { input: 0.25, output: 1.25 },
  "gpt-5-nano":   { input: 0.05, output: 0.40 },
  "gpt-4o":       { input: 2.5,  output: 10.0 },
  "gpt-4o-mini":  { input: 0.15, output: 0.60 },
};

function computeOpenAiCostChf(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = OPENAI_PRICING_USD_PER_M_TOKENS[model]
    || OPENAI_PRICING_USD_PER_M_TOKENS[model.replace(/-\d{4}-\d{2}-\d{2}$/, "")]
    || OPENAI_PRICING_USD_PER_M_TOKENS["gpt-5"];  // fallback prudent
  const inputUsd = (inputTokens / 1_000_000) * pricing.input;
  const outputUsd = (outputTokens / 1_000_000) * pricing.output;
  return (inputUsd + outputUsd) * USD_TO_CHF;
}

// Coûts Resend : ~$0 jusqu'à 3000 emails/mois, puis $20 pour 50k/mois = $0.0004/email
// On utilise $0.0004/email = 0.000352 CHF
const RESEND_COST_PER_EMAIL_CHF = 0.000352;

// Coûts Twilio Switzerland SMS : ~CHF 0.10 / SMS sortant
const TWILIO_COST_PER_SMS_CHF = 0.10;

interface SupabaseClient {
  from: (table: string) => any;
}

function getServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export async function trackOpenAiUsage(opts: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  tenantId?: string | null;
  eventType?: string;     // ex: 'scan_document', 'scan_decompte', 'ai_chat'
  externalRef?: string;   // openai request id
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = getServiceClient();
    const cost = computeOpenAiCostChf(opts.model, opts.inputTokens, opts.outputTokens);
    await supabase.from("platform_usage_logs").insert({
      provider: "openai",
      event_type: opts.eventType || "chat_completion",
      model: opts.model,
      tenant_id: opts.tenantId ?? null,
      input_units: opts.inputTokens,
      output_units: opts.outputTokens,
      cost_chf: cost,
      external_ref: opts.externalRef ?? null,
      metadata: opts.metadata ?? null,
    });
  } catch (e) {
    console.warn("[usage-tracker] OpenAI track failed:", (e as any)?.message);
  }
}

export async function trackResendEmail(opts: {
  count?: number;          // nombre d'emails envoyés (1 par défaut)
  tenantId?: string | null;
  eventType?: string;      // ex: 'welcome_email', 'signature_invite'
  externalRef?: string;    // resend email id
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = getServiceClient();
    const count = opts.count ?? 1;
    await supabase.from("platform_usage_logs").insert({
      provider: "resend",
      event_type: opts.eventType || "email_sent",
      tenant_id: opts.tenantId ?? null,
      input_units: count,
      cost_chf: count * RESEND_COST_PER_EMAIL_CHF,
      external_ref: opts.externalRef ?? null,
      metadata: opts.metadata ?? null,
    });
  } catch (e) {
    console.warn("[usage-tracker] Resend track failed:", (e as any)?.message);
  }
}

export async function trackTwilioSms(opts: {
  count?: number;
  tenantId?: string | null;
  eventType?: string;
  externalRef?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = getServiceClient();
    const count = opts.count ?? 1;
    await supabase.from("platform_usage_logs").insert({
      provider: "twilio",
      event_type: opts.eventType || "sms_sent",
      tenant_id: opts.tenantId ?? null,
      input_units: count,
      cost_chf: count * TWILIO_COST_PER_SMS_CHF,
      external_ref: opts.externalRef ?? null,
      metadata: opts.metadata ?? null,
    });
  } catch (e) {
    console.warn("[usage-tracker] Twilio track failed:", (e as any)?.message);
  }
}

/** Helper : extrait input/output tokens depuis une réponse OpenAI chat completions */
export function extractOpenAiUsage(aiJson: any): { inputTokens: number; outputTokens: number; requestId?: string } {
  const usage = aiJson?.usage || {};
  return {
    inputTokens: Number(usage.prompt_tokens || usage.input_tokens || 0),
    outputTokens: Number(usage.completion_tokens || usage.output_tokens || 0),
    requestId: aiJson?.id,
  };
}
