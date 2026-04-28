import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAuth, requireTenantAccess, AuthError } from "../_shared/auth.ts";
import { getSenderAddress } from "../_shared/email-sender.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("create-user-account");

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const TENANT_DOMAIN_SUFFIX = Deno.env.get("TENANT_DOMAIN_SUFFIX") ?? "lyta.ch";
const DEFAULT_APP_ORIGIN = Deno.env.get("PUBLIC_APP_ORIGIN") ?? "https://app.lyta.ch";

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

interface PermissionSpec {
  module: string;
  action: string;
}

interface TenantRoleConfig {
  names: string[];
  createName: string;
  description: string;
  dashboard_scope: "personal" | "team" | "global";
  can_see_own_commissions: boolean;
  can_see_team_commissions: boolean;
  can_see_all_commissions: boolean;
  permissions: PermissionSpec[];
}

const ADMIN_PERMISSIONS: PermissionSpec[] = [
  { module: "clients", action: "view" },
  { module: "clients", action: "create" },
  { module: "clients", action: "update" },
  { module: "clients", action: "delete" },
  { module: "clients", action: "export" },
  { module: "contracts", action: "view" },
  { module: "contracts", action: "deposit" },
  { module: "contracts", action: "update" },
  { module: "contracts", action: "cancel" },
  { module: "contracts", action: "export" },
  { module: "partners", action: "view" },
  { module: "partners", action: "create" },
  { module: "partners", action: "update" },
  { module: "partners", action: "delete" },
  { module: "products", action: "view" },
  { module: "products", action: "create" },
  { module: "products", action: "update" },
  { module: "products", action: "delete" },
  { module: "collaborators", action: "view" },
  { module: "collaborators", action: "create" },
  { module: "collaborators", action: "update" },
  { module: "collaborators", action: "delete" },
  { module: "collaborators", action: "export" },
  { module: "commissions", action: "view" },
  { module: "commissions", action: "modify_rules" },
  { module: "commissions", action: "export" },
  { module: "decomptes", action: "view" },
  { module: "decomptes", action: "generate" },
  { module: "decomptes", action: "export" },
  { module: "payout", action: "view" },
  { module: "payout", action: "generate" },
  { module: "payout", action: "validate" },
  { module: "payout", action: "export" },
  { module: "dashboard", action: "view" },
  { module: "settings", action: "view" },
  { module: "settings", action: "update" },
];

const TENANT_ROLE_CONFIGS: Record<string, TenantRoleConfig> = {
  admin: {
    names: ["Admin Cabinet", "Administrateur", "Admin"],
    createName: "Admin Cabinet",
    description: "Acces complet a toutes les fonctionnalites",
    dashboard_scope: "global",
    can_see_own_commissions: true,
    can_see_team_commissions: true,
    can_see_all_commissions: true,
    permissions: ADMIN_PERMISSIONS,
  },
  manager: {
    names: ["Manager"],
    createName: "Manager",
    description: "Acces equipe + clients personnels",
    dashboard_scope: "team",
    can_see_own_commissions: true,
    can_see_team_commissions: true,
    can_see_all_commissions: false,
    permissions: [
      { module: "clients", action: "view" },
      { module: "clients", action: "create" },
      { module: "clients", action: "update" },
      { module: "clients", action: "export" },
      { module: "contracts", action: "view" },
      { module: "contracts", action: "deposit" },
      { module: "contracts", action: "update" },
      { module: "contracts", action: "export" },
      { module: "collaborators", action: "view" },
      { module: "commissions", action: "view" },
      { module: "decomptes", action: "view" },
      { module: "dashboard", action: "view" },
      { module: "settings", action: "view" },
    ],
  },
  agent: {
    names: ["Agent"],
    createName: "Agent",
    description: "Acces uniquement a ses clients et contrats",
    dashboard_scope: "personal",
    can_see_own_commissions: true,
    can_see_team_commissions: false,
    can_see_all_commissions: false,
    permissions: [
      { module: "clients", action: "view" },
      { module: "clients", action: "create" },
      { module: "clients", action: "update" },
      { module: "contracts", action: "view" },
      { module: "contracts", action: "deposit" },
      { module: "commissions", action: "view" },
      { module: "dashboard", action: "view" },
    ],
  },
  backoffice: {
    names: ["Back-office", "Backoffice", "Back Office"],
    createName: "Back-office",
    description: "Voit tous les clients et contrats, aucun acces finance",
    dashboard_scope: "global",
    can_see_own_commissions: false,
    can_see_team_commissions: false,
    can_see_all_commissions: false,
    permissions: [
      { module: "clients", action: "view" },
      { module: "clients", action: "create" },
      { module: "clients", action: "update" },
      { module: "clients", action: "export" },
      { module: "contracts", action: "view" },
      { module: "contracts", action: "deposit" },
      { module: "contracts", action: "update" },
      { module: "contracts", action: "export" },
      { module: "partners", action: "view" },
      { module: "products", action: "view" },
      { module: "collaborators", action: "view" },
      { module: "dashboard", action: "view" },
      { module: "settings", action: "view" },
    ],
  },
  compta: {
    names: ["Comptabilite", "Comptabilité", "Compta"],
    createName: "Comptabilite",
    description: "Acces comptabilite, commissions et decomptes",
    dashboard_scope: "global",
    can_see_own_commissions: true,
    can_see_team_commissions: true,
    can_see_all_commissions: true,
    permissions: [
      { module: "clients", action: "view" },
      { module: "clients", action: "export" },
      { module: "contracts", action: "view" },
      { module: "contracts", action: "export" },
      { module: "commissions", action: "view" },
      { module: "commissions", action: "modify_rules" },
      { module: "commissions", action: "export" },
      { module: "decomptes", action: "view" },
      { module: "decomptes", action: "generate" },
      { module: "decomptes", action: "export" },
      { module: "payout", action: "view" },
      { module: "payout", action: "generate" },
      { module: "payout", action: "validate" },
      { module: "payout", action: "export" },
      { module: "dashboard", action: "view" },
      { module: "settings", action: "view" },
    ],
  },
  partner: {
    names: ["Partenaire", "Partner"],
    createName: "Partenaire",
    description: "Acces partenaire au CRM",
    dashboard_scope: "personal",
    can_see_own_commissions: true,
    can_see_team_commissions: false,
    can_see_all_commissions: false,
    permissions: [
      { module: "clients", action: "view" },
      { module: "clients", action: "create" },
      { module: "clients", action: "update" },
      { module: "contracts", action: "view" },
      { module: "contracts", action: "deposit" },
      { module: "partners", action: "view" },
      { module: "commissions", action: "view" },
      { module: "dashboard", action: "view" },
    ],
  },
};

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

function appendLoginSpace(url: string, space: "client" | "team"): string {
  try {
    const parsedUrl = new URL(url);
    if (!parsedUrl.searchParams.has("space")) {
      parsedUrl.searchParams.set("space", space);
    }
    return parsedUrl.toString();
  } catch {
    const separator = url.includes("?") ? "&" : "?";
    return url.includes("space=") ? url : `${url}${separator}space=${space}`;
  }
}

function buildTenantLoginUrl(tenant: TenantRecord, role: string): string {
  const origin = tenant.slug
    ? `https://${tenant.slug}.${TENANT_DOMAIN_SUFFIX}`
    : DEFAULT_APP_ORIGIN.replace(/\/$/, "");
  return appendLoginSpace(`${origin}/connexion`, role === "client" ? "client" : "team");
}

function buildTenantResetUrl(tenant: TenantRecord, role: string): string {
  const origin = tenant.slug
    ? `https://${tenant.slug}.${TENANT_DOMAIN_SUFFIX}`
    : DEFAULT_APP_ORIGIN.replace(/\/$/, "");
  return appendLoginSpace(`${origin}/reset-password`, role === "client" ? "client" : "team");
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

async function createPasswordSetupLink(
  supabaseAdmin: ReturnType<typeof createClient>,
  email: string,
  redirectTo: string,
): Promise<string> {
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });

  if (linkError) {
    throw new AuthError(`Erreur lors de la generation du lien d'invitation: ${linkError.message}`, 500);
  }

  const link = buildRecoveryLink(redirectTo, linkData);
  if (!link) {
    throw new AuthError("Erreur lors de la generation du lien d'invitation", 500);
  }

  return link;
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

function generatePasswordSetupEmail(
  clientName: string,
  email: string,
  resetLink: string,
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
    subject: `Invitation à votre espace ${displayName}`,
    html: `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation - ${displayName}</title>
</head>
<body style="font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif; background-color: #f0f2f5; margin: 0; padding: 40px 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
    <div style="background: linear-gradient(135deg, ${primaryColor} 0%, #4F46E5 100%); padding: 40px; text-align: center;">
      ${logoHtml}
      <h1 style="color: #fff; font-size: 26px; margin: 20px 0 0;">Votre espace est prêt</h1>
    </div>
    <div style="padding: 30px 40px;">
      <p style="font-size: 20px; font-weight: 600; color: ${primaryColor};">Bonjour ${clientName}</p>
      <p style="color: #4a4a68; font-size: 15px; line-height: 1.7;">
        Votre accès ${displayName} a été activé pour l'adresse <strong>${email}</strong>.
        Cliquez sur le bouton ci-dessous pour définir votre mot de passe et accéder à votre espace.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${resetLink}" style="display: inline-block; background: ${primaryColor}; color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600;">
          Créer mon mot de passe
        </a>
      </div>
      <p style="color: #6b7280; font-size: 13px; line-height: 1.6;">
        Ce lien est temporaire. S'il expire, demandez un nouvel email d'invitation depuis votre cabinet.
      </p>
      <p style="color: #6b7280; font-size: 13px; line-height: 1.6;">
        Après création du mot de passe, vous pourrez aussi vous connecter ici:
        <a href="${loginUrl}" style="color: ${primaryColor};">${loginUrl}</a>
      </p>
      <p style="color: #4a4a68; font-size: 15px; margin-top: 32px;">Cordialement,<br><strong>L'équipe ${displayName}</strong></p>
    </div>
  </div>
</body>
</html>`,
  };
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

  const totalSeats = await getTenantSeatCapacity(supabaseAdmin, tenantId, tenant);
  const availableSeats = totalSeats - billableUsersCount;

  if (availableSeats <= 0) {
    throw new AuthError("Aucun siege disponible. Debloquez un siege supplementaire.", 400);
  }
}

async function getTenantSeatCapacity(
  supabaseAdmin: ReturnType<typeof createClient>,
  tenantId: string,
  tenant: TenantRecord,
): Promise<number> {
  const baseCapacity = (tenant.seats_included || 1) + (tenant.extra_users || 0);

  const { data: limit } = await supabaseAdmin
    .from("tenant_limits")
    .select("users_limit")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!limit?.users_limit) {
    return baseCapacity;
  }

  const { data: limitAudit } = await supabaseAdmin
    .from("tenant_limits_audit")
    .select("id")
    .eq("tenant_id", tenantId)
    .in("limit_type", ["users_limit", "users"])
    .limit(1)
    .maybeSingle();

  if (limitAudit) {
    return Math.max(tenant.seats_included || 1, limit.users_limit);
  }

  return baseCapacity;
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

async function ensureTenantRolePermissions(
  supabaseAdmin: ReturnType<typeof createClient>,
  roleId: string,
  permissions: PermissionSpec[],
): Promise<void> {
  if (permissions.length === 0) return;

  const { error } = await supabaseAdmin
    .from("tenant_role_permissions")
    .upsert(
      permissions.map((permission) => ({
        role_id: roleId,
        module: permission.module,
        action: permission.action,
        allowed: true,
      })),
      { onConflict: "role_id,module,action", ignoreDuplicates: true },
    );

  if (error) {
    throw new AuthError(`Erreur lors de l'initialisation des permissions tenant: ${error.message}`, 500);
  }
}

async function ensureTenantRoleAssignment(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  tenantId: string,
  role: string,
  assignedBy: string,
): Promise<void> {
  const roleConfig = TENANT_ROLE_CONFIGS[role];
  if (!roleConfig) {
    return;
  }

  const { data: existingRoles, error: fetchError } = await supabaseAdmin
    .from("tenant_roles")
    .select("id, is_system_role")
    .eq("tenant_id", tenantId)
    .in("name", roleConfig.names)
    .order("is_system_role", { ascending: false })
    .limit(1);

  if (fetchError) {
    throw new AuthError(`Erreur lors de la recherche du role tenant: ${fetchError.message}`, 500);
  }

  let roleId = existingRoles?.[0]?.id ?? null;
  let shouldEnsurePermissions = Boolean(existingRoles?.[0]?.is_system_role);

  if (!roleId) {
    const { data: createdRole, error: createError } = await supabaseAdmin
      .from("tenant_roles")
      .insert({
        tenant_id: tenantId,
        name: roleConfig.createName,
        description: roleConfig.description,
        is_system_role: true,
        dashboard_scope: roleConfig.dashboard_scope,
        can_see_own_commissions: roleConfig.can_see_own_commissions,
        can_see_team_commissions: roleConfig.can_see_team_commissions,
        can_see_all_commissions: roleConfig.can_see_all_commissions,
      })
      .select("id")
      .single();

    if (createError) {
      throw new AuthError(`Erreur lors de la creation du role tenant: ${createError.message}`, 500);
    }

    roleId = createdRole.id;
    shouldEnsurePermissions = true;
  }

  if (shouldEnsurePermissions) {
    await ensureTenantRolePermissions(supabaseAdmin, roleId, roleConfig.permissions);
  }

  const { error: assignError } = await supabaseAdmin
    .from("user_tenant_roles")
    .upsert(
      {
        user_id: userId,
        tenant_id: tenantId,
        role_id: roleId,
        assigned_by: assignedBy,
      },
      { onConflict: "user_id,role_id,tenant_id" },
    );

  if (assignError) {
    throw new AuthError(`Erreur lors de l'attribution du role tenant: ${assignError.message}`, 500);
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
    const validRoles = ["admin", "manager", "agent", "backoffice", "compta", "client", "partner"];
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

      const passwordResetConsumesSeat = role !== "client";
      await ensureUserRole(supabaseAdmin, targetRecord.user_id, role);
      await ensureTenantAssignment(supabaseAdmin, targetRecord.user_id, tenantId, tenant as TenantRecord, passwordResetConsumesSeat);
      await ensureTenantRoleAssignment(supabaseAdmin, targetRecord.user_id, tenantId, role, requestingUser.id);

      const clientName = `${firstName || targetRecord.first_name || ''} ${lastName || targetRecord.last_name || ''}`.trim() || email;
      const loginUrl = buildTenantLoginUrl(tenant as TenantRecord, role);

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
      await ensureTenantRoleAssignment(supabaseAdmin, userId, tenantId, role, requestingUser.id);

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

      // Existing user - send a password setup link so they can access this tenant even
      // if they do not remember an existing password.
      const loginUrl = buildTenantLoginUrl(tenant as TenantRecord, role);
      const resetUrl = buildTenantResetUrl(tenant as TenantRecord, role);
      const resetLink = await createPasswordSetupLink(supabaseAdmin, email, resetUrl);
      log.info(`Existing user linked to tenant, sending password setup email`, { email });
      
      if (RESEND_API_KEY) {
        const { subject, html } = generatePasswordSetupEmail(
          clientName,
          email,
          resetLink,
          loginUrl,
          branding,
          tenant.name
        );
        
        const { fromAddress } = getSenderAddress(branding, tenant.name);

        log.info(`Sending password setup email to existing user`, { from: fromAddress, to: email });

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
          log.info(`Password setup email sent to existing user`, { to: email, emailId: emailResult.id });
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
      const { error: tenantAssignmentError } = await supabaseAdmin
        .from("user_tenant_assignments")
        .upsert({ user_id: userId, tenant_id: tenantId }, { onConflict: "user_id,tenant_id" });

      if (tenantAssignmentError) {
        throw new AuthError(`Erreur lors de l'assignation au tenant: ${tenantAssignmentError.message}`, 500);
      }

      await ensureTenantRoleAssignment(supabaseAdmin, userId, tenantId, role, requestingUser.id);

      // Send welcome email with a password setup link
      const loginUrl = buildTenantLoginUrl(tenant as TenantRecord, role);
      const resetUrl = buildTenantResetUrl(tenant as TenantRecord, role);
      const resetLink = await createPasswordSetupLink(supabaseAdmin, email, resetUrl);
      log.info(`Sending welcome email with password setup link`, { to: email });
      
      if (RESEND_API_KEY) {
        const { subject, html } = generatePasswordSetupEmail(
          clientName, 
          email, 
          resetLink,
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
          log.info(`Welcome email with password setup link sent successfully`, { to: email, emailId: emailResult.id });
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
