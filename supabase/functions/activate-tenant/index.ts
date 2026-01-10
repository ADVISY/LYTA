import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const logStep = (step: string, details?: unknown) => {
  console.log(`[ACTIVATE-TENANT] ${step}`, details ? JSON.stringify(details) : '');
};

async function sendAccessEmail(email: string, tenantName: string, slug: string, resetLink: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Lyta <no-reply@lyta.ch>",
      to: [email],
      subject: `🎉 Bienvenue sur LYTA - Vos accès pour ${tenantName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1a1a2e; margin: 0;">Bienvenue sur LYTA</h1>
            <p style="color: #666; margin: 10px 0;">Votre CRM d'assurance est prêt !</p>
          </div>
          
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 20px;">
            <h2 style="margin: 0 0 15px 0;">${tenantName}</h2>
            <p style="margin: 0; opacity: 0.9;">Votre espace est configuré et prêt à l'emploi.</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 15px 0; color: #333;">📋 Vos informations d'accès</h3>
            <p><strong>URL:</strong> <a href="https://${slug}.lyta.ch" style="color: #667eea;">https://${slug}.lyta.ch</a></p>
            <p><strong>Email:</strong> ${email}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" 
               style="display: inline-block; background: #667eea; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
              Définir mon mot de passe
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">Ce lien est valable 24 heures. Si vous n'avez pas demandé cet accès, ignorez cet email.</p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px; text-align: center;">
            Besoin d'aide ? Contactez-nous à <a href="mailto:support@lyta.ch" style="color: #667eea;">support@lyta.ch</a>
          </p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to send email: ${error}`);
  }

  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify user is KING
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) {
      throw new Error("Auth error: " + (userError?.message || "User not found"));
    }

    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .eq('role', 'king')
      .single();

    if (!roleData) {
      throw new Error("Unauthorized: King role required");
    }

    logStep("King user verified", { userId: userData.user.id });

    // Get request body
    const { tenant_id, admin_email, admin_first_name, admin_last_name, admin_phone } = await req.json();

    if (!tenant_id) {
      throw new Error("tenant_id is required");
    }

    logStep("Activating tenant", { tenant_id });

    // Get tenant info
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .eq('id', tenant_id)
      .single();

    if (tenantError || !tenant) {
      throw new Error("Tenant not found");
    }

    // Check if already activated (idempotent)
    if (tenant.tenant_status === 'active' && tenant.activated_at) {
      logStep("Tenant already activated", { tenant_id });
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Tenant already activated",
        already_activated: true
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const finalAdminEmail = admin_email || tenant.admin_email || tenant.email;
    if (!finalAdminEmail) {
      throw new Error("Admin email is required");
    }

    // Check if admin user already exists
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', finalAdminEmail)
      .single();

    let adminUserId = existingProfile?.id;

    if (!adminUserId) {
      // Create admin user
      const tempPassword = crypto.randomUUID().slice(0, 16) + "Aa1!";
      
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: finalAdminEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          first_name: admin_first_name || tenant.contact_name?.split(' ')[0] || '',
          last_name: admin_last_name || tenant.contact_name?.split(' ').slice(1).join(' ') || '',
        }
      });

      if (createError) {
        throw new Error("Failed to create admin user: " + createError.message);
      }

      adminUserId = newUser.user.id;
      logStep("Admin user created", { userId: adminUserId });

      // Update profile
      await supabaseAdmin
        .from('profiles')
        .update({
          first_name: admin_first_name || tenant.contact_name?.split(' ')[0] || null,
          last_name: admin_last_name || tenant.contact_name?.split(' ').slice(1).join(' ') || null,
          phone: admin_phone || tenant.phone || null,
        })
        .eq('id', adminUserId);

      // Assign admin role
      await supabaseAdmin
        .from('user_roles')
        .upsert({
          user_id: adminUserId,
          role: 'admin',
        }, { onConflict: 'user_id, role' });
    }

    // Assign user to tenant
    await supabaseAdmin
      .from('user_tenant_assignments')
      .upsert({
        user_id: adminUserId,
        tenant_id: tenant_id,
      }, { onConflict: 'user_id' });

    // Update tenant status
    await supabaseAdmin
      .from('tenants')
      .update({
        status: 'active',
        tenant_status: 'active',
        activated_at: new Date().toISOString(),
        activated_by: userData.user.id,
        admin_email: finalAdminEmail,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenant_id);

    logStep("Tenant status updated to active");

    // Generate password reset link
    const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: finalAdminEmail,
      options: {
        redirectTo: `https://app.lyta.ch/reset-password`,
      }
    });

    if (resetError) {
      logStep("Warning: Could not generate reset link", { error: resetError.message });
    }

    // Send access email
    if (resetData?.properties?.action_link) {
      try {
        await sendAccessEmail(
          finalAdminEmail,
          tenant.name,
          tenant.slug,
          resetData.properties.action_link
        );
        logStep("Access email sent", { email: finalAdminEmail });
      } catch (emailError) {
        logStep("Warning: Failed to send email", { error: emailError });
        // Don't fail the whole process
      }
    }

    // Log the action
    await supabaseAdmin
      .from('king_audit_logs')
      .insert({
        user_id: userData.user.id,
        action: 'tenant_activated',
        tenant_id: tenant_id,
        tenant_name: tenant.name,
        details: {
          admin_email: finalAdminEmail,
          plan: tenant.plan,
        }
      });

    // Create success notification
    await supabaseAdmin
      .from('king_notifications')
      .insert({
        title: '🎉 Tenant activé',
        message: `${tenant.name} a été activé avec succès`,
        kind: 'tenant_activated',
        priority: 'normal',
        tenant_id: tenant_id,
        tenant_name: tenant.name,
        action_url: `/king/tenants/${tenant_id}`,
        action_label: 'Voir le tenant',
        metadata: {
          admin_email: finalAdminEmail,
        }
      });

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Tenant activated successfully",
      admin_user_id: adminUserId,
      reset_link_sent: !!resetData?.properties?.action_link,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
