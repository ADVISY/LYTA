import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAuth, requireTenantAccess, AuthError } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("save-policy");

type PolicyMutationAction = "create" | "update";

interface SavePolicyRequest {
  action: PolicyMutationAction;
  tenantId: string;
  policyId?: string;
  policyData: Record<string, unknown>;
}

interface PolicySnapshot {
  id: string;
  client_id: string | null;
  partner_id: string | null;
  product_id: string;
  policy_number: string | null;
  status: string;
  start_date: string;
  end_date: string | null;
  premium_monthly: number | null;
  premium_yearly: number | null;
  deductible: number | null;
  currency: string;
  notes: string | null;
  company_name: string | null;
  product_type: string | null;
  products_data: unknown;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function hasField(policyData: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(policyData, key);
}

function getPlaceholderProductSpec(rawProductType: string | null): { category: string; name: string } {
  const productType = (rawProductType ?? "").toLowerCase().trim();

  if (
    productType.includes("health") ||
    productType.includes("lamal") ||
    productType.includes("lca") ||
    productType.includes("sante") ||
    productType.includes("maladie")
  ) {
    return { category: "health", name: "Sana" };
  }

  if (
    productType.includes("life") ||
    productType.includes("vie") ||
    productType.includes("pilier") ||
    productType.includes("prevoyance")
  ) {
    return { category: "life", name: "Vita" };
  }

  if (
    productType.includes("home") ||
    productType.includes("menage") ||
    productType.includes("habitation") ||
    productType.includes("property")
  ) {
    return { category: "home", name: "Medio" };
  }

  if (productType.includes("auto") || productType.includes("vehicule") || productType.includes("voiture")) {
    return { category: "auto", name: "Auto" };
  }

  if (productType.includes("legal") || productType.includes("jurid")) {
    return { category: "legal", name: "Legal" };
  }

  return { category: "rcpro", name: "Business" };
}

async function resolvePlaceholderProductId(
  supabaseAdmin: ReturnType<typeof createClient>,
  rawProductType: string | null,
): Promise<string> {
  const { category, name } = getPlaceholderProductSpec(rawProductType);

  const { data: company, error: companyError } = await supabaseAdmin
    .from("insurance_companies")
    .upsert({ name: "Dépôt générique" }, { onConflict: "name" })
    .select("id")
    .single();

  if (companyError || !company) {
    throw new AuthError("Impossible de resoudre la compagnie placeholder", 500);
  }

  const { data: product, error: productError } = await supabaseAdmin
    .from("insurance_products")
    .upsert(
      {
        company_id: company.id,
        name,
        category,
        description: `Produit placeholder (${category})`,
        source: "manual",
      },
      { onConflict: "company_id,name" },
    )
    .select("id")
    .single();

  if (productError || !product) {
    throw new AuthError("Impossible de resoudre le produit placeholder", 500);
  }

  return product.id;
}

async function canManagePolicy(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  tenantId: string,
  action: PolicyMutationAction,
): Promise<boolean> {
  const requiredPermissionAction = action === "create" ? "deposit" : "update";

  const [{ data: assignment }, { data: globalRoles }] = await Promise.all([
    supabaseAdmin
      .from("user_tenant_assignments")
      .select("is_platform_admin")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId),
  ]);

  if (assignment?.is_platform_admin) {
    return true;
  }

  const allowedGlobalRoles = new Set(["king", "admin", "backoffice", "manager", "agent", "partner"]);

  if ((globalRoles ?? []).some(({ role }) => allowedGlobalRoles.has(String(role)))) {
    return true;
  }

  const { data: tenantRoleLinks } = await supabaseAdmin
    .from("user_tenant_roles")
    .select("role_id")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId);

  const roleIds = (tenantRoleLinks ?? []).map(({ role_id }) => role_id).filter(Boolean);
  if (roleIds.length === 0) {
    return false;
  }

  const { data: activeRoles } = await supabaseAdmin
    .from("tenant_roles")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .in("id", roleIds);

  const activeRoleIds = (activeRoles ?? []).map(({ id }) => id).filter(Boolean);
  if (activeRoleIds.length === 0) {
    return false;
  }

  const { data: permissions } = await supabaseAdmin
    .from("tenant_role_permissions")
    .select("role_id")
    .in("role_id", activeRoleIds)
    .eq("module", "contracts")
    .eq("action", requiredPermissionAction)
    .eq("allowed", true)
    .limit(1);

  return (permissions?.length ?? 0) > 0;
}

serve(async (req: Request): Promise<Response> => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { user } = await requireAuth(req);
    const { action, tenantId, policyId, policyData }: SavePolicyRequest = await req.json();

    if (action !== "create" && action !== "update") {
      throw new AuthError("Action invalide", 400);
    }

    if (!tenantId) {
      throw new AuthError("tenantId est requis", 400);
    }

    if (!policyData || typeof policyData !== "object") {
      throw new AuthError("policyData est requis", 400);
    }

    await requireTenantAccess(user.id, tenantId);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const authorized = await canManagePolicy(supabaseAdmin, user.id, tenantId, action);
    if (!authorized) {
      throw new AuthError("Vous n'avez pas les droits pour gerer les contrats", 403);
    }

    let existingPolicy: PolicySnapshot | null = null;

    if (action === "update") {
      if (!policyId) {
        throw new AuthError("policyId est requis pour une mise a jour", 400);
      }

      const { data } = await supabaseAdmin
        .from("policies")
        .select(`
          id,
          client_id,
          partner_id,
          product_id,
          policy_number,
          status,
          start_date,
          end_date,
          premium_monthly,
          premium_yearly,
          deductible,
          currency,
          notes,
          company_name,
          product_type,
          products_data
        `)
        .eq("id", policyId)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (!data) {
        throw new AuthError("Contrat introuvable pour ce cabinet", 404);
      }

      existingPolicy = data as PolicySnapshot;
    }

    const { data: partner } = await supabaseAdmin
      .from("partners")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    const resolvedProductId =
      (hasField(policyData, "product_id") ? asNullableString(policyData.product_id) : existingPolicy?.product_id ?? null) ??
      await resolvePlaceholderProductId(
        supabaseAdmin,
        hasField(policyData, "product_type")
          ? asNullableString(policyData.product_type)
          : existingPolicy?.product_type ?? null,
      );

    const payload = {
      tenant_id: tenantId,
      client_id: hasField(policyData, "client_id")
        ? asNullableString(policyData.client_id)
        : existingPolicy?.client_id ?? null,
      partner_id: hasField(policyData, "partner_id")
        ? asNullableString(policyData.partner_id)
        : existingPolicy?.partner_id ?? partner?.id ?? null,
      product_id: resolvedProductId,
      policy_number: hasField(policyData, "policy_number")
        ? asNullableString(policyData.policy_number)
        : existingPolicy?.policy_number ?? null,
      status: (
        hasField(policyData, "status")
          ? asNullableString(policyData.status)
          : existingPolicy?.status ?? "active"
      ) ?? "active",
      start_date: (
        hasField(policyData, "start_date")
          ? asNullableString(policyData.start_date)
          : existingPolicy?.start_date ?? new Date().toISOString().split("T")[0]
      ) ?? new Date().toISOString().split("T")[0],
      end_date: hasField(policyData, "end_date")
        ? asNullableString(policyData.end_date)
        : existingPolicy?.end_date ?? null,
      premium_monthly: hasField(policyData, "premium_monthly")
        ? asNullableNumber(policyData.premium_monthly)
        : existingPolicy?.premium_monthly ?? null,
      premium_yearly: hasField(policyData, "premium_yearly")
        ? asNullableNumber(policyData.premium_yearly)
        : existingPolicy?.premium_yearly ?? null,
      deductible: hasField(policyData, "deductible")
        ? asNullableNumber(policyData.deductible)
        : existingPolicy?.deductible ?? null,
      currency: (
        hasField(policyData, "currency")
          ? asNullableString(policyData.currency)
          : existingPolicy?.currency ?? "CHF"
      ) ?? "CHF",
      notes: hasField(policyData, "notes")
        ? asNullableString(policyData.notes)
        : existingPolicy?.notes ?? null,
      company_name: hasField(policyData, "company_name")
        ? asNullableString(policyData.company_name)
        : existingPolicy?.company_name ?? null,
      product_type: hasField(policyData, "product_type")
        ? asNullableString(policyData.product_type)
        : existingPolicy?.product_type ?? null,
      products_data: hasField(policyData, "products_data")
        ? policyData.products_data ?? null
        : existingPolicy?.products_data ?? null,
      // Per-policy branch override (overrides the product's branch in the UI).
      // Kept null when the broker hasn't picked an explicit branch on this contract.
      tenant_branch_id: hasField(policyData, "tenant_branch_id")
        ? asNullableString(policyData.tenant_branch_id)
        : existingPolicy?.tenant_branch_id ?? null,
    };

    if (!payload.product_id) {
      throw new AuthError("product_id est requis", 400);
    }

    if (payload.client_id) {
      const { data: client } = await supabaseAdmin
        .from("clients")
        .select("id")
        .eq("id", payload.client_id)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (!client) {
        throw new AuthError("Client introuvable pour ce cabinet", 403);
      }
    }

    if (action === "create") {
      const { data, error } = await supabaseAdmin
        .from("policies")
        .insert(payload)
        .select("id")
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, policy: data }),
        { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("policies")
      .update(payload)
      .eq("id", policyId!)
      .eq("tenant_id", tenantId)
      .select("id")
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, policy: data }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: error.status,
          headers: {
            ...getCorsHeaders(req),
            "Content-Type": "application/json",
          },
        },
      );
    }

    log.error("Error in save-policy", {
      error: error instanceof Error ? error.message : error,
    });

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erreur inconnue",
      }),
      {
        status: 400,
        headers: {
          ...getCorsHeaders(req),
          "Content-Type": "application/json",
        },
      },
    );
  }
});
