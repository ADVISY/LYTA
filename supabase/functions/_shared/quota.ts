import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export class QuotaError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

type QuotaType = "sms" | "email" | "ai_docs";

function normalizeQuotaMessage(message?: string | null): string {
  const value = (message || "").trim();
  if (!value) return "Quota du cabinet atteint";

  if (value.startsWith("Quota ") || value.startsWith("Le scan IA")) {
    return value;
  }

  return "Quota du cabinet atteint";
}

export async function reserveTenantQuota(
  supabase: SupabaseClient,
  tenantId: string | null | undefined,
  type: QuotaType,
  amount = 1
): Promise<void> {
  if (!tenantId || amount <= 0) return;

  const { error } = await supabase.rpc("reserve_tenant_quota", {
    p_tenant_id: tenantId,
    p_type: type,
    p_amount: amount,
  });

  if (error) {
    throw new QuotaError(normalizeQuotaMessage(error.message));
  }
}

export async function releaseTenantQuota(
  supabase: SupabaseClient,
  tenantId: string | null | undefined,
  type: QuotaType,
  amount = 1
): Promise<void> {
  if (!tenantId || amount <= 0) return;

  const { error } = await supabase.rpc("release_tenant_quota", {
    p_tenant_id: tenantId,
    p_type: type,
    p_amount: amount,
  });

  if (error) {
    console.warn("[quota] Unable to release reserved quota", { tenantId, type, amount, error: error.message });
  }
}
