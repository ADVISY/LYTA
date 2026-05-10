/**
 * Centralised email logger for Edge Functions.
 *
 * Habib (10/05): "il faut également mettre le suivi des envois d'email
 * dans la case publicité quand un email a été envoyé peu importe lequel".
 *
 * Use this from EVERY Edge Function that sends an email so the broker has
 * a single audit trail in the Publicité → Suivi emails tab. Failure to
 * log is non-fatal (we just warn) so a logging hiccup never prevents the
 * actual email from being sent.
 */
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type EmailLogKind =
  | "mandat_signed"
  | "mandat_dispatch"
  | "signature_invite"
  | "account_created"
  | "campaign"
  | "quick_email"
  | "crm_email"
  | "transactional";

export type EmailLogStatus = "sent" | "failed" | "queued" | "bounced";

export interface EmailLogInput {
  tenantId: string;
  kind: EmailLogKind;
  recipientEmail: string;
  recipientName?: string | null;
  senderName?: string | null;
  subject?: string | null;
  status: EmailLogStatus;
  errorMessage?: string | null;
  resendMessageId?: string | null;
  relatedEntityType?: string | null; // 'client' | 'signature_request' | 'campaign' | …
  relatedEntityId?: string | null;
  context?: Record<string, unknown>;
  triggeredBy?: string | null;
  sentAt?: string | null; // ISO; defaults to now() if status === 'sent'
}

let _admin: ReturnType<typeof createClient> | null = null;
function getAdmin() {
  if (_admin) return _admin;
  _admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return _admin;
}

export async function logEmail(entry: EmailLogInput): Promise<string | null> {
  if (!entry.tenantId || !entry.recipientEmail) {
    // Defensive — refuse to log obviously broken rows that would just
    // pollute the audit table.
    console.warn("[email-log] skipped — missing tenantId or recipientEmail", entry);
    return null;
  }

  try {
    const admin = getAdmin();
    const sentAt =
      entry.sentAt ??
      (entry.status === "sent" ? new Date().toISOString() : null);

    const { data, error } = await admin
      .from("tenant_email_log")
      .insert({
        tenant_id: entry.tenantId,
        kind: entry.kind,
        recipient_email: entry.recipientEmail,
        recipient_name: entry.recipientName ?? null,
        sender_name: entry.senderName ?? null,
        subject: entry.subject ?? null,
        status: entry.status,
        error_message: entry.errorMessage ?? null,
        resend_message_id: entry.resendMessageId ?? null,
        related_entity_type: entry.relatedEntityType ?? null,
        related_entity_id: entry.relatedEntityId ?? null,
        context: entry.context ?? {},
        triggered_by: entry.triggeredBy ?? null,
        sent_at: sentAt,
      })
      .select("id")
      .single();

    if (error) {
      console.warn("[email-log] insert failed", error);
      return null;
    }
    return (data as { id: string } | null)?.id ?? null;
  } catch (err) {
    console.warn("[email-log] unexpected error", err);
    return null;
  }
}
