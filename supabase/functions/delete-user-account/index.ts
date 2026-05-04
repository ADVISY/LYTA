import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAuth, AuthError } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("delete-user-account");

type AccountType = "client" | "collaborateur";

interface DeleteUserAccountRequest {
  tenantId?: string;
  userId?: string;
  clientId?: string;
  collaborateurId?: string;
  accountType?: AccountType;
}

type PermissionSpec = {
  module: string;
  action: string;
};

const STAFF_ROLES = ["admin", "manager", "agent", "backoffice", "compta", "partner"];

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

function getAccountType(body: DeleteUserAccountRequest): AccountType {
  if (body.accountType === "client" || body.accountType === "collaborateur") {
    return body.accountType;
  }

  return body.clientId ? "client" : "collaborateur";
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

async function canManageAccountAccess(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  tenantId: string,
  accountType: AccountType,
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

  const requiredPermissions: PermissionSpec[] = accountType === "client"
    ? [
        { module: "clients", action: "update" },
        { module: "clients", action: "delete" },
        { module: "settings", action: "update" },
      ]
    : [
        { module: "collaborators", action: "update" },
        { module: "collaborators", action: "delete" },
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
    const { user: requestingUser } = await requireAuth(req);

    let body: DeleteUserAccountRequest;
    try {
      body = await req.json();
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

    const accountType = getAccountType(body);
    const recordId = accountType === "client" ? body.clientId : body.collaborateurId;

    if (!recordId && !body.userId) {
      return json(req, { error: "ID du compte ou de l'utilisateur requis" }, 400);
    }

    const tenantId = await resolveTenantId(supabaseAdmin, requestingUser.id, body.tenantId);
    const authorized = await canManageAccountAccess(supabaseAdmin, requestingUser.id, tenantId, accountType);
    if (!authorized) {
      throw new AuthError("Acces refuse. Droits insuffisants pour supprimer cet acces.", 403);
    }

    let targetUserId = body.userId || null;
    let unlinkedRows = 0;

    if (recordId) {
      const { data: targetRecord, error: recordError } = await supabaseAdmin
        .from("clients")
        .select("id, user_id, type_adresse")
        .eq("id", recordId)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (recordError) {
        throw new AuthError(`Erreur lors de la recherche du compte: ${recordError.message}`, 500);
      }

      if (!targetRecord) {
        throw new AuthError(accountType === "client" ? "Client non trouve" : "Collaborateur non trouve", 404);
      }

      if (targetRecord.type_adresse !== accountType) {
        throw new AuthError("Le type de compte ne correspond pas a la fiche demandee", 400);
      }

      targetUserId = targetRecord.user_id || targetUserId;

      if (targetUserId === requestingUser.id) {
        throw new AuthError("Vous ne pouvez pas supprimer votre propre acces depuis cet ecran.", 400);
      }

      if (targetRecord.user_id) {
        const { error: unlinkError } = await supabaseAdmin
          .from("clients")
          .update({ user_id: null })
          .eq("id", recordId)
          .eq("tenant_id", tenantId);

        if (unlinkError) {
          throw new AuthError(`Erreur lors du retrait de l'acces: ${unlinkError.message}`, 500);
        }

        unlinkedRows += 1;
      }
    } else if (targetUserId) {
      if (targetUserId === requestingUser.id) {
        throw new AuthError("Vous ne pouvez pas supprimer votre propre acces depuis cet ecran.", 400);
      }

      const { error: unlinkError, count } = await supabaseAdmin
        .from("clients")
        .update({ user_id: null }, { count: "exact" })
        .eq("tenant_id", tenantId)
        .eq("type_adresse", accountType)
        .eq("user_id", targetUserId);

      if (unlinkError) {
        throw new AuthError(`Erreur lors du retrait de l'acces: ${unlinkError.message}`, 500);
      }

      unlinkedRows += count || 0;
    }

    if (!targetUserId) {
      return json(req, {
        success: true,
        accessRemoved: false,
        message: "Aucun compte utilisateur lie a cette fiche.",
      });
    }

    const [{ error: roleDeleteError }, { error: assignmentDeleteError }] = await Promise.all([
      supabaseAdmin
        .from("user_tenant_roles")
        .delete()
        .eq("user_id", targetUserId)
        .eq("tenant_id", tenantId),
      supabaseAdmin
        .from("user_tenant_assignments")
        .delete()
        .eq("user_id", targetUserId)
        .eq("tenant_id", tenantId),
    ]);

    if (roleDeleteError) {
      throw new AuthError(`Erreur lors du retrait des roles: ${roleDeleteError.message}`, 500);
    }

    if (assignmentDeleteError) {
      throw new AuthError(`Erreur lors du retrait du tenant: ${assignmentDeleteError.message}`, 500);
    }

    const [{ count: remainingAssignments }, { count: remainingLinkedRecords }] = await Promise.all([
      supabaseAdmin
        .from("user_tenant_assignments")
        .select("*", { count: "exact", head: true })
        .eq("user_id", targetUserId),
      supabaseAdmin
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("user_id", targetUserId),
    ]);

    if ((remainingAssignments || 0) === 0 && (remainingLinkedRecords || 0) === 0) {
      const rolesToDelete = accountType === "client" ? ["client"] : STAFF_ROLES;
      const { error: userRoleDeleteError } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", targetUserId)
        .in("role", rolesToDelete);

      if (userRoleDeleteError) {
        log.warn("Unable to cleanup global roles", { error: userRoleDeleteError.message, targetUserId });
      }
    }

    log.info("User account access removed", {
      tenantId,
      targetUserId,
      accountType,
      recordId,
      unlinkedRows,
    });

    return json(req, {
      success: true,
      accessRemoved: true,
      userId: targetUserId,
      unlinkedRows,
      message: "Acces supprime avec succes.",
    });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    log.error("Unhandled error", { error: message, status });
    return json(req, { error: message }, status);
  }
});
