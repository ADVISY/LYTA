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

interface PasswordResetRequest {
  email: string;
  redirectUrl: string;
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
    
    .warning-box {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border-left: 4px solid #f59e0b;
      padding: 20px 24px;
      margin: 24px 0;
      border-radius: 0 12px 12px 0;
    }
    
    .warning-box strong {
      color: #92400e;
    }
    
    .info-box {
      background: linear-gradient(135deg, #f0f4ff 0%, #e8f0fe 100%);
      border-left: 4px solid ${primaryColor};
      padding: 20px 24px;
      margin: 24px 0;
      border-radius: 0 12px 12px 0;
    }
    
    .info-box strong {
      color: ${primaryColor};
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
    
    .security-note {
      background: #f1f5f9;
      padding: 16px;
      border-radius: 8px;
      margin-top: 24px;
      font-size: 13px;
      color: #64748b;
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

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      console.error("Missing RESEND_API_KEY");
      throw new Error("Email service not configured");
    }

    const { email, redirectUrl }: PasswordResetRequest = await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    console.log("Processing password reset for:", email);

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Find the user by email
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (userError) {
      console.error("Error fetching users:", userError);
      throw new Error("Failed to verify email");
    }

    const user = userData.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      // Don't reveal if user exists or not for security
      console.log("User not found, returning success anyway for security");
      return new Response(
        JSON.stringify({ success: true, message: "If this email exists, a reset link has been sent" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get user's tenant for branding
    // Priority: 1) clients table (for client users), 2) user_tenant_assignments (for team users)
    let tenantId: string | null = null;

    // Check clients table first
    const { data: clientRow } = await supabaseAdmin
      .from("clients")
      .select("tenant_id")
      .eq("user_id", user.id)
      .not("tenant_id", "is", null)
      .limit(1)
      .maybeSingle();

    if (clientRow?.tenant_id) {
      tenantId = clientRow.tenant_id;
      console.log("Tenant resolved from clients table:", tenantId);
    }

    // Fallback to user_tenant_assignments
    if (!tenantId) {
      const { data: assignment } = await supabaseAdmin
        .from("user_tenant_assignments")
        .select("tenant_id")
        .eq("user_id", user.id)
        .not("tenant_id", "is", null)
        .limit(1)
        .maybeSingle();

      if (assignment?.tenant_id) {
        tenantId = assignment.tenant_id;
        console.log("Tenant resolved from user_tenant_assignments:", tenantId);
      }
    }

    let branding: TenantBranding | null = null;
    let tenantName = "Lyta";

    if (tenantId) {
      // Fetch tenant name + branding from tenant_branding table
      const { data: tenant } = await supabaseAdmin
        .from("tenants")
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
        .eq("id", tenantId)
        .maybeSingle();

      if (tenant) {
        tenantName = tenant.name || "Lyta";
        const tb = (tenant.tenant_branding as any)?.[0];
        if (tb) {
          branding = {
            display_name: tb.display_name,
            logo_url: tb.logo_url,
            primary_color: tb.primary_color,
            secondary_color: tb.secondary_color,
            email_sender_name: tb.email_sender_name,
            email_sender_address: tb.email_sender_address,
            company_address: tb.company_address,
            company_phone: tb.company_phone,
            company_website: tb.company_website,
            company_email: tb.company_email,
            email_footer_text: tb.email_footer_text,
          };
          console.log("Branding loaded for tenant:", tenantName);
        }
      }
    } else {
      console.log("No tenant found for user, using default Lyta branding");
    }

    // Generate password reset link using Supabase Admin API
    const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: email,
      options: {
        redirectTo: redirectUrl || `${Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '')}/reset-password`,
      },
    });

    if (resetError) {
      console.error("Error generating reset link:", resetError);
      throw new Error("Failed to generate password reset link");
    }

    const resetLink = resetData?.properties?.action_link;

    if (!resetLink) {
      throw new Error("Failed to generate reset link");
    }

    console.log("Reset link generated successfully");

    // Get user's name from profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .maybeSingle();

    const userName = profile?.first_name 
      ? `${profile.first_name}${profile.last_name ? ' ' + profile.last_name : ''}`
      : email.split('@')[0];

    const displayName = branding?.display_name || branding?.email_sender_name || tenantName;
    const primaryColor = branding?.primary_color || '#1800AD';
    const logoUrl = branding?.logo_url || '';

    const logoHtml = logoUrl 
      ? `<img src="${logoUrl}" alt="${displayName}" style="height: 40px; max-width: 160px; object-fit: contain;" />`
      : `<div style="font-size: 36px; font-weight: 700; color: #ffffff; letter-spacing: -1px;">${displayName}<span style="color: #7C3AED;">.</span></div>`;

    // Build email content with tenant branding
    const emailHtml = getEmailWrapper(`
      <div class="header">
        <div class="logo-container">${logoHtml}</div>
        <h1 class="header-title">Réinitialisation de mot de passe</h1>
        <p class="header-subtitle">Sécurisez votre compte ${displayName}</p>
      </div>
      <div class="content">
        <p class="greeting">Bonjour ${userName} 👋</p>
        <p class="text">
          Vous avez demandé la réinitialisation de votre mot de passe pour votre compte ${displayName}. 
          Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe.
        </p>
        
        <div class="cta-container">
          <a href="${resetLink}" class="cta-button">
            🔐 Réinitialiser mon mot de passe
          </a>
        </div>
        
        <div class="warning-box">
          <strong>⏰ Ce lien expire dans 1 heure</strong><br>
          Pour des raisons de sécurité, ce lien de réinitialisation n'est valable que pendant 60 minutes.
        </div>
        
        <div class="info-box">
          <strong>Vous n'avez pas demandé cette réinitialisation ?</strong><br>
          Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email en toute sécurité. 
          Votre mot de passe actuel reste inchangé.
        </div>
        
        <div class="security-note">
          🔒 <strong>Conseil de sécurité :</strong> Choisissez un mot de passe unique d'au moins 8 caractères, 
          incluant des lettres majuscules, minuscules, des chiffres et des caractères spéciaux.
        </div>
        
        <div class="signature">
          <p class="signature-text">Cordialement,</p>
          <p class="signature-name">L'équipe ${displayName}</p>
        </div>
      </div>
    `, branding, tenantName);

    // Determine sender
    const senderName = branding?.email_sender_name || displayName;
    const senderEmail = branding?.email_sender_address || "support@lyta.ch";

    // Send email via Resend
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${senderName} <${senderEmail}>`,
        to: [email],
        subject: `🔐 Réinitialisation de votre mot de passe ${displayName}`,
        html: emailHtml,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("Resend API error:", resendData);
      throw new Error(resendData.message || "Failed to send email");
    }

    console.log("Password reset email sent successfully:", resendData.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Password reset email sent",
        emailId: resendData.id 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in send-password-reset function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
