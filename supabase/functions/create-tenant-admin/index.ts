import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateTenantAdminRequest {
  tenant_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  language?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the caller is a KING user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callerUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !callerUser) {
      throw new Error("Invalid authentication token");
    }

    // Check if caller has KING role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id)
      .single();

    if (roleError || roleData?.role !== "king") {
      throw new Error("Unauthorized: Only KING users can create tenant admins");
    }

    // Parse request body
    const { tenant_id, email, first_name, last_name, phone, language }: CreateTenantAdminRequest = await req.json();

    // Validate required fields
    if (!tenant_id || !email || !first_name || !last_name) {
      throw new Error("Missing required fields: tenant_id, email, first_name, last_name");
    }

    // Verify tenant exists
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .select("id, name, slug")
      .eq("id", tenant_id)
      .single();

    if (tenantError || !tenant) {
      throw new Error("Tenant not found");
    }

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    let userId: string;
    let isNewUser = false;

    if (existingUser) {
      // User already exists - link them to the tenant
      console.log("User already exists, linking to tenant:", existingUser.id);
      userId = existingUser.id;

      // Check if user is already assigned to this tenant
      const { data: existingAssignment } = await supabaseAdmin
        .from("user_tenant_assignments")
        .select("id")
        .eq("user_id", userId)
        .eq("tenant_id", tenant_id)
        .maybeSingle();

      if (existingAssignment) {
        return new Response(
          JSON.stringify({
            success: true,
            user_id: userId,
            email,
            tenant_id,
            already_assigned: true,
            message: "L'utilisateur était déjà assigné à ce tenant.",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      // Update user role to admin if they're just a client
      const { data: currentRole } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (currentRole?.role === "client") {
        await supabaseAdmin
          .from("user_roles")
          .update({ role: "admin" })
          .eq("user_id", userId);
        console.log("Upgraded user role from client to admin");
      }

    } else {
      // Create new user
      isNewUser = true;
      const tempPassword = crypto.randomUUID().slice(0, 16) + "Aa1!";

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          first_name,
          last_name,
          phone,
          language: language || "fr",
          tenant_id,
          tenant_name: tenant.name,
        },
      });

      if (createError) {
        throw createError;
      }

      if (!newUser.user) {
        throw new Error("Failed to create user");
      }

      userId = newUser.user.id;

      // Assign 'admin' role to the new user
      await supabaseAdmin
        .from("user_roles")
        .insert({
          user_id: userId,
          role: "admin",
        });

      // Create profile for the user
      await supabaseAdmin
        .from("profiles")
        .upsert({
          id: userId,
          email,
          first_name,
          last_name,
          phone,
        });

      // Send password reset email so admin can set their own password
      await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: {
          redirectTo: `https://${tenant.slug}.lyta.ch/reset-password`,
        },
      });

      console.log("New admin user created:", userId);
    }

    // Create tenant assignment
    const { error: assignmentError } = await supabaseAdmin
      .from("user_tenant_assignments")
      .insert({
        user_id: userId,
        tenant_id: tenant_id,
        is_platform_admin: false,
      });

    if (assignmentError) {
      console.error("Error creating tenant assignment:", assignmentError);
    }

    console.log("Admin user linked to tenant successfully:", {
      userId,
      email,
      tenantId: tenant_id,
      tenantName: tenant.name,
      isNewUser,
    });

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        email,
        tenant_id,
        is_new_user: isNewUser,
        message: isNewUser 
          ? "Admin créé avec succès. Un email d'invitation a été envoyé."
          : "Utilisateur existant lié au tenant avec succès.",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in create-tenant-admin:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
