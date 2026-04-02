import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAuth, AuthError } from "../_shared/auth.ts";
import { checkKingIpWhitelist, IpWhitelistError } from "../_shared/ip-whitelist.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("delete-tenant");

interface DeleteTenantRequest {
  tenant_id: string;
  confirmation_name: string;
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Verify caller identity via shared auth
    const { user } = await requireAuth(req);
    await checkKingIpWhitelist(req);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Check if user is king
    const { data: kingRole, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "king")
      .single();

    if (roleError || !kingRole) {
      return new Response(
        JSON.stringify({ error: "Accès refusé - Rôle King requis" }),
        { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const { tenant_id, confirmation_name }: DeleteTenantRequest = await req.json();

    if (!tenant_id || !confirmation_name) {
      return new Response(
        JSON.stringify({ error: "tenant_id et confirmation_name sont requis" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Get tenant to verify confirmation
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .select("id, name, slug")
      .eq("id", tenant_id)
      .single();

    if (tenantError || !tenant) {
      return new Response(
        JSON.stringify({ error: "Tenant non trouvé" }),
        { status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Verify confirmation matches tenant name
    if (confirmation_name.toLowerCase() !== tenant.name.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: "Le nom de confirmation ne correspond pas" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    log.info("Starting deletion of tenant", { tenantName: tenant.name, tenantId: tenant_id });

    const errors: string[] = [];

    // Delete in order to respect foreign key constraints
    // 1. Delete user_tenant_roles
    const { error: errUserTenantRoles } = await supabaseAdmin.from("user_tenant_roles").delete().eq("tenant_id", tenant_id);
    if (errUserTenantRoles) { log.error("Failed: user_tenant_roles", { error: errUserTenantRoles.message }); errors.push(`user_tenant_roles: ${errUserTenantRoles.message}`); }

    // 2. Delete user_tenant_assignments
    const { error: errUserTenantAssignments } = await supabaseAdmin.from("user_tenant_assignments").delete().eq("tenant_id", tenant_id);
    if (errUserTenantAssignments) { log.error("Failed: user_tenant_assignments", { error: errUserTenantAssignments.message }); errors.push(`user_tenant_assignments: ${errUserTenantAssignments.message}`); }

    // 3. Delete tenant_roles (will cascade to tenant_role_permissions)
    const { error: errTenantRoles } = await supabaseAdmin.from("tenant_roles").delete().eq("tenant_id", tenant_id);
    if (errTenantRoles) { log.error("Failed: tenant_roles", { error: errTenantRoles.message }); errors.push(`tenant_roles: ${errTenantRoles.message}`); }

    // 4. Delete claims
    const { error: errClaims } = await supabaseAdmin.from("claims").delete().eq("tenant_id", tenant_id);
    if (errClaims) { log.error("Failed: claims", { error: errClaims.message }); errors.push(`claims: ${errClaims.message}`); }

    // 5. Delete commissions
    const { error: errCommissions } = await supabaseAdmin.from("commissions").delete().eq("tenant_id", tenant_id);
    if (errCommissions) { log.error("Failed: commissions", { error: errCommissions.message }); errors.push(`commissions: ${errCommissions.message}`); }

    // 6. Delete policies
    const { error: errPolicies } = await supabaseAdmin.from("policies").delete().eq("tenant_id", tenant_id);
    if (errPolicies) { log.error("Failed: policies", { error: errPolicies.message }); errors.push(`policies: ${errPolicies.message}`); }

    // 7. Delete documents
    const { error: errDocuments } = await supabaseAdmin.from("documents").delete().eq("tenant_id", tenant_id);
    if (errDocuments) { log.error("Failed: documents", { error: errDocuments.message }); errors.push(`documents: ${errDocuments.message}`); }

    // 8. Delete clients
    const { error: errClients } = await supabaseAdmin.from("clients").delete().eq("tenant_id", tenant_id);
    if (errClients) { log.error("Failed: clients", { error: errClients.message }); errors.push(`clients: ${errClients.message}`); }

    // 9. Delete notifications
    const { error: errNotifications } = await supabaseAdmin.from("notifications").delete().eq("tenant_id", tenant_id);
    if (errNotifications) { log.error("Failed: notifications", { error: errNotifications.message }); errors.push(`notifications: ${errNotifications.message}`); }

    // 10. Delete suivis
    const { error: errSuivis } = await supabaseAdmin.from("suivis").delete().eq("tenant_id", tenant_id);
    if (errSuivis) { log.error("Failed: suivis", { error: errSuivis.message }); errors.push(`suivis: ${errSuivis.message}`); }

    // 11. Delete decomptes
    const { error: errDecomptes } = await supabaseAdmin.from("decomptes").delete().eq("tenant_id", tenant_id);
    if (errDecomptes) { log.error("Failed: decomptes", { error: errDecomptes.message }); errors.push(`decomptes: ${errDecomptes.message}`); }

    // 12. Delete king_notifications for this tenant
    const { error: errKingNotifications } = await supabaseAdmin.from("king_notifications").delete().eq("tenant_id", tenant_id);
    if (errKingNotifications) { log.error("Failed: king_notifications", { error: errKingNotifications.message }); errors.push(`king_notifications: ${errKingNotifications.message}`); }

    // 13. Delete king_audit_logs for this tenant
    const { error: errKingAuditLogs } = await supabaseAdmin.from("king_audit_logs").delete().eq("tenant_id", tenant_id);
    if (errKingAuditLogs) { log.error("Failed: king_audit_logs", { error: errKingAuditLogs.message }); errors.push(`king_audit_logs: ${errKingAuditLogs.message}`); }

    // 14. Delete audit_logs for this tenant
    const { error: errAuditLogs } = await supabaseAdmin.from("audit_logs").delete().eq("tenant_id", tenant_id);
    if (errAuditLogs) { log.error("Failed: audit_logs", { error: errAuditLogs.message }); errors.push(`audit_logs: ${errAuditLogs.message}`); }

    // 15. Delete tenant_security_settings
    const { error: errSecuritySettings } = await supabaseAdmin.from("tenant_security_settings").delete().eq("tenant_id", tenant_id);
    if (errSecuritySettings) { log.error("Failed: tenant_security_settings", { error: errSecuritySettings.message }); errors.push(`tenant_security_settings: ${errSecuritySettings.message}`); }

    // 16. Delete tenant_branding
    const { error: errBranding } = await supabaseAdmin.from("tenant_branding").delete().eq("tenant_id", tenant_id);
    if (errBranding) { log.error("Failed: tenant_branding", { error: errBranding.message }); errors.push(`tenant_branding: ${errBranding.message}`); }

    // 17. Finally delete the tenant
    const { error: deleteError } = await supabaseAdmin
      .from("tenants")
      .delete()
      .eq("id", tenant_id);

    if (deleteError) {
      log.error("Error deleting tenant", { error: deleteError });
      throw deleteError;
    }

    log.info("Successfully deleted tenant", { tenantName: tenant.name, partialErrors: errors.length });

    // Log the deletion in king_audit_logs
    await supabaseAdmin
      .from("king_audit_logs")
      .insert({
        user_id: user.id,
        action: "delete_tenant",
        tenant_name: tenant.name,
        details: {
          tenant_id,
          tenant_slug: tenant.slug,
          deleted_at: new Date().toISOString(),
          cascade_errors: errors.length > 0 ? errors : undefined,
        },
      });

    if (errors.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          partial: true,
          errors,
          message: `Tenant "${tenant.name}" supprimé avec ${errors.length} erreur(s) durant la cascade`
        }),
        {
          status: 207,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Tenant "${tenant.name}" supprimé avec succès`
      }),
      {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
      }
    );

  } catch (error: any) {
    if (error instanceof AuthError) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: error.status, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }
    if (error instanceof IpWhitelistError) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }
    log.error("Error in delete-tenant function", { error: error instanceof Error ? error.message : error });
    return new Response(
      JSON.stringify({
        error: error.message || "Une erreur est survenue lors de la suppression"
      }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
      }
    );
  }
});
