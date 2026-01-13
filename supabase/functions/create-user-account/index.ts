import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";
import { encodeHex } from "https://deno.land/std@0.208.0/encoding/hex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Check if a password has been exposed in known data breaches
 * Uses HaveIBeenPwned API with k-anonymity (only first 5 chars of SHA-1 sent)
 */
async function checkPasswordCompromised(password: string): Promise<{ isCompromised: boolean; count: number }> {
  try {
    // Hash the password with SHA-1
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-1", data);
    const hash = encodeHex(new Uint8Array(hashBuffer)).toUpperCase();

    // Use k-anonymity: send only first 5 characters
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    // Query the HaveIBeenPwned API
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        "Add-Padding": "true",
        "User-Agent": "Lovable-Security-Check",
      },
    });

    if (!response.ok) {
      console.warn("HaveIBeenPwned API unavailable:", response.status);
      return { isCompromised: false, count: 0 };
    }

    const text = await response.text();
    const lines = text.split("\n");

    for (const line of lines) {
      const [hashSuffix, countStr] = line.split(":");
      if (hashSuffix?.trim().toUpperCase() === suffix) {
        const count = parseInt(countStr?.trim() || "0", 10);
        return { isCompromised: count > 0, count };
      }
    }

    return { isCompromised: false, count: 0 };
  } catch (err) {
    console.error("Error checking password:", err);
    return { isCompromised: false, count: 0 };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the requesting user is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Non autorisé" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: "Non autorisé" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if requesting user is admin (user can have multiple roles)
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id);

    const isAdmin = roleData?.some(r => r.role === "admin");
    
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Accès refusé. Seuls les administrateurs peuvent créer des comptes." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the requesting user's tenant
    const { data: tenantAssignment } = await supabaseAdmin
      .from("user_tenant_assignments")
      .select("tenant_id")
      .eq("user_id", requestingUser.id)
      .single();

    if (!tenantAssignment) {
      return new Response(
        JSON.stringify({ error: "Utilisateur non assigné à un tenant" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tenantId = tenantAssignment.tenant_id;

    // Parse request body
    const { email, password, role, collaborateurId, clientId, firstName, lastName } = await req.json();

    // Determine if this is a collaborateur or client account creation
    const targetId = collaborateurId || clientId;
    const isClientAccount = !!clientId;

    // Validate inputs
    if (!email || !password || !role || !targetId) {
      return new Response(
        JSON.stringify({ error: "Email, mot de passe, rôle et ID sont requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate role
    const validRoles = ["admin", "manager", "agent", "backoffice", "compta", "client"];
    if (!validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: "Rôle invalide" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if the record exists and doesn't already have a user_id
    let query = supabaseAdmin
      .from("clients")
      .select("id, user_id, first_name, last_name, email")
      .eq("id", targetId);
    
    // Only filter by type_adresse for collaborateurs
    if (!isClientAccount) {
      query = query.eq("type_adresse", "collaborateur");
    }

    const { data: targetRecord, error: targetError } = await query.single();

    if (targetError || !targetRecord) {
      return new Response(
        JSON.stringify({ error: isClientAccount ? "Client non trouvé" : "Collaborateur non trouvé" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (targetRecord.user_id) {
      return new Response(
        JSON.stringify({ error: isClientAccount ? "Ce client a déjà un compte utilisateur" : "Ce collaborateur a déjà un compte utilisateur" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if a user with this email already exists in auth
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

    let userId: string;

    if (existingUser) {
      // User already exists - we'll add the new role and link to the client record
      console.log(`User ${email} already exists with ID ${existingUser.id}, adding role ${role}`);
      userId = existingUser.id;

      // Check if user already has this role
      const { data: existingRole } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", role)
        .maybeSingle();

      if (!existingRole) {
        // Add the new role (user can have multiple roles)
        const { error: roleInsertError } = await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: userId, role });

        if (roleInsertError) {
          console.error("Error adding role:", roleInsertError);
          // Continue anyway - user might already have this role
        }
      }

      // Check if user is already assigned to this tenant
      const { data: existingTenantAssignment } = await supabaseAdmin
        .from("user_tenant_assignments")
        .select("id")
        .eq("user_id", userId)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (!existingTenantAssignment) {
        // Check seat availability only for new tenant assignments
        const { data: tenant } = await supabaseAdmin
          .from("tenants")
          .select("seats_included, extra_users")
          .eq("id", tenantId)
          .single();

        if (tenant) {
          const { count: activeUsersCount } = await supabaseAdmin
            .from("user_tenant_assignments")
            .select("*", { count: "exact", head: true })
            .eq("tenant_id", tenantId);

          const totalSeats = (tenant.seats_included || 1) + (tenant.extra_users || 0);
          const availableSeats = totalSeats - (activeUsersCount || 0);

          if (availableSeats <= 0) {
            return new Response(
              JSON.stringify({ error: "Aucun siège disponible. Veuillez d'abord débloquer un siège supplémentaire." }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        // Assign user to tenant
        const { error: assignmentError } = await supabaseAdmin
          .from("user_tenant_assignments")
          .insert({ user_id: userId, tenant_id: tenantId });

        if (assignmentError) {
          console.error("Error assigning user to tenant:", assignmentError);
        }
      }
    } else {
      // New user - check password and create account
      
      // Get tenant seat information
      const { data: tenant } = await supabaseAdmin
        .from("tenants")
        .select("seats_included, extra_users")
        .eq("id", tenantId)
        .single();

      if (!tenant) {
        return new Response(
          JSON.stringify({ error: "Tenant non trouvé" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Count current active users in tenant
      const { count: activeUsersCount } = await supabaseAdmin
        .from("user_tenant_assignments")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId);

      const totalSeats = (tenant.seats_included || 1) + (tenant.extra_users || 0);
      const availableSeats = totalSeats - (activeUsersCount || 0);

      if (availableSeats <= 0) {
        return new Response(
          JSON.stringify({ error: "Aucun siège disponible. Veuillez d'abord débloquer un siège supplémentaire." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if password has been compromised (HaveIBeenPwned)
      const { isCompromised, count } = await checkPasswordCompromised(password);
      if (isCompromised) {
        console.warn(`Password found in ${count} data breaches`);
        return new Response(
          JSON.stringify({ 
            error: `Ce mot de passe a été exposé dans ${count.toLocaleString()} fuites de données. Veuillez en choisir un autre plus sécurisé.`,
            code: "PASSWORD_COMPROMISED"
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create the auth user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          first_name: firstName || targetRecord.first_name,
          last_name: lastName || targetRecord.last_name,
        },
      });

      if (createError) {
        console.error("Error creating user:", createError);
        return new Response(
          JSON.stringify({ error: createError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = newUser.user.id;

      // Update the user_roles table (the trigger creates a default 'client' role, so we update it)
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .update({ role })
        .eq("user_id", userId);

      if (roleError) {
        console.error("Error updating role:", roleError);
        // If role update fails, try to insert
        await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: userId, role }, { onConflict: "user_id" });
      }

      // Assign user to the same tenant
      const { error: assignmentError } = await supabaseAdmin
        .from("user_tenant_assignments")
        .insert({ user_id: userId, tenant_id: tenantId });

      if (assignmentError) {
        console.error("Error assigning user to tenant:", assignmentError);
        // This is not critical, continue
      }
    }

    // Link the user to the client/collaborateur record
    const { error: linkError } = await supabaseAdmin
      .from("clients")
      .update({ user_id: userId })
      .eq("id", targetId);

    if (linkError) {
      console.error("Error linking record:", linkError);
      return new Response(
        JSON.stringify({ error: "Compte créé mais erreur lors de la liaison" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const wasExisting = !!existingUser;
    console.log(`User account ${wasExisting ? 'linked' : 'created'} successfully: ${email} with role ${role}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId,
        wasExisting,
        message: wasExisting 
          ? `L'utilisateur existant ${email} a été lié avec le rôle ${role}` 
          : `Compte créé pour ${email} avec le rôle ${role}` 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Erreur serveur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
