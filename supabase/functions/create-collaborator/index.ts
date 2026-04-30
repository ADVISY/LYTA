import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAuth, AuthError } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("create-collaborator");

type PermissionSpec = {
  module: string;
  action: string;
};

interface CreateCollaboratorRequest {
  tenantId?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  mobile?: string;
  profession?: string;
  status?: string;
  manager_id?: string | null;
  commission_rate?: number;
  commission_rate_lca?: number;
  commission_rate_vie?: number;
  fixed_salary?: number;
  bonus_rate?: number;
  contract_type?: string;
  work_percentage?: number;
  hire_date?: string;
  manager_commission_rate_lca?: number;
  manager_commission_rate_vie?: number;
  reserve_rate?: number;
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

function normalizeOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeOptionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function resolveTenantId(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  requestedTenantId?: string,
): Promise<string> {
  if (requestedTenantId) {
    return requestedTenantId;
  }

  const { data: assignment, error } = await supabaseAdmin
    .from("user_tenant_assignments")
    .select("tenant_id")
    .eq("user_id", userId)
    .not("tenant_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new AuthError(`Erreur lors de la resolution du tenant: ${error.message}`, 500);
  }

  if (!assignment?.tenant_id) {
    throw new AuthError("Utilisateur non assigne a un tenant", 400);
  }

  return assignment.tenant_id;
}

async function canCreateCollaborator(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  tenantId: string,
): Promise<boolean> {
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

  if ((globalRoles ?? []).some(({ role }) => role === "admin" || role === "king")) {
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

  const requiredPermissions: PermissionSpec[] = [
    { module: "collaborators", action: "create" },
    { module: "settings", action: "update" },
  ];

  const { data: permissions } = await supabaseAdmin
    .from("tenant_role_permissions")
    .select("module, action")
    .in("role_id", activeRoleIds)
    .eq("allowed", true);

  return (permissions ?? []).some((permission) =>
    requiredPermissions.some(
      (required) =>
        permission.module === required.module &&
        permission.action === required.action,
    ),
  );
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { user } = await requireAuth(req);

    let requestBody: CreateCollaboratorRequest;
    try {
      requestBody = await req.json();
    } catch {
      return json(req, { error: "Corps de la requete invalide (JSON attendu)" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const tenantId = await resolveTenantId(supabaseAdmin, user.id, requestBody.tenantId);
    const authorized = await canCreateCollaborator(supabaseAdmin, user.id, tenantId);

    if (!authorized) {
      throw new AuthError("Acces refuse. Droits insuffisants pour creer un collaborateur.", 403);
    }

    const firstName = normalizeOptionalString(requestBody.first_name);
    const lastName = normalizeOptionalString(requestBody.last_name);
    const email = normalizeOptionalString(requestBody.email);

    if (!firstName || !lastName || !email) {
      return json(req, { error: "Prenom, nom et email sont requis" }, 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return json(req, { error: "Format d'email invalide" }, 400);
    }

    const collaboratorPayload = {
      tenant_id: tenantId,
      type_adresse: "collaborateur",
      first_name: firstName,
      last_name: lastName,
      email,
      mobile: normalizeOptionalString(requestBody.mobile),
      profession: normalizeOptionalString(requestBody.profession) ?? "agent",
      status: normalizeOptionalString(requestBody.status) ?? "actif",
      manager_id: normalizeOptionalString(requestBody.manager_id),
      commission_rate: normalizeOptionalNumber(requestBody.commission_rate),
      commission_rate_lca: normalizeOptionalNumber(requestBody.commission_rate_lca),
      commission_rate_vie: normalizeOptionalNumber(requestBody.commission_rate_vie),
      fixed_salary: normalizeOptionalNumber(requestBody.fixed_salary),
      bonus_rate: normalizeOptionalNumber(requestBody.bonus_rate),
      contract_type: normalizeOptionalString(requestBody.contract_type),
      work_percentage: normalizeOptionalNumber(requestBody.work_percentage),
      hire_date: normalizeOptionalString(requestBody.hire_date),
      manager_commission_rate_lca: normalizeOptionalNumber(requestBody.manager_commission_rate_lca),
      manager_commission_rate_vie: normalizeOptionalNumber(requestBody.manager_commission_rate_vie),
      reserve_rate: normalizeOptionalNumber(requestBody.reserve_rate),
    };

    const { data: collaborator, error: insertError } = await supabaseAdmin
      .from("clients")
      .insert(collaboratorPayload)
      .select("id")
      .single();

    if (insertError) {
      log.error("Error creating collaborator", { error: insertError, tenantId });
      throw new AuthError(`Erreur lors de la creation du collaborateur: ${insertError.message}`, 500);
    }

    return json(req, { success: true, id: collaborator.id });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    log.error("Unhandled error", { error: message, status });
    return json(req, { error: message }, status);
  }
});
