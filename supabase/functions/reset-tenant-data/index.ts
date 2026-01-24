import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResetTenantRequest {
  tenant_id: string;
  confirmation_name: string;
  // Options to selectively reset
  reset_clients?: boolean;      // includes collaborateurs, partenaires
  reset_policies?: boolean;     // contracts
  reset_commissions?: boolean;
  reset_documents?: boolean;
  reset_suivis?: boolean;
  reset_claims?: boolean;
  reset_all?: boolean;          // shortcut for all
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

    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is king
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "king")
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: King role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: ResetTenantRequest = await req.json();
    const { 
      tenant_id, 
      confirmation_name, 
      reset_clients = false,
      reset_policies = false,
      reset_commissions = false,
      reset_documents = false,
      reset_suivis = false,
      reset_claims = false,
      reset_all = false 
    } = body;

    if (!tenant_id || !confirmation_name) {
      return new Response(
        JSON.stringify({ error: "tenant_id and confirmation_name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify tenant exists and name matches
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .select("id, name, slug")
      .eq("id", tenant_id)
      .single();

    if (tenantError || !tenant) {
      return new Response(
        JSON.stringify({ error: "Tenant not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (tenant.name.toLowerCase() !== confirmation_name.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: "Confirmation name does not match tenant name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const deletedCounts: Record<string, number> = {};

    // Helper function to delete and count
    const deleteFromTable = async (table: string, column: string = "tenant_id") => {
      const { data, error } = await supabaseAdmin
        .from(table)
        .delete()
        .eq(column, tenant_id)
        .select("id");
      
      if (error) {
        console.error(`Error deleting from ${table}:`, error);
        throw error;
      }
      
      deletedCounts[table] = data?.length || 0;
      return data?.length || 0;
    };

    // Delete in order respecting FK constraints
    // Commission parts first (depends on commissions)
    if (reset_all || reset_commissions) {
      await deleteFromTable("commission_parts");
      await deleteFromTable("commissions");
    }

    // Claims (depends on policies)
    if (reset_all || reset_claims) {
      await deleteFromTable("claims");
    }

    // Policies
    if (reset_all || reset_policies) {
      await deleteFromTable("policies");
    }

    // Documents
    if (reset_all || reset_documents) {
      // First get document file_keys to delete from storage
      const { data: docs } = await supabaseAdmin
        .from("documents")
        .select("file_key")
        .eq("tenant_id", tenant_id);
      
      // Delete from storage if any
      if (docs && docs.length > 0) {
        const fileKeys = docs.map(d => d.file_key).filter(Boolean);
        if (fileKeys.length > 0) {
          await supabaseAdmin.storage.from("documents").remove(fileKeys);
        }
      }
      
      await deleteFromTable("documents");
    }

    // Suivis
    if (reset_all || reset_suivis) {
      await deleteFromTable("suivis");
    }

    // Family members (depends on clients)
    if (reset_all || reset_clients) {
      await deleteFromTable("family_members");
    }

    // Clients (includes collaborateurs, partenaires based on type_adresse)
    if (reset_all || reset_clients) {
      await deleteFromTable("clients");
    }

    // Notifications
    if (reset_all) {
      await deleteFromTable("notifications");
    }

    // Decomptes
    if (reset_all || reset_commissions) {
      await deleteFromTable("decomptes");
    }

    // Log the action
    await supabaseAdmin.from("king_audit_logs").insert({
      user_id: user.id,
      action: "reset_tenant_data",
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      details: {
        options: { reset_all, reset_clients, reset_policies, reset_commissions, reset_documents, reset_suivis, reset_claims },
        deleted_counts: deletedCounts
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Tenant "${tenant.name}" data has been reset`,
        deleted_counts: deletedCounts
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Reset tenant error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
