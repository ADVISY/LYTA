import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAuth, requireTenantAccess, AuthError } from "../_shared/auth.ts";
import { getSenderAddress } from "../_shared/email-sender.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("create-user-account");

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

interface TenantBranding {
  display_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  email_sender_name: string | null;
  email_sender_address: string | null;
}

interface CreateUserAccountRequest {
  email?: string;
  password?: string;
  role?: string;
  collaborateurId?: string;
  clientId?: string;
  firstName?: string;
  lastName?: string;
  regeneratePassword?: boolean;
  tenantId?: string;
}

interface TenantRecord {
  id: string;
  name: string;
  slug: string | null;
  seats_included: number | null;
  extra_users: number | null;
  tenant_branding?: TenantBranding[] | TenantBranding | null;
}

// Generate a human-readable password
function generateReadablePassword(): string {
  const adjectives = ['Blue', 'Swift', 'Brave', 'Smart', 'Cool', 'Fast', 'Gold', 'Star', 'Mega', 'Super'];
  const nouns = ['Tiger', 'Eagle', 'Lion', 'Wolf', 'Bear', 'Hawk', 'Fox', 'Puma', 'Shark', 'Cobra'];
  const numbers = Math.floor(Math.random() * 900) + 100; // 3-digit number
  const specials = ['!', '@', '#', '$', '&'];
  
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const special = specials[Math.floor(Math.random() * specials.length)];
  
  return `${adj}${noun}${numbers}${special}`;
}

// Generate HTML email for account creation with password
function generateWelcomeEmailWithPassword(
  clientName: string,
  email: string,
  password: string,
  loginUrl: string,
  branding: TenantBranding | null,
  tenantName: string
): { subject: string; html: string } {
  const displayName = branding?.display_name || branding?.email_sender_name || tenantName;
  const primaryColor = branding?.primary_color || '#0066FF';
  const logoUrl = branding?.logo_url || '';

  const logoHtml = logoUrl 
    ? `<img src="${logoUrl}" alt="${displayName}" style="height: 40px; max-width: 160px; object-fit: contain;" />`
    : `<div style="font-size: 36px; font-weight: 700; color: #ffffff; letter-spacing: -1px;">${displayName}<span style="color: #7C3AED;">.</span></div>`;

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Votre compte ${displayName}</title>
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
      padding: 40px 40px 50px;
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
      font-size: 26px;
      font-weight: 700;
      margin: 20px 0 0;
    }
    
    .content {
      padding: 30px 40px 40px;
    }
    
    .greeting {
      font-size: 20px;
      font-weight: 600;
      color: ${primaryColor};
      margin-bottom: 20px;
    }
    
    .text {
      color: #4a4a68;
      font-size: 15px;
      margin-bottom: 16px;
      line-height: 1.7;
    }
    
    .credentials-box {
      background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
      border: 2px solid ${primaryColor};
      padding: 24px;
      border-radius: 12px;
      margin: 24px 0;
    }
    
    .credentials-title {
      font-size: 16px;
      font-weight: 600;
      color: ${primaryColor};
      margin: 0 0 16px 0;
    }
    
    .credential-row {
      display: flex;
      margin-bottom: 12px;
      font-size: 14px;
    }
    
    .credential-label {
      color: #6b7280;
      width: 120px;
      flex-shrink: 0;
    }
    
    .credential-value {
      color: #1a1a2e;
      font-weight: 600;
      font-family: 'Courier New', monospace;
      background: #ffffff;
      padding: 4px 12px;
      border-radius: 6px;
      border: 1px solid #e5e7eb;
    }
    
    .cta-container {
      text-align: center;
      margin: 32px 0;
    }
    
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, ${primaryColor} 0%, #4F46E5 100%);
      color: #ffffff !important;
      padding: 16px 40px;
      text-decoration: none;
      border-radius: 50px;
      font-weight: 600;
      font-size: 15px;
      box-shadow: 0 4px 14px rgba(0, 102, 255, 0.35);
    }
    
    .highlight-box {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border: 2px solid #f59e0b;
      padding: 20px 24px;
      border-radius: 12px;
      margin: 24px 0;
    }
    
    .highlight-box p {
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
      padding: 10px 0 10px 32px;
      position: relative;
      color: #4a4a68;
      font-size: 15px;
    }
    
    .features-list li::before {
      content: '✓';
      position: absolute;
      left: 0;
      color: ${primaryColor};
      font-weight: 700;
    }
    
    .signature {
      margin-top: 36px;
      padding-top: 24px;
      border-top: 1px solid #e5e7eb;
    }
    
    .footer {
      background: #f8fafc;
      padding: 24px 40px;
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
        <h1 class="header-title">Bienvenue !</h1>
      </div>
      <div class="content">
        <p class="greeting">Bonjour ${clientName} 👋</p>
        <p class="text">
          Votre compte ${displayName} a été créé avec succès ! Vous pouvez maintenant accéder à votre espace personnel pour consulter vos contrats et documents d'assurance.
        </p>
        
        <div class="credentials-box">
          <p class="credentials-title">🔐 Vos identifiants de connexion</p>
          <div class="credential-row">
            <span class="credential-label">Email :</span>
            <span class="credential-value">${email}</span>
          </div>
          <div class="credential-row">
            <span class="credential-label">Mot de passe :</span>
            <span class="credential-value">${password}</span>
          </div>
        </div>
        
        <div class="cta-container">
          <a href="${loginUrl}" class="cta-button">
            Me connecter →
          </a>
        </div>
        
        <div class="highlight-box">
          <p>🔒 Nous vous recommandons de modifier votre mot de passe après votre première connexion depuis votre profil.</p>
        </div>
        
        <p class="text">Une fois connecté, vous pourrez :</p>
        <ul class="features-list">
          <li>Consulter tous vos contrats d'assurance</li>
          <li>Télécharger vos documents et attestations</li>
          <li>Contacter votre conseiller dédié</li>
          <li>Suivre vos demandes en cours</li>
        </ul>
        <div class="signature">
          <p class="text">Cordialement,<br><strong>L'équipe ${displayName}</strong></p>
        </div>
      </div>
      <div class="footer">
        <p class="footer-text">© ${new Date().getFullYear()} ${displayName}. Tous droits réservés.</p>
        <p class="footer-text">Cet email a été envoyé automatiquement.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

  return {
    subject: `🔐 Vos identifiants de connexion - ${displayName}`,
    html
  };
}

function getBranding(tenant: TenantRecord): TenantBranding | null {
  if (Array.isArray(tenant.tenant_branding)) {
    return tenant.tenant_branding[0] || null;
  }

  return tenant.tenant_branding || null;
}

function generateAccessEnabledEmail(
  clientName: string,
  loginUrl: string,
  branding: TenantBranding | null,
  tenantName: string,
): { subject: string; html: string } {
  const displayName = branding?.display_name || branding?.email_sender_name || tenantName;
  const primaryColor = branding?.primary_color || "#0066FF";
  const logoUrl = branding?.logo_url || "";
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${displayName}" style="height: 40px; max-width: 160px; object-fit: contain;" />`
    : `<div style="font-size: 36px; font-weight: 700; color: #ffffff;">${displayName}</div>`;

  return {
    subject: `Votre acces ${displayName} est active`,
    html: `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Acces active - ${displayName}</title>
</head>
<body style="font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif; background-color: #f0f2f5; margin: 0; padding: 40px 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
    <div style="background: linear-gradient(135deg, ${primaryColor} 0%, #4F46E5 100%); padding: 40px; text-align: center;">
      ${logoHtml}
      <h1 style="color: #fff; font-size: 26px; margin: 20px 0 0;">Acces active</h1>
    </div>
    <div style="padding: 30px 40px;">
      <p style="font-size: 20px; font-weight: 600; color: ${primaryColor};">Bonjour ${clientName}</p>
      <p style="color: #4a4a68; font-size: 15px; line-height: 1.7;">
        Votre espace client ${displayName} est maintenant accessible. Connectez-vous avec vos identifiants habituels.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${loginUrl}" style="display: inline-block; background: ${primaryColor}; color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600;">
          Me connecter
        </a>
      </div>
      <p style="color: #4a4a68; font-size: 15px;">Cordialement,<br><strong>L'equipe ${displayName}</strong></p>
    </div>
  </div>
</body>
</html>`,
  };
}

async function resolveTenantId(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  requestedTenantId?: string,
): Promise<string> {
  if (requestedTenantId) {
    await requireTenantAccess(userId, requestedTenantId);
    return requestedTenantId;
  }

  const { data: assignment } = await supabaseAdmin
    .from("user_tenant_assignments")
    .select("tenant_id")
    .eq("user_id", userId)
    .not("tenant_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (!assignment?.tenant_id) {
    throw new AuthError("Utilisateur non assigne a un tenant", 400);
  }

  return assignment.tenant_id;
}

async function canCreateAccount(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  tenantId: string,
  isClientAccount: boolean,
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

  const allowedModules = isClientAccount ? ["clients", "settings"] : ["settings"];
  const { data: permissions } = await supabaseAdmin
    .from("tenant_role_permissions")
    .select("role_id")
    .in("role_id", activeRoleIds)
    .in("module", allowedModules)
    .eq("action", "update")
    .eq("allowed", true)
    .limit(1);

  return (permissions?.length ?? 0) > 0;
}

async function assertSeatAvailable(
  supabaseAdmin: ReturnType<typeof createClient>,
  tenantId: string,
  tenant: TenantRecord,
): Promise<void> {
  const { data: tenantAssignments, error: assignmentsError } = await supabaseAdmin
    .from("user_tenant_assignments")
    .select("user_id")
    .eq("tenant_id", tenantId);

  if (assignmentsError) {
    throw new AuthError(`Erreur lors du controle des sieges: ${assignmentsError.message}`, 500);
  }

  const assignedUserIds = (tenantAssignments ?? [])
    .map(({ user_id }) => user_id)
    .filter(Boolean);

  let billableUsersCount = 0;
  if (assignedUserIds.length > 0) {
    const { data: billableRoles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .in("user_id", assignedUserIds)
      .neq("role", "client");

    if (rolesError) {
      throw new AuthError(`Erreur lors du controle des roles: ${rolesError.message}`, 500);
    }

    billableUsersCount = new Set((billableRoles ?? []).map(({ user_id }) => user_id)).size;
  }

  const totalSeats = (tenant.seats_included || 1) + (tenant.extra_users || 0);
  const availableSeats = totalSeats - billableUsersCount;

  if (availableSeats <= 0) {
    throw new AuthError("Aucun siege disponible. Debloquez un siege supplementaire.", 400);
  }
}

async function ensureTenantAssignment(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  tenantId: string,
  tenant: TenantRecord,
  consumesSeat: boolean,
): Promise<void> {
  const { data: existingTenantAssignment } = await supabaseAdmin
    .from("user_tenant_assignments")
    .select("id")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (existingTenantAssignment) {
    return;
  }

  if (consumesSeat) {
    await assertSeatAvailable(supabaseAdmin, tenantId, tenant);
  }

  const { error } = await supabaseAdmin
    .from("user_tenant_assignments")
    .upsert({ user_id: userId, tenant_id: tenantId }, { onConflict: "user_id,tenant_id" });

  if (error) {
    throw new AuthError(`Erreur lors de l'assignation au tenant: ${error.message}`, 500);
  }
}

async function ensureUserRole(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  role: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });

  if (error) {
    throw new AuthError(`Erreur lors de l'attribution du role: ${error.message}`, 500);
  }
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Verify caller identity via shared auth
    const { user: requestingUser } = await requireAuth(req);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    let requestBody: CreateUserAccountRequest;
    try {
      requestBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Corps de la requete invalide (JSON attendu)" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const { email, role, collaborateurId, clientId, firstName, lastName, regeneratePassword, tenantId: requestedTenantId } = requestBody;
    const targetId = collaborateurId || clientId;
    const isClientAccount = !!clientId;

    const tenantId = await resolveTenantId(supabaseAdmin, requestingUser.id, requestedTenantId);
    const authorized = await canCreateAccount(supabaseAdmin, requestingUser.id, tenantId, isClientAccount);
    
    if (!authorized) {
      throw new AuthError("Acces refuse. Droits insuffisants pour creer ce compte.", 403);
    }

    // Get tenant info and branding for email
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select(`
        id,
        name,
        slug,
        seats_included,
        extra_users,
        tenant_branding (
          display_name,
          logo_url,
          primary_color,
          email_sender_name,
          email_sender_address
        )
      `)
      .eq("id", tenantId)
      .single();

    if (!tenant) {
      return new Response(
        JSON.stringify({ error: "Tenant non trouvé" }),
        { status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const branding: TenantBranding | null = getBranding(tenant as TenantRecord);

    // Validate inputs
    if (!email || !role || !targetId) {
      return new Response(
        JSON.stringify({ error: "Email, rôle et ID sont requis" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Format d'email invalide" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Validate role
    const validRoles = ["admin", "manager", "agent", "backoffice", "compta", "client"];
    if (!validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: "Rôle invalide" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Check if the record exists AND belongs to the admin's tenant
    let query = supabaseAdmin
      .from("clients")
      .select("id, user_id, first_name, last_name, email")
      .eq("id", targetId)
      .eq("tenant_id", tenantId);

    // Only filter by type_adresse for collaborateurs
    if (!isClientAccount) {
      query = query.eq("type_adresse", "collaborateur");
    }

    const { data: targetRecord, error: targetError } = await query.single();

    if (targetError || !targetRecord) {
      return new Response(
        JSON.stringify({ error: isClientAccount ? "Client non trouvé" : "Collaborateur non trouvé" }),
        { status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    if (!RESEND_API_KEY) {
      throw new AuthError("Configuration email manquante: RESEND_API_KEY n'est pas defini.", 500);
    }

    // If regeneratePassword is true and user already has an account, regenerate and send new password
    if (regeneratePassword && targetRecord.user_id) {
      log.info(`Regenerating password for existing user`, { email });
      
      const newPassword = generateReadablePassword();
      
      // Update the user's password
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        targetRecord.user_id,
        { password: newPassword }
      );

      if (updateError) {
        log.error("Error updating password", { error: updateError });
        return new Response(
          JSON.stringify({ error: "Erreur lors de la mise à jour du mot de passe" }),
          { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }

      const clientName = `${firstName || targetRecord.first_name || ''} ${lastName || targetRecord.last_name || ''}`.trim() || email;
      const baseUrl = tenant.slug ? `https://${tenant.slug}.lyta.ch` : 'https://lyta.ch';
      const loginUrl = `${baseUrl}/connexion`;

      // Send email with new password
      if (RESEND_API_KEY) {
        const { subject, html } = generateWelcomeEmailWithPassword(
          clientName, 
          email, 
          newPassword, 
          loginUrl, 
          branding, 
          tenant.name
        );
        
        const { fromAddress } = getSenderAddress(branding, tenant.name);

        log.info(`Sending new password email`, { from: fromAddress, to: email });

        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromAddress,
            to: [email],
            subject: `🔐 Votre nouveau mot de passe - ${branding?.display_name || tenant.name}`,
            html,
          }),
        });

        if (emailResponse.ok) {
          const emailResult = await emailResponse.json();
          log.info(`New password email sent successfully`, { to: email, emailId: emailResult.id });
        } else {
          const errorText = await emailResponse.text();
          log.error(`Failed to send email`, { to: email, error: errorText });
          throw new AuthError(`Erreur Resend: ${errorText}`, 502);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          userId: targetRecord.user_id,
          message: `Nouveau mot de passe envoyé à ${email}`
        }),
        { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Normal flow - check if user already has an account
    if (targetRecord.user_id) {
      return new Response(
        JSON.stringify({ error: isClientAccount ? "Ce client a déjà un compte utilisateur" : "Ce collaborateur a déjà un compte utilisateur" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Check if a user with this email already exists in auth
    // Query profiles table instead of loading ALL auth users (listUsers is O(n))
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .ilike("email", email.toLowerCase())
      .maybeSingle();

    // If found in profiles, verify in auth
    let existingUser = null;
    if (existingProfile) {
      const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(existingProfile.id);
      existingUser = authUser;
    }

    let userId: string;
    let isNewUser = false;

    const clientName = `${firstName || targetRecord.first_name || ''} ${lastName || targetRecord.last_name || ''}`.trim() || email;
    const consumesSeat = role !== "client";

    if (existingUser) {
      // User already exists - we'll add the new role and link to the client record
      log.info(`User already exists, adding role`, { email, userId: existingUser.id, role });
      userId = existingUser.id;
      await ensureUserRole(supabaseAdmin, userId, role);

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
          log.error("Error adding role", { error: roleInsertError });
        }
      }

      await ensureTenantAssignment(supabaseAdmin, userId, tenantId, tenant as TenantRecord, consumesSeat);

      // Check if user is already assigned to this tenant
      const { data: existingTenantAssignment } = await supabaseAdmin
        .from("user_tenant_assignments")
        .select("id")
        .eq("user_id", userId)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (!existingTenantAssignment) {
        // Check seat availability
        const { count: activeUsersCount } = await supabaseAdmin
          .from("user_tenant_assignments")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId);

        const totalSeats = (tenant.seats_included || 1) + (tenant.extra_users || 0);
        const availableSeats = totalSeats - (activeUsersCount || 0);

        if (availableSeats <= 0) {
          return new Response(
            JSON.stringify({ error: "Aucun siège disponible. Veuillez d'abord débloquer un siège supplémentaire." }),
            { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
          );
        }

        // Assign user to tenant
        await supabaseAdmin
          .from("user_tenant_assignments")
          .insert({ user_id: userId, tenant_id: tenantId });
      }

      // Existing user - just notify them they have access to a new portal
      const baseUrl = tenant.slug ? `https://${tenant.slug}.lyta.ch` : 'https://lyta.ch';
      const loginUrl = `${baseUrl}/connexion`;
      log.info(`Existing user linked to tenant, sending notification email`, { email });
      
      if (RESEND_API_KEY) {
        const displayName = branding?.display_name || branding?.email_sender_name || tenant.name;
        const primaryColor = branding?.primary_color || '#0066FF';
        const logoUrl = branding?.logo_url || '';
        
        const logoHtml = logoUrl 
          ? `<img src="${logoUrl}" alt="${displayName}" style="height: 40px; max-width: 160px; object-fit: contain;" />`
          : `<div style="font-size: 36px; font-weight: 700; color: #ffffff; letter-spacing: -1px;">${displayName}<span style="color: #7C3AED;">.</span></div>`;
        
        const existingUserHtml = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Accès activé - ${displayName}</title>
</head>
<body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background-color: #f0f2f5; margin: 0; padding: 40px 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
    <div style="background: linear-gradient(135deg, ${primaryColor} 0%, #4F46E5 50%, #7C3AED 100%); padding: 40px; text-align: center;">
      ${logoHtml}
      <h1 style="color: #fff; font-size: 26px; margin: 20px 0 0;">Accès activé !</h1>
    </div>
    <div style="padding: 30px 40px;">
      <p style="font-size: 20px; font-weight: 600; color: ${primaryColor};">Bonjour ${clientName} 👋</p>
      <p style="color: #4a4a68; font-size: 15px; line-height: 1.7;">
        Bonne nouvelle ! Vous avez maintenant accès à votre espace client ${displayName}. Connectez-vous avec vos identifiants habituels.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, ${primaryColor} 0%, #4F46E5 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 50px; font-weight: 600;">
          Me connecter →
        </a>
      </div>
      <p style="color: #4a4a68; font-size: 15px;">Cordialement,<br><strong>L'équipe ${displayName}</strong></p>
    </div>
  </div>
</body>
</html>`;
        
        const { fromAddress } = getSenderAddress(branding, tenant.name);

        log.info(`Sending access notification email to existing user`, { from: fromAddress, to: email });

        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromAddress,
            to: [email],
            subject: `✅ Votre accès ${displayName} est activé`,
            html: existingUserHtml,
          }),
        });

        if (emailResponse.ok) {
          const emailResult = await emailResponse.json();
          log.info(`Access notification email sent to existing user`, { to: email, emailId: emailResult.id });
        } else {
          const errorText = await emailResponse.text();
          log.error(`Failed to send email to existing user`, { to: email, error: errorText });
          throw new AuthError(`Erreur Resend: ${errorText}`, 502);
        }
      } else {
        throw new AuthError("Configuration email manquante: RESEND_API_KEY n'est pas defini.", 500);
      }

    } else {
      // New user - create account with temporary password then send reset link
      isNewUser = true;

      if (consumesSeat) {
        await assertSeatAvailable(supabaseAdmin, tenantId, tenant as TenantRecord);
      }

      /*
      // Check seat availability
      const { count: activeUsersCount } = await supabaseAdmin
        .from("user_tenant_assignments")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId);

      const totalSeats = (tenant.seats_included || 1) + (tenant.extra_users || 0);
      const availableSeats = totalSeats - (activeUsersCount || 0);

      if (false && availableSeats <= 0) {
        return new Response(
          JSON.stringify({ error: "Aucun siège disponible. Veuillez d'abord débloquer un siège supplémentaire." }),
          { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }

      */

      // Create user with a readable generated password
      const generatedPassword = generateReadablePassword();
      log.info(`Creating new user account with generated password`, { email });
      
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: generatedPassword,
        email_confirm: true,
        user_metadata: {
          first_name: firstName || targetRecord.first_name,
          last_name: lastName || targetRecord.last_name,
        },
      });

      if (createError) {
        log.error("Error creating user", { error: createError });
        return new Response(
          JSON.stringify({ error: createError.message }),
          { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }

      userId = newUser.user.id;

      // Update the user_roles table
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .update({ role })
        .eq("user_id", userId);

      if (roleError) {
        const { error: upsertError } = await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });

        if (upsertError) {
          log.error("Failed to assign role after upsert fallback", { error: upsertError, userId, role });
          return new Response(
            JSON.stringify({ error: `Compte créé mais échec de l'attribution du rôle: ${upsertError.message}` }),
            { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
          );
        }
      }

      await ensureUserRole(supabaseAdmin, userId, role);

      // Assign user to tenant
      await supabaseAdmin
        .from("user_tenant_assignments")
        .upsert({ user_id: userId, tenant_id: tenantId }, { onConflict: "user_id,tenant_id" });

      // Send welcome email with credentials
      const baseUrl = tenant.slug ? `https://${tenant.slug}.lyta.ch` : 'https://lyta.ch';
      const loginUrl = `${baseUrl}/connexion`;
      log.info(`Sending welcome email with credentials`, { to: email });
      
      if (RESEND_API_KEY) {
        const { subject, html } = generateWelcomeEmailWithPassword(
          clientName, 
          email, 
          generatedPassword, 
          loginUrl, 
          branding, 
          tenant.name
        );
        
        const { fromAddress } = getSenderAddress(branding, tenant.name);

        log.info(`Sending welcome email`, { from: fromAddress, to: email });

        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromAddress,
            to: [email],
            subject,
            html,
          }),
        });

        if (emailResponse.ok) {
          const emailResult = await emailResponse.json();
          log.info(`Welcome email with credentials sent successfully`, { to: email, emailId: emailResult.id });
        } else {
          const errorText = await emailResponse.text();
          log.error(`Failed to send email`, { to: email, error: errorText });
          throw new AuthError(`Erreur Resend: ${errorText}`, 502);
        }
      } else {
        throw new AuthError("Configuration email manquante: RESEND_API_KEY n'est pas defini.", 500);
      }
    }

    // Link the user to the client/collaborateur record
    const { error: linkError } = await supabaseAdmin
      .from("clients")
      .update({ user_id: userId })
      .eq("id", targetId)
      .eq("tenant_id", tenantId);

    if (linkError) {
      log.error("Error linking record", { error: linkError });
      return new Response(
        JSON.stringify({ error: "Compte créé mais erreur lors de la liaison" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    log.info(`User account ${isNewUser ? 'created' : 'linked'} successfully`, { email, role });

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId,
        wasExisting: !isNewUser,
        message: isNewUser 
          ? `Compte créé pour ${email}. Un email d'activation a été envoyé.` 
          : `L'utilisateur existant ${email} a été lié avec le rôle ${role}. Un email lui a été envoyé.`
      }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );

  } catch (error) {
    if (error instanceof AuthError) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: error.status, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }
    log.error("Unhandled error in create-user-account", { error: error instanceof Error ? error.message : String(error) });
    const errorMessage = error instanceof Error ? error.message : "Erreur serveur interne";
    return new Response(
      JSON.stringify({ error: `Erreur serveur: ${errorMessage}` }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
