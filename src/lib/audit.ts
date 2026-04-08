import { supabase } from "@/integrations/supabase/client";

interface RecordAuditLogParams {
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  tenantId?: string | null;
  userId?: string | null;
}

export async function recordAuditLog({
  action,
  entity,
  entityId,
  metadata = null,
  tenantId = null,
  userId = null,
}: RecordAuditLogParams): Promise<number | null> {
  if (!entityId) return null;

  try {
    let resolvedUserId = userId;

    if (!resolvedUserId) {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      resolvedUserId = data.user?.id ?? null;
    }

    if (!resolvedUserId) return null;

    const { data, error } = await supabase.rpc("create_audit_log", {
      p_user_id: resolvedUserId,
      p_action: action,
      p_entity: entity,
      p_entity_id: entityId,
      p_metadata: metadata,
      p_tenant_id: tenantId,
    });

    if (error) throw error;
    return data ?? null;
  } catch (error) {
    console.warn("[audit] Unable to record audit log:", error);
    return null;
  }
}
