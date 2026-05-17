/**
 * Audit log helper — log les actions sensibles dans king_audit_log.
 * Fire-and-forget : ne bloque jamais le caller en cas d'erreur.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function auditLog(opts: {
  actionType: string;        // ex: 'tenant.suspended', 'tenant.impersonate'
  actorUserId?: string | null;
  actorRole?: string;
  actorEmail?: string | null;
  targetType?: string;       // 'tenant' | 'user' | 'plan' | ...
  targetId?: string | null;
  targetLabel?: string | null;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    await supabase.from("king_audit_log").insert({
      action_type: opts.actionType,
      actor_user_id: opts.actorUserId ?? null,
      actor_role: opts.actorRole ?? null,
      actor_email: opts.actorEmail ?? null,
      target_type: opts.targetType ?? null,
      target_id: opts.targetId ?? null,
      target_label: opts.targetLabel ?? null,
      changes: opts.changes ?? null,
      metadata: opts.metadata ?? null,
    });
  } catch (e) {
    console.warn("[audit-log] insert failed:", (e as any)?.message);
  }
}
