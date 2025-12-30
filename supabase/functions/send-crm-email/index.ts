import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TenantBranding {
  display_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  email_sender_name: string | null;
  email_sender_address: string | null;
  company_address: string | null;
  company_phone: string | null;
  company_website: string | null;
  company_email: string | null;
  email_footer_text: string | null;
}

interface EmailData {
  contractDetails?: string;
  companyName?: string;
  agentName?: string;
  temporaryPassword?: string;
  loginUrl?: string;
  clientEmail?: string;
  tenantSlug?: string;
}

interface EmailRequest {
  type: "welcome" | "contract_signed" | "mandat_signed" | "account_created" | "relation_client" | "offre_speciale";
  clientEmail: string;
  clientName: string;
  data?: EmailData;
  tenantSlug?: string;
}

// Dynamic email wrapper with tenant branding
const getEmailWrapper = (content: string, branding: TenantBranding | null, tenantName: string) => {
  const displayName = branding?.display_name || branding?.email_sender_name || tenantName;
  const primaryColor = branding?.primary_color || '#1800AD';
  const logoUrl = branding?.logo_url || '';
  const companyAddress = branding?.company_address || '';
  const companyPhone = branding?.company_phone || '';
  const companyWebsite = branding?.company_website || '';
  const companyEmail = branding?.company_email || '';

  const logoHtml = logoUrl 
    ? `<img src="${logoUrl}" alt="${displayName}" style="height: 40px; max-width: 160px; object-fit: contain;" />`
    : `<div class="logo-text" style="font-size: 36px; font-weight: 700; color: #ffffff; letter-spacing: -1px;">${displayName}<span style="color: #7C3AED;">.</span></div>`;

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${displayName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1a1a2e;
      margin: 0;
      padding: 0;
      background-color: #f0f2f5;
      -webkit-font-smoothing: antialiased;
    }
    
    .email-wrapper {
      max-width: 600px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    
    .email-container {
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(24, 0, 173, 0.08);
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
    
    .logo-container {
      margin-bottom: 20px;
      display: inline-block;
    }
    
    .header-title {
      color: #ffffff;
      font-size: 26px;
      font-weight: 700;
      margin: 0;
      letter-spacing: -0.5px;
    }
    
    .header-subtitle {
      color: rgba(255, 255, 255, 0.85);
      font-size: 15px;
      margin-top: 8px;
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
    
    .highlight-box {
      background: linear-gradient(135deg, #f0f4ff 0%, #e8f0fe 100%);
      border-left: 4px solid ${primaryColor};
      padding: 20px 24px;
      margin: 24px 0;
      border-radius: 0 12px 12px 0;
    }
    
    .highlight-box strong {
      color: ${primaryColor};
    }
    
    .success-box {
      background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
      border-left: 4px solid #10b981;
      padding: 20px 24px;
      margin: 24px 0;
      border-radius: 0 12px 12px 0;
    }
    
    .success-box strong {
      color: #065f46;
    }
    
    .credentials-box {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border: 2px solid #f59e0b;
      padding: 28px;
      border-radius: 12px;
      margin: 28px 0;
    }
    
    .credentials-title {
      font-size: 18px;
      font-weight: 600;
      color: #92400e;
      margin: 0 0 16px 0;
    }
    
    .credential-label {
      font-size: 13px;
      font-weight: 600;
      color: #78350f;
      margin: 12px 0 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .credential-value {
      background: #ffffff;
      padding: 14px 18px;
      border-radius: 8px;
      font-family: 'SF Mono', Monaco, 'Courier New', monospace;
      font-size: 15px;
      color: #1a1a2e;
      border: 1px solid rgba(245, 158, 11, 0.3);
    }
    
    .warning-text {
      font-size: 13px;
      color: #92400e;
      margin-top: 16px;
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
      font-size: 16px;
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
      box-shadow: 0 4px 14px rgba(24, 0, 173, 0.35);
    }
    
    .details-box {
      background: #f8fafc;
      padding: 24px;
      border-radius: 12px;
      margin: 24px 0;
      border: 1px solid #e2e8f0;
    }
    
    .details-box h3 {
      margin: 0 0 12px;
      color: ${primaryColor};
      font-size: 16px;
      font-weight: 600;
    }
    
    .signature {
      margin-top: 36px;
      padding-top: 24px;
      border-top: 1px solid #e5e7eb;
    }
    
    .signature-text {
      color: #6b7280;
      font-size: 14px;
      margin-bottom: 4px;
    }
    
    .signature-name {
      font-weight: 600;
      color: ${primaryColor};
      font-size: 16px;
    }
    
    .footer {
      background: #f8fafc;
      padding: 32px 40px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    
    .footer-text {
      color: #6b7280;
      font-size: 13px;
      margin: 8px 0;
      line-height: 1.6;
    }
    
    .footer-link {
      color: ${primaryColor};
      text-decoration: none;
      font-size: 13px;
      font-weight: 500;
    }
    
    .footer-divider {
      color: #d1d5db;
      margin: 0 12px;
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      ${content}
      
      <div class="footer">
        ${logoUrl ? `<img src="${logoUrl}" alt="${displayName}" style="height: 32px; margin-bottom: 12px;" />` : `<div style="font-size: 24px; color: ${primaryColor}; font-weight: 700; margin-bottom: 12px;">${displayName}</div>`}
        <p class="footer-text">
          <strong>${displayName}</strong><br>
          ${branding?.email_footer_text || 'Votre partenaire assurance de confiance'}
        </p>
        ${companyAddress ? `<p class="footer-text">📍 ${companyAddress}</p>` : ''}
        ${companyPhone ? `<p class="footer-text">📞 ${companyPhone}</p>` : ''}
        ${companyWebsite || companyEmail ? `
        <div style="margin-top: 8px;">
          ${companyWebsite ? `<a href="https://${companyWebsite.replace(/^https?:\/\//, '')}" class="footer-link">${companyWebsite}</a>` : ''}
          ${companyWebsite && companyEmail ? '<span class="footer-divider">|</span>' : ''}
          ${companyEmail ? `<a href="mailto:${companyEmail}" class="footer-link">${companyEmail}</a>` : ''}
        </div>
        ` : ''}
        <p class="footer-text" style="margin-top: 24px; font-size: 11px; color: #9ca3af;">
          Cet email a été envoyé automatiquement. Merci de ne pas répondre directement à ce message.<br>
          © ${new Date().getFullYear()} ${displayName}. Tous droits réservés.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
`;
};

// Email templates with dynamic branding
const getEmailContent = (
  type: string, 
  clientName: string, 
  data: EmailData | undefined,
  branding: TenantBranding | null,
  tenantName: string
) => {
  const displayName = branding?.display_name || branding?.email_sender_name || tenantName;
  const primaryColor = branding?.primary_color || '#1800AD';
  const logoUrl = branding?.logo_url || '';
  const companyWebsite = branding?.company_website || '';
  const loginUrl = data?.loginUrl || (companyWebsite ? `https://${companyWebsite.replace(/^https?:\/\//, '')}/connexion` : 'https://app.lyta.ch/connexion');

  const logoHtml = logoUrl 
    ? `<img src="${logoUrl}" alt="${displayName}" style="height: 40px; max-width: 160px; object-fit: contain;" />`
    : `<div style="font-size: 36px; font-weight: 700; color: #ffffff; letter-spacing: -1px;">${displayName}<span style="color: #7C3AED;">.</span></div>`;

  switch (type) {
    case "welcome":
      return {
        subject: `🎉 Bienvenue chez ${displayName} - Votre partenaire assurance`,
        html: getEmailWrapper(`
          <div class="header">
            <div class="logo-container">${logoHtml}</div>
            <h1 class="header-title">Bienvenue chez ${displayName} !</h1>
            <p class="header-subtitle">Votre nouveau partenaire assurance en Suisse</p>
          </div>
          <div class="content">
            <p class="greeting">Bonjour ${clientName} 👋</p>
            <p class="text">
              Nous sommes ravis de vous accueillir parmi nos clients ! Merci de nous avoir fait confiance pour vous accompagner dans la gestion de vos assurances.
            </p>
            <div class="highlight-box">
              <strong>Votre conseiller ${displayName}</strong> est désormais à votre disposition pour vous accompagner dans toutes vos démarches d'assurance en Suisse.
            </div>
            <p class="text">Chez ${displayName}, nous nous engageons à :</p>
            <ul class="features-list">
              <li>Analyser vos besoins en assurance de manière personnalisée</li>
              <li>Comparer les meilleures offres du marché suisse</li>
              <li>Vous accompagner dans toutes vos démarches administratives</li>
              <li>Optimiser vos primes et votre couverture</li>
            </ul>
            <div class="signature">
              <p class="signature-text">À très bientôt,</p>
              <p class="signature-name">L'équipe ${displayName}</p>
            </div>
          </div>
        `, branding, tenantName),
      };

    case "contract_signed":
      return {
        subject: `✅ Confirmation de signature - Votre contrat ${displayName}`,
        html: getEmailWrapper(`
          <div class="header">
            <div class="logo-container">${logoHtml}</div>
            <h1 class="header-title">Contrat signé avec succès ✓</h1>
            <p class="header-subtitle">Félicitations pour votre nouvelle couverture</p>
          </div>
          <div class="content">
            <p class="greeting">Bonjour ${clientName} 👋</p>
            <div class="success-box">
              <strong>Félicitations !</strong> Votre contrat d'assurance a été signé avec succès et est maintenant actif.
            </div>
            ${data?.contractDetails || data?.companyName ? `
            <div class="details-box">
              <h3>📋 Détails du contrat</h3>
              ${data.contractDetails ? `<p class="text" style="margin: 8px 0;">${data.contractDetails}</p>` : ''}
              ${data.companyName ? `<p class="text" style="margin: 8px 0;"><strong>Compagnie d'assurance :</strong> ${data.companyName}</p>` : ''}
            </div>
            ` : ''}
            <p class="text">
              Votre police d'assurance vous sera envoyée prochainement par courrier. En attendant, tous vos documents sont disponibles dans votre espace client.
            </p>
            <div class="signature">
              <p class="signature-text">Cordialement,</p>
              <p class="signature-name">L'équipe ${displayName}</p>
            </div>
          </div>
        `, branding, tenantName),
      };

    case "mandat_signed":
      return {
        subject: `🔐 Votre espace client ${displayName} est prêt !`,
        html: getEmailWrapper(`
          <div class="header">
            <div class="logo-container">${logoHtml}</div>
            <h1 class="header-title">Mandat de gestion activé</h1>
            <p class="header-subtitle">Votre espace client personnel est prêt</p>
          </div>
          <div class="content">
            <p class="greeting">Bonjour ${clientName} 👋</p>
            <div class="success-box">
              <strong>Votre mandat de gestion a été signé avec succès !</strong><br>
              ${displayName} est désormais mandaté pour gérer et optimiser votre portefeuille d'assurances.
            </div>
            <p class="text">Nous avons créé votre espace client personnel. Vous pouvez désormais :</p>
            <ul class="features-list">
              <li>Consulter tous vos contrats d'assurance en un seul endroit</li>
              <li>Télécharger vos documents et attestations</li>
              <li>Contacter directement votre conseiller dédié</li>
              <li>Suivre l'avancement de vos demandes en temps réel</li>
            </ul>
            ${data?.temporaryPassword ? `
            <div class="credentials-box">
              <h3 class="credentials-title">🔐 Vos identifiants de connexion</h3>
              <p class="credential-label">Adresse email</p>
              <div class="credential-value">${data?.clientEmail || ''}</div>
              <p class="credential-label">Mot de passe temporaire</p>
              <div class="credential-value">${data.temporaryPassword}</div>
              <p class="warning-text">
                ⚠️ Pour votre sécurité, veuillez modifier votre mot de passe lors de votre première connexion.
              </p>
            </div>
            ` : ''}
            <div class="cta-container">
              <a href="${loginUrl}" class="cta-button">
                Accéder à mon espace client →
              </a>
            </div>
            <div class="signature">
              <p class="signature-text">Cordialement,</p>
              <p class="signature-name">L'équipe ${displayName}</p>
            </div>
          </div>
        `, branding, tenantName),
      };

    case "account_created":
      return {
        subject: `🔑 Votre compte ${displayName} a été créé`,
        html: getEmailWrapper(`
          <div class="header">
            <div class="logo-container">${logoHtml}</div>
            <h1 class="header-title">Votre compte est prêt !</h1>
            <p class="header-subtitle">Connectez-vous à votre espace personnel</p>
          </div>
          <div class="content">
            <p class="greeting">Bonjour ${clientName} 👋</p>
            <p class="text">
              Votre compte client ${displayName} a été créé avec succès. Vous pouvez maintenant accéder à votre espace personnel pour gérer vos assurances.
            </p>
            <div class="credentials-box">
              <h3 class="credentials-title">🔐 Vos identifiants de connexion</h3>
              <p class="credential-label">Adresse email</p>
              <div class="credential-value">${data?.clientEmail || ''}</div>
              <p class="credential-label">Mot de passe temporaire</p>
              <div class="credential-value">${data?.temporaryPassword || ''}</div>
              <p class="warning-text">
                ⚠️ Pensez à modifier votre mot de passe après votre première connexion.
              </p>
            </div>
            <div class="cta-container">
              <a href="${loginUrl}" class="cta-button">
                Se connecter maintenant →
              </a>
            </div>
            <div class="signature">
              <p class="signature-text">Cordialement,</p>
              <p class="signature-name">L'équipe ${displayName}</p>
            </div>
          </div>
        `, branding, tenantName),
      };

    case "relation_client":
      return {
        subject: `💬 Votre conseiller ${displayName} prend de vos nouvelles`,
        html: getEmailWrapper(`
          <div class="header">
            <div class="logo-container">${logoHtml}</div>
            <h1 class="header-title">Comment allez-vous ?</h1>
            <p class="header-subtitle">Votre conseiller ${displayName} pense à vous</p>
          </div>
          <div class="content">
            <p class="greeting">Bonjour ${clientName} 👋</p>
            <p class="text">
              Nous espérons que vous allez bien ! En tant que votre partenaire assurance de confiance, nous souhaitons prendre de vos nouvelles et nous assurer que vos couvertures correspondent toujours à votre situation actuelle.
            </p>
            <div class="highlight-box">
              <strong>Votre situation a-t-elle changé ?</strong><br>
              Mariage, naissance, déménagement, changement professionnel... Ces événements peuvent impacter vos besoins en assurance.
            </div>
            <p class="text">N'hésitez pas à nous contacter pour :</p>
            <ul class="features-list">
              <li>Faire le point sur vos contrats actuels</li>
              <li>Adapter vos couvertures à votre nouvelle situation</li>
              <li>Optimiser vos primes d'assurance</li>
              <li>Poser toutes vos questions sur vos assurances</li>
            </ul>
            <div class="signature">
              <p class="signature-text">Chaleureusement,</p>
              <p class="signature-name">L'équipe ${displayName}</p>
            </div>
          </div>
        `, branding, tenantName),
      };

    case "offre_speciale":
      return {
        subject: `🎁 Offre exclusive pour vous - Économisez sur vos assurances !`,
        html: getEmailWrapper(`
          <div class="header">
            <div class="logo-container">${logoHtml}</div>
            <h1 class="header-title">Offre Spéciale 🎁</h1>
            <p class="header-subtitle">Des économies exclusives pour nos clients</p>
          </div>
          <div class="content">
            <p class="greeting">Bonjour ${clientName} 👋</p>
            <p class="text">
              Bonne nouvelle ! Nous avons négocié des offres exclusives auprès de nos partenaires assureurs pour vous permettre de réaliser des économies significatives.
            </p>
            <div class="highlight-box" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-left-color: #f59e0b;">
              <strong style="color: #92400e;">🔥 Offres limitées dans le temps</strong><br>
              <span style="color: #78350f;">Profitez de tarifs préférentiels sur plusieurs types d'assurances !</span>
            </div>
            <p class="text">Nos offres du moment :</p>
            <ul class="features-list">
              <li><strong>Assurance Santé :</strong> Jusqu'à 15% de réduction sur les complémentaires</li>
              <li><strong>3e Pilier :</strong> Bonus de bienvenue pour toute nouvelle souscription</li>
              <li><strong>Assurance Auto :</strong> -10% sur votre première année</li>
              <li><strong>RC Ménage :</strong> Couverture premium au prix standard</li>
            </ul>
            <p class="text" style="text-align: center; color: #6b7280; font-size: 14px;">
              Contactez-nous pour bénéficier de ces offres exclusives réservées à nos clients.
            </p>
            <div class="signature">
              <p class="signature-text">À très bientôt,</p>
              <p class="signature-name">L'équipe ${displayName}</p>
            </div>
          </div>
        `, branding, tenantName),
      };

    default:
      return {
        subject: `Notification ${displayName}`,
        html: getEmailWrapper(`
          <div class="header">
            <div class="logo-container">${logoHtml}</div>
            <h1 class="header-title">Notification</h1>
          </div>
          <div class="content">
            <p class="greeting">Bonjour ${clientName},</p>
            <p class="text">Vous avez une nouvelle notification de ${displayName}.</p>
            <div class="signature">
              <p class="signature-text">Cordialement,</p>
              <p class="signature-name">L'équipe ${displayName}</p>
            </div>
          </div>
        `, branding, tenantName),
      };
  }
};

// Generate secure temporary password
const generateTemporaryPassword = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, clientEmail, clientName, data, tenantSlug }: EmailRequest & { tenantSlug?: string } = await req.json();

    console.log(`Processing email request: type=${type}, email=${clientEmail}, name=${clientName}, tenant=${tenantSlug}`);

    if (!clientEmail || !clientName || !type) {
      throw new Error("Missing required fields: type, clientEmail, clientName");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // SECURITY: Verify authentication for sensitive email types
    // Types that can create/modify user accounts MUST be authenticated
    const sensitiveTypes = ['mandat_signed', 'account_created'];
    
    if (sensitiveTypes.includes(type)) {
      const authHeader = req.headers.get('Authorization');
      
      if (!authHeader) {
        console.error(`Unauthorized access attempt for sensitive email type: ${type}`);
        return new Response(
          JSON.stringify({ error: "Authentication required for this email type" }),
          { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Create a client with the user's token to verify they are authenticated
      const supabaseUser = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
      
      if (authError || !user) {
        console.error(`Authentication failed for sensitive email type: ${type}`, authError);
        return new Response(
          JSON.stringify({ error: "Invalid or expired authentication" }),
          { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Verify the user has appropriate role (admin, agent, manager, backoffice, partner)
      const { data: roleData, error: roleError } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      const allowedRoles = ['admin', 'agent', 'manager', 'backoffice', 'partner', 'king'];
      
      if (roleError || !roleData || !allowedRoles.includes(roleData.role)) {
        console.error(`User ${user.id} lacks permission for ${type} email`);
        return new Response(
          JSON.stringify({ error: "Insufficient permissions for this email type" }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      console.log(`Authenticated request from user ${user.id} (role: ${roleData.role}) for ${type}`);
    }

    // Fetch tenant branding
    let branding: TenantBranding | null = null;
    let tenantName = 'LYTA';
    
    const slug = tenantSlug || data?.tenantSlug || 'lyta';
    
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select(`
        name,
        tenant_branding (
          display_name,
          logo_url,
          primary_color,
          secondary_color,
          email_sender_name,
          email_sender_address,
          company_address,
          company_phone,
          company_website,
          company_email,
          email_footer_text
        )
      `)
      .eq('slug', slug)
      .single();

    if (!tenantError && tenant) {
      tenantName = tenant.name;
      if (tenant.tenant_branding && tenant.tenant_branding.length > 0) {
        branding = tenant.tenant_branding[0];
      }
      console.log("Found tenant branding:", branding?.display_name || tenantName);
    }

    let emailData: EmailData = data || {};
    let createdUserId: string | null = null;

    // If mandat signed, create user account first
    if (type === "mandat_signed" && !data?.temporaryPassword) {
      const temporaryPassword = generateTemporaryPassword();
      
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find((u: { email?: string }) => u.email === clientEmail);

      if (!existingUser) {
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: clientEmail,
          password: temporaryPassword,
          email_confirm: true,
          user_metadata: {
            first_name: clientName.split(' ')[0],
            last_name: clientName.split(' ').slice(1).join(' ') || '',
          },
        });

        if (createError) {
          console.error("Error creating user:", createError);
          throw new Error(`Failed to create user account: ${createError.message}`);
        }

        createdUserId = newUser?.user?.id || null;

        if (createdUserId) {
          await supabaseAdmin
            .from('user_roles')
            .upsert({ user_id: createdUserId, role: 'client' }, { onConflict: 'user_id,role' });

          const { data: clientRecord } = await supabaseAdmin
            .from('clients')
            .select('id')
            .eq('email', clientEmail)
            .single();

          if (clientRecord) {
            await supabaseAdmin
              .from('clients')
              .update({ user_id: createdUserId })
              .eq('id', clientRecord.id);
          }
        }

        const loginUrl = branding?.company_website 
          ? `https://${branding.company_website.replace(/^https?:\/\//, '')}/connexion`
          : 'https://app.lyta.ch/connexion';

        emailData = {
          ...emailData,
          temporaryPassword,
          clientEmail,
          loginUrl,
        };

        console.log(`User account created for ${clientEmail}`);
      } else {
        console.log(`User already exists for ${clientEmail}, resetting password`);
        
        const newTemporaryPassword = generateTemporaryPassword();
        await supabaseAdmin.auth.admin.updateUserById(existingUser.id, { password: newTemporaryPassword });

        const { data: clientRecord } = await supabaseAdmin
          .from('clients')
          .select('id, user_id')
          .eq('email', clientEmail)
          .single();

        if (clientRecord && !clientRecord.user_id) {
          await supabaseAdmin
            .from('clients')
            .update({ user_id: existingUser.id })
            .eq('id', clientRecord.id);
        }

        const loginUrl = branding?.company_website 
          ? `https://${branding.company_website.replace(/^https?:\/\//, '')}/connexion`
          : 'https://app.lyta.ch/connexion';

        emailData = {
          ...emailData,
          temporaryPassword: newTemporaryPassword,
          clientEmail,
          loginUrl,
        };
      }
    }

    // Get email content with branding
    const { subject, html } = getEmailContent(type, clientName, emailData, branding, tenantName);

    // Determine sender
    const senderName = branding?.email_sender_name || branding?.display_name || tenantName;
    const senderEmail = branding?.email_sender_address;
    const fromAddress = senderEmail && senderEmail.includes('@') 
      ? `${senderName} <${senderEmail}>`
      : `${senderName} <onboarding@resend.dev>`;

    // Send email via Resend API
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [clientEmail],
        subject,
        html,
      }),
    });
    
    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      throw new Error(`Resend API error: ${errorText}`);
    }
    
    const emailResult = await emailResponse.json();

    console.log("Email sent successfully:", emailResult);

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailId: emailResult.id,
        userCreated: createdUserId !== null,
        userId: createdUserId,
        sender: senderName,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("Error in send-crm-email function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
