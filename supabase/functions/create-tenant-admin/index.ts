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

// Default roles configuration for new tenants
const DEFAULT_ROLES = [
  {
    name: 'Admin Cabinet',
    description: 'Accès complet à toutes les fonctionnalités',
    dashboard_scope: 'global',
    is_system_role: true,
    can_see_own_commissions: true,
    can_see_team_commissions: true,
    can_see_all_commissions: true,
    permissions: [
      { module: 'clients', action: 'view' },
      { module: 'clients', action: 'create' },
      { module: 'clients', action: 'update' },
      { module: 'clients', action: 'delete' },
      { module: 'clients', action: 'export' },
      { module: 'contracts', action: 'view' },
      { module: 'contracts', action: 'deposit' },
      { module: 'contracts', action: 'update' },
      { module: 'contracts', action: 'cancel' },
      { module: 'contracts', action: 'export' },
      { module: 'partners', action: 'view' },
      { module: 'partners', action: 'create' },
      { module: 'partners', action: 'update' },
      { module: 'partners', action: 'delete' },
      { module: 'products', action: 'view' },
      { module: 'products', action: 'create' },
      { module: 'products', action: 'update' },
      { module: 'products', action: 'delete' },
      { module: 'collaborators', action: 'view' },
      { module: 'collaborators', action: 'create' },
      { module: 'collaborators', action: 'update' },
      { module: 'collaborators', action: 'delete' },
      { module: 'collaborators', action: 'export' },
      { module: 'commissions', action: 'view' },
      { module: 'commissions', action: 'modify_rules' },
      { module: 'commissions', action: 'export' },
      { module: 'decomptes', action: 'view' },
      { module: 'decomptes', action: 'generate' },
      { module: 'decomptes', action: 'export' },
      { module: 'payout', action: 'view' },
      { module: 'payout', action: 'generate' },
      { module: 'payout', action: 'validate' },
      { module: 'payout', action: 'export' },
      { module: 'dashboard', action: 'view' },
      { module: 'settings', action: 'view' },
      { module: 'settings', action: 'update' },
    ],
  },
  {
    name: 'Manager',
    description: 'Accès équipe + clients personnels, dashboard équipe',
    dashboard_scope: 'team',
    is_system_role: true,
    can_see_own_commissions: true,
    can_see_team_commissions: true,
    can_see_all_commissions: false,
    permissions: [
      { module: 'clients', action: 'view' },
      { module: 'clients', action: 'create' },
      { module: 'clients', action: 'update' },
      { module: 'clients', action: 'export' },
      { module: 'contracts', action: 'view' },
      { module: 'contracts', action: 'deposit' },
      { module: 'contracts', action: 'update' },
      { module: 'contracts', action: 'export' },
      { module: 'collaborators', action: 'view' },
      { module: 'commissions', action: 'view' },
      { module: 'decomptes', action: 'view' },
      { module: 'dashboard', action: 'view' },
      { module: 'settings', action: 'view' },
    ],
  },
  {
    name: 'Agent',
    description: 'Accès uniquement à ses clients et contrats',
    dashboard_scope: 'personal',
    is_system_role: true,
    can_see_own_commissions: true,
    can_see_team_commissions: false,
    can_see_all_commissions: false,
    permissions: [
      { module: 'clients', action: 'view' },
      { module: 'clients', action: 'create' },
      { module: 'clients', action: 'update' },
      { module: 'contracts', action: 'view' },
      { module: 'contracts', action: 'deposit' },
      { module: 'commissions', action: 'view' },
      { module: 'dashboard', action: 'view' },
    ],
  },
  {
    name: 'Back-office',
    description: 'Voit tous les clients et contrats, aucun accès finance',
    dashboard_scope: 'global',
    is_system_role: true,
    can_see_own_commissions: false,
    can_see_team_commissions: false,
    can_see_all_commissions: false,
    permissions: [
      { module: 'clients', action: 'view' },
      { module: 'clients', action: 'create' },
      { module: 'clients', action: 'update' },
      { module: 'clients', action: 'export' },
      { module: 'contracts', action: 'view' },
      { module: 'contracts', action: 'deposit' },
      { module: 'contracts', action: 'update' },
      { module: 'contracts', action: 'export' },
      { module: 'partners', action: 'view' },
      { module: 'products', action: 'view' },
      { module: 'collaborators', action: 'view' },
      { module: 'dashboard', action: 'view' },
      { module: 'settings', action: 'view' },
    ],
  },
];

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

    console.log("Processing tenant admin creation for:", tenant.name);

    // ============================================
    // STEP 1: Initialize default roles for tenant
    // ============================================
    const { data: existingRoles } = await supabaseAdmin
      .from("tenant_roles")
      .select("id, name")
      .eq("tenant_id", tenant_id)
      .limit(1);

    let adminRoleId: string | null = null;

    if (!existingRoles || existingRoles.length === 0) {
      console.log("Initializing default roles for tenant:", tenant_id);
      
      for (const roleConfig of DEFAULT_ROLES) {
        const { data: newRole, error: roleError } = await supabaseAdmin
          .from("tenant_roles")
          .insert({
            tenant_id: tenant_id,
            name: roleConfig.name,
            description: roleConfig.description,
            is_system_role: roleConfig.is_system_role,
            dashboard_scope: roleConfig.dashboard_scope,
            can_see_own_commissions: roleConfig.can_see_own_commissions,
            can_see_team_commissions: roleConfig.can_see_team_commissions,
            can_see_all_commissions: roleConfig.can_see_all_commissions,
          })
          .select()
          .single();

        if (roleError) {
          console.error("Error creating role:", roleConfig.name, roleError);
          continue;
        }

        console.log("Created role:", roleConfig.name, "with ID:", newRole.id);

        // Store Admin Cabinet role ID for later
        if (roleConfig.name === 'Admin Cabinet') {
          adminRoleId = newRole.id;
        }

        // Create permissions for this role
        for (const perm of roleConfig.permissions) {
          await supabaseAdmin
            .from("tenant_role_permissions")
            .insert({
              role_id: newRole.id,
              module: perm.module,
              action: perm.action,
              allowed: true,
            });
        }
      }
      
      console.log("Default roles initialized successfully");
    } else {
      // Get Admin Cabinet role ID from existing roles
      const { data: adminRole } = await supabaseAdmin
        .from("tenant_roles")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("name", "Admin Cabinet")
        .single();
      
      if (adminRole) {
        adminRoleId = adminRole.id;
      }
    }

    // ============================================
    // STEP 2: Create or link user
    // ============================================
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

      // Update profile with tenant info
      await supabaseAdmin
        .from("profiles")
        .update({
          first_name: first_name || existingUser.user_metadata?.first_name,
          last_name: last_name || existingUser.user_metadata?.last_name,
          phone: phone || existingUser.user_metadata?.phone,
        })
        .eq("id", userId);

      // Send password reset email for existing users too
      const { error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: {
          redirectTo: `https://${tenant.slug}.lyta.ch/reset-password`,
        },
      });

      if (linkError) {
        console.error("Error generating password reset link for existing user:", linkError);
      } else {
        console.log("Password reset link sent to existing user:", email);
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
        .upsert({
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
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: {
          redirectTo: `https://${tenant.slug}.lyta.ch/reset-password`,
        },
      });

      if (linkError) {
        console.error("Error generating password reset link:", linkError);
      } else {
        console.log("Password reset link generated for:", email);
      }

      console.log("New admin user created:", userId);
    }

    // ============================================
    // STEP 3: Create tenant assignment
    // ============================================
    const { error: assignmentError } = await supabaseAdmin
      .from("user_tenant_assignments")
      .upsert({
        user_id: userId,
        tenant_id: tenant_id,
        is_platform_admin: false,
      }, {
        onConflict: 'user_id,tenant_id'
      });

    if (assignmentError) {
      console.error("Error creating tenant assignment:", assignmentError);
    }

    // ============================================
    // STEP 4: Assign Admin Cabinet role to user
    // ============================================
    if (adminRoleId) {
      const { error: roleAssignError } = await supabaseAdmin
        .from("user_tenant_roles")
        .upsert({
          user_id: userId,
          tenant_id: tenant_id,
          role_id: adminRoleId,
          assigned_by: callerUser.id,
        }, {
          onConflict: 'user_id,role_id,tenant_id'
        });

      if (roleAssignError) {
        console.error("Error assigning Admin role to user:", roleAssignError);
      } else {
        console.log("Assigned Admin Cabinet role to user:", userId);
      }
    }

    console.log("Admin user linked to tenant successfully:", {
      userId,
      email,
      tenantId: tenant_id,
      tenantName: tenant.name,
      isNewUser,
      adminRoleId,
    });

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        email,
        tenant_id,
        is_new_user: isNewUser,
        roles_initialized: !existingRoles || existingRoles.length === 0,
        admin_role_assigned: !!adminRoleId,
        subdomain: `${tenant.slug}.lyta.ch`,
        message: isNewUser 
          ? `Admin créé avec succès. Un email d'invitation a été envoyé à ${email}. Sous-domaine: ${tenant.slug}.lyta.ch`
          : `Utilisateur existant lié au tenant ${tenant.name} avec succès.`,
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
