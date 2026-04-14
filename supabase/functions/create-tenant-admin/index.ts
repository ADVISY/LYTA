import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAuth, AuthError } from "../_shared/auth.ts";
import { checkKingIpWhitelist, IpWhitelistError } from "../_shared/ip-whitelist.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("create-tenant-admin");

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

interface CreateTenantAdminRequest {
  tenant_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  language?: string;
}

interface TenantBranding {
  display_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  email_sender_name: string | null;
  email_sender_address: string | null;
}

function getTenantResetRedirectUrl(slug: string | null): string {
  return slug ? `https://${slug}.lyta.ch/reset-password?space=team` : "https://app.lyta.ch/reset-password?space=team";
}

function buildRecoveryLink(redirectTo: string, linkData: any): string | null {
  const actionLink = linkData?.properties?.action_link;
  let hashedToken = linkData?.properties?.hashed_token;

  if (!hashedToken && actionLink) {
    try {
      hashedToken = new URL(actionLink).searchParams.get("token");
    } catch {
      hashedToken = null;
    }
  }

  if (hashedToken) {
    const url = new URL(redirectTo);
    url.searchParams.set("token_hash", hashedToken);
    url.searchParams.set("type", "recovery");
    return url.toString();
  }

  return actionLink ?? null;
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

// Generate welcome email HTML for new tenant admin
function generateAdminWelcomeEmail(
  adminName: string,
  tenantName: string,
  subdomain: string,
  resetLink: string,
  branding: TenantBranding | null
): { subject: string; html: string } {
  const displayName = branding?.display_name || tenantName;
  const primaryColor = branding?.primary_color || '#0066FF';
  const logoUrl = branding?.logo_url || '';

  const logoHtml = logoUrl 
    ? `<img src="${logoUrl}" alt="${displayName}" style="height: 50px; max-width: 180px; object-fit: contain;" />`
    : `<div style="font-size: 42px; font-weight: 700; color: #ffffff; letter-spacing: -1px;">${displayName}</div>`;

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenue sur Lyta</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1a1a2e;
      margin: 0;
      padding: 0;
      background-color: #f0f2f5;
    }
    
    .email-wrapper {
      max-width: 600px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    
    .email-container {
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
      overflow: hidden;
    }
    
    .header {
      background: linear-gradient(135deg, ${primaryColor} 0%, #4F46E5 50%, #7C3AED 100%);
      padding: 50px 40px 60px;
      text-align: center;
      position: relative;
    }
    
    .header::after {
      content: '';
      position: absolute;
      bottom: -1px;
      left: 0;
      right: 0;
      height: 30px;
      background: #ffffff;
      border-radius: 30px 30px 0 0;
    }
    
    .header-title {
      color: #ffffff;
      font-size: 28px;
      font-weight: 700;
      margin: 24px 0 8px;
    }
    
    .header-subtitle {
      color: rgba(255, 255, 255, 0.9);
      font-size: 16px;
      margin: 0;
    }
    
    .content {
      padding: 30px 40px 40px;
    }
    
    .greeting {
      font-size: 22px;
      font-weight: 600;
      color: ${primaryColor};
      margin-bottom: 24px;
    }
    
    .text {
      color: #4a4a68;
      font-size: 15px;
      margin-bottom: 16px;
      line-height: 1.7;
    }
    
    .info-box {
      background: linear-gradient(135deg, #f0f4ff 0%, #e8f0fe 100%);
      border-left: 4px solid ${primaryColor};
      padding: 24px;
      margin: 28px 0;
      border-radius: 0 12px 12px 0;
    }
    
    .info-box h3 {
      margin: 0 0 16px;
      color: ${primaryColor};
      font-size: 16px;
      font-weight: 600;
    }
    
    .info-item {
      display: flex;
      margin: 12px 0;
    }
    
    .info-label {
      font-weight: 600;
      color: #374151;
      min-width: 140px;
    }
    
    .info-value {
      color: #4a4a68;
    }
    
    .cta-container {
      text-align: center;
      margin: 36px 0;
    }
    
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, ${primaryColor} 0%, #4F46E5 100%);
      color: #ffffff !important;
      padding: 18px 48px;
      text-decoration: none;
      border-radius: 50px;
      font-weight: 600;
      font-size: 16px;
      box-shadow: 0 4px 14px rgba(0, 102, 255, 0.35);
    }
    
    .warning-box {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border: 2px solid #f59e0b;
      padding: 20px 24px;
      border-radius: 12px;
      margin: 24px 0;
    }
    
    .warning-box p {
      margin: 0;
      color: #92400e;
      font-size: 14px;
    }
    
    .features-list {
      list-style: none;
      padding: 0;
      margin: 24px 0;
    }
    
    .features-list li {
      padding: 12px 0 12px 36px;
      position: relative;
      color: #4a4a68;
      font-size: 15px;
    }
    
    .features-list li::before {
      content: '✓';
      position: absolute;
      left: 0;
      color: #10b981;
      font-weight: 700;
      font-size: 18px;
    }
    
    .signature {
      margin-top: 40px;
      padding-top: 24px;
      border-top: 1px solid #e5e7eb;
    }
    
    .footer {
      background: #f8fafc;
      padding: 28px 40px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    
    .footer-text {
      color: #6b7280;
      font-size: 12px;
      margin: 8px 0;
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="header">
        ${logoHtml}
        <h1 class="header-title">Bienvenue sur Lyta ! 🎉</h1>
        <p class="header-subtitle">Votre plateforme CRM est prête</p>
      </div>
      <div class="content">
        <p class="greeting">Bonjour ${adminName} 👋</p>
        <p class="text">
          Félicitations ! Votre espace <strong>${tenantName}</strong> a été créé avec succès sur la plateforme Lyta. 
          Vous êtes désormais administrateur et pouvez commencer à configurer votre cabinet.
        </p>
        
        <div class="info-box">
          <h3>📋 Informations de votre espace</h3>
          <div class="info-item">
            <span class="info-label">Cabinet :</span>
            <span class="info-value">${tenantName}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Adresse URL :</span>
            <span class="info-value">https://${subdomain}.lyta.ch</span>
          </div>
          <div class="info-item">
            <span class="info-label">Rôle :</span>
            <span class="info-value">Administrateur</span>
          </div>
        </div>
        
        <p class="text">
          Pour accéder à votre espace et commencer la configuration, veuillez d'abord créer votre mot de passe personnel :
        </p>
        
        <div class="cta-container">
          <a href="${resetLink}" class="cta-button">
            Créer mon mot de passe →
          </a>
        </div>
        
        <div class="warning-box">
          <p>⏰ Ce lien expire dans 24 heures. Si vous n'avez pas demandé la création de ce compte, contactez-nous immédiatement.</p>
        </div>
        
        <p class="text">En tant qu'administrateur, vous pourrez :</p>
        <ul class="features-list">
          <li>Gérer vos clients et leurs contrats d'assurance</li>
          <li>Superviser vos collaborateurs et leurs performances</li>
          <li>Suivre les commissions et générer des rapports</li>
          <li>Personnaliser le branding de votre espace client</li>
          <li>Configurer les automatisations email et SMS</li>
        </ul>
        
        <div class="signature">
          <p class="text">
            Nous sommes ravis de vous avoir parmi nous !<br>
            <strong>L'équipe Lyta</strong>
          </p>
        </div>
      </div>
      <div class="footer">
        <p class="footer-text">© ${new Date().getFullYear()} Lyta. Tous droits réservés.</p>
        <p class="footer-text">
          Cet email a été envoyé automatiquement. Pour toute question, contactez 
          <a href="mailto:support@lyta.ch" style="color: ${primaryColor};">support@lyta.ch</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>
`;

  return {
    subject: `🎉 Bienvenue sur Lyta - ${tenantName} est prêt !`,
    html
  };
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Verify caller identity via shared auth
    const { user: callerUser } = await requireAuth(req);
    await checkKingIpWhitelist(req);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

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

    // Verify tenant exists and get branding
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .select(`
        id, 
        name, 
        slug,
        tenant_branding (
          display_name,
          logo_url,
          primary_color,
          email_sender_name,
          email_sender_address
        )
      `)
      .eq("id", tenant_id)
      .single();

    if (tenantError || !tenant) {
      throw new Error("Tenant not found");
    }

    const branding: TenantBranding | null = tenant.tenant_branding?.[0] || null;
    const adminName = `${first_name} ${last_name}`.trim();

    log.info("Processing tenant admin creation", { tenantName: tenant.name });

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
      log.info("Initializing default roles for tenant", { tenantId: tenant_id });
      
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
          log.error("Error creating role", { roleName: roleConfig.name, error: roleError });
          continue;
        }

        log.info("Created role", { roleName: roleConfig.name, roleId: newRole.id });

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
      
      log.info("Default roles initialized successfully");
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
      log.info("User already exists, linking to tenant", { userId: existingUser.id });
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
            headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
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
        log.info("Upgraded user role from client to admin");
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

      // Generate and send password reset email for existing users
      const resetRedirectUrl = getTenantResetRedirectUrl(tenant.slug);
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: {
          redirectTo: resetRedirectUrl,
        },
      });

      const resetLink = !linkError ? buildRecoveryLink(resetRedirectUrl, linkData) : null;
      if (resetLink && RESEND_API_KEY) {
        const { subject, html } = generateAdminWelcomeEmail(adminName, tenant.name, tenant.slug, resetLink, branding);
        
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Lyta <support@lyta.ch>",
            to: [email],
            subject,
            html,
          }),
        });
        log.info("Welcome email sent to existing user", { email });
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

      // Generate password reset link and send branded welcome email
      const resetRedirectUrl = getTenantResetRedirectUrl(tenant.slug);
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: {
          redirectTo: resetRedirectUrl,
        },
      });

      if (linkError) {
        log.error("Error generating password reset link", { error: linkError });
      } else if (RESEND_API_KEY) {
        const resetLink = buildRecoveryLink(resetRedirectUrl, linkData);
        if (!resetLink) {
          log.error("Error generating password reset link", { error: "Missing recovery link" });
        } else {
          const { subject, html } = generateAdminWelcomeEmail(adminName, tenant.name, tenant.slug, resetLink, branding);
        
          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Lyta <support@lyta.ch>",
              to: [email],
              subject,
              html,
            }),
          });

          if (emailResponse.ok) {
            log.info("Welcome email with password reset link sent", { to: email });
          } else {
            log.error("Failed to send welcome email", { error: await emailResponse.text() });
          }
        }
      }

      log.info("New admin user created", { userId });
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
      log.error("Error creating tenant assignment", { error: assignmentError });
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
        log.error("Error assigning Admin role to user", { error: roleAssignError });
      } else {
        log.info("Assigned Admin Cabinet role to user", { userId });
      }
    }

    log.info("Admin user linked to tenant successfully", {
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
        email_sent: !!RESEND_API_KEY,
        message: isNewUser 
          ? `Admin créé avec succès. Un email d'invitation a été envoyé à ${email}. Sous-domaine: ${tenant.slug}.lyta.ch`
          : `Utilisateur existant lié au tenant ${tenant.name} avec succès. Un email lui a été envoyé.`,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
      }
    );
  } catch (error: any) {
    if (error instanceof AuthError) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: error.status, headers: { "Content-Type": "application/json", ...getCorsHeaders(req) } }
      );
    }
    if (error instanceof IpWhitelistError) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 403, headers: { "Content-Type": "application/json", ...getCorsHeaders(req) } }
      );
    }
    log.error("Error in create-tenant-admin", { error: error.message });
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
      }
    );
  }
});
