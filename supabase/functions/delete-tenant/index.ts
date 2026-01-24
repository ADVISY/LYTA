import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DeleteTenantRequest {
  tenant_id: string;
  confirmation_name: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify caller is king
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Non autorisé" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Token invalide" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { tenant_id, confirmation_name }: DeleteTenantRequest = await req.json();

    if (!tenant_id || !confirmation_name) {
      return new Response(
        JSON.stringify({ error: "tenant_id et confirmation_name sont requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify confirmation matches tenant name
    if (confirmation_name.toLowerCase() !== tenant.name.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: "Le nom de confirmation ne correspond pas" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Starting deletion of tenant: ${tenant.name} (${tenant_id})`);

    // Delete in order to respect foreign key constraints
    // 1. Delete user_tenant_roles
    await supabaseAdmin
      .from("user_tenant_roles")
      .delete()
      .eq("tenant_id", tenant_id);

    // 2. Delete user_tenant_assignments
    await supabaseAdmin
      .from("user_tenant_assignments")
      .delete()
      .eq("tenant_id", tenant_id);

    // 3. Delete tenant_roles (will cascade to tenant_role_permissions)
    await supabaseAdmin
      .from("tenant_roles")
      .delete()
      .eq("tenant_id", tenant_id);

    // 4. Delete claims
    await supabaseAdmin
      .from("claims")
      .delete()
      .eq("tenant_id", tenant_id);

    // 5. Delete commissions
    await supabaseAdmin
      .from("commissions")
      .delete()
      .eq("tenant_id", tenant_id);

    // 6. Delete policies
    await supabaseAdmin
      .from("policies")
      .delete()
      .eq("tenant_id", tenant_id);

    // 7. Delete documents
    await supabaseAdmin
      .from("documents")
      .delete()
      .eq("tenant_id", tenant_id);

    // 8. Delete clients
    await supabaseAdmin
      .from("clients")
      .delete()
      .eq("tenant_id", tenant_id);

    // 9. Delete notifications
    await supabaseAdmin
      .from("notifications")
      .delete()
      .eq("tenant_id", tenant_id);

    // 10. Delete suivis
    await supabaseAdmin
      .from("suivis")
      .delete()
      .eq("tenant_id", tenant_id);

    // 11. Delete decomptes
    await supabaseAdmin
      .from("decomptes")
      .delete()
      .eq("tenant_id", tenant_id);

    // 12. Delete king_notifications for this tenant
    await supabaseAdmin
      .from("king_notifications")
      .delete()
      .eq("tenant_id", tenant_id);

    // 13. Delete king_audit_logs for this tenant
    await supabaseAdmin
      .from("king_audit_logs")
      .delete()
      .eq("tenant_id", tenant_id);

    // 14. Delete audit_logs for this tenant
    await supabaseAdmin
      .from("audit_logs")
      .delete()
      .eq("tenant_id", tenant_id);

    // 15. Delete tenant_security_settings
    await supabaseAdmin
      .from("tenant_security_settings")
      .delete()
      .eq("tenant_id", tenant_id);

    // 16. Delete tenant_branding
    await supabaseAdmin
      .from("tenant_branding")
      .delete()
      .eq("tenant_id", tenant_id);

    // 17. Finally delete the tenant
    const { error: deleteError } = await supabaseAdmin
      .from("tenants")
      .delete()
      .eq("id", tenant_id);

    if (deleteError) {
      console.error("Error deleting tenant:", deleteError);
      throw deleteError;
    }

    console.log(`Successfully deleted tenant: ${tenant.name}`);

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
        },
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Tenant "${tenant.name}" supprimé avec succès` 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error: any) {
    console.error("Error in delete-tenant function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Une erreur est survenue lors de la suppression" 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
