import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailData {
  contractDetails?: string;
  companyName?: string;
  agentName?: string;
  temporaryPassword?: string;
  loginUrl?: string;
  clientEmail?: string;
}

interface EmailRequest {
  type: "welcome" | "contract_signed" | "mandat_signed" | "account_created" | "relation_client" | "offre_speciale";
  clientEmail: string;
  clientName: string;
  data?: EmailData;
}

// Advisy branded email wrapper
const getEmailWrapper = (content: string) => `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Advisy</title>
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
      background: linear-gradient(135deg, #1800AD 0%, #4F46E5 50%, #7C3AED 100%);
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
    }
    
    .logo {
      width: 160px;
      height: auto;
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
      color: #1800AD;
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
      border-left: 4px solid #1800AD;
      padding: 20px 24px;
      margin: 24px 0;
      border-radius: 0 12px 12px 0;
    }
    
    .highlight-box strong {
      color: #1800AD;
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
      display: flex;
      align-items: center;
      gap: 8px;
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
      display: flex;
      align-items: flex-start;
      gap: 6px;
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
      color: #1800AD;
      font-weight: 700;
      font-size: 16px;
    }
    
    .cta-container {
      text-align: center;
      margin: 32px 0;
    }
    
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #1800AD 0%, #4F46E5 100%);
      color: #ffffff !important;
      padding: 16px 40px;
      text-decoration: none;
      border-radius: 50px;
      font-weight: 600;
      font-size: 15px;
      letter-spacing: 0.3px;
      box-shadow: 0 4px 14px rgba(24, 0, 173, 0.35);
      transition: all 0.3s ease;
    }
    
    .cta-button:hover {
      box-shadow: 0 6px 20px rgba(24, 0, 173, 0.45);
      transform: translateY(-1px);
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
      color: #1800AD;
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
      color: #1800AD;
      font-size: 16px;
    }
    
    .footer {
      background: #f8fafc;
      padding: 32px 40px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    
    .footer-logo {
      width: 100px;
      margin-bottom: 16px;
    }
    
    .footer-text {
      color: #6b7280;
      font-size: 13px;
      margin: 8px 0;
      line-height: 1.6;
    }
    
    .footer-links {
      margin-top: 16px;
    }
    
    .footer-link {
      color: #1800AD;
      text-decoration: none;
      font-size: 13px;
      font-weight: 500;
    }
    
    .footer-divider {
      color: #d1d5db;
      margin: 0 12px;
    }
    
    .social-links {
      margin-top: 20px;
    }
    
    .social-link {
      display: inline-block;
      margin: 0 8px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      ${content}
      
      <!-- Signature & Footer -->
      <div class="footer">
        <img src="https://e-advisy.ch/advisy-logo.png" alt="Advisy" class="footer-logo" />
        <p class="footer-text">
          <strong>Advisy Sàrl</strong><br>
          Votre partenaire assurance en Suisse romande
        </p>
        <p class="footer-text">
          📍 Rue de Lausanne 15, 1950 Sion<br>
          📞 +41 27 123 45 67
        </p>
        <div class="footer-links">
          <a href="https://e-advisy.ch" class="footer-link">www.e-advisy.ch</a>
          <span class="footer-divider">|</span>
          <a href="mailto:hello@e-advisy.ch" class="footer-link">hello@e-advisy.ch</a>
        </div>
        <p class="footer-text" style="margin-top: 24px; font-size: 11px; color: #9ca3af;">
          Cet email a été envoyé automatiquement. Merci de ne pas répondre directement à ce message.<br>
          © ${new Date().getFullYear()} Advisy Sàrl. Tous droits réservés.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
`;

// Email templates
const getEmailContent = (type: string, clientName: string, data?: EmailData) => {
  switch (type) {
    case "welcome":
      return {
        subject: "🎉 Bienvenue chez Advisy - Votre partenaire assurance",
        html: getEmailWrapper(`
          <div class="header">
            <div class="logo-container">
              <img src="https://e-advisy.ch/advisy-logo.png" alt="Advisy" class="logo" />
            </div>
            <h1 class="header-title">Bienvenue chez Advisy !</h1>
            <p class="header-subtitle">Votre nouveau partenaire assurance en Suisse</p>
          </div>
          <div class="content">
            <p class="greeting">Bonjour ${clientName} 👋</p>
            <p class="text">
              Nous sommes ravis de vous accueillir parmi nos clients ! Merci de nous avoir fait confiance pour vous accompagner dans la gestion de vos assurances.
            </p>
            <div class="highlight-box">
              <strong>Votre conseiller Advisy</strong> est désormais à votre disposition pour vous accompagner dans toutes vos démarches d'assurance en Suisse.
            </div>
            <p class="text">Chez Advisy, nous nous engageons à :</p>
            <ul class="features-list">
              <li>Analyser vos besoins en assurance de manière personnalisée</li>
              <li>Comparer les meilleures offres du marché suisse</li>
              <li>Vous accompagner dans toutes vos démarches administratives</li>
              <li>Optimiser vos primes et votre couverture</li>
            </ul>
            <p class="text">
              Votre conseiller vous contactera prochainement pour planifier un premier entretien et faire le point sur votre situation.
            </p>
            <div class="signature">
              <p class="signature-text">À très bientôt,</p>
              <p class="signature-name">L'équipe Advisy</p>
            </div>
          </div>
        `),
      };

    case "contract_signed":
      return {
        subject: "✅ Confirmation de signature - Votre contrat Advisy",
        html: getEmailWrapper(`
          <div class="header">
            <div class="logo-container">
              <img src="https://e-advisy.ch/advisy-logo.png" alt="Advisy" class="logo" />
            </div>
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
            <p class="text">
              Si vous avez des questions concernant votre contrat, n'hésitez pas à contacter ${data?.agentName ? `votre conseiller <strong>${data.agentName}</strong>` : 'votre conseiller'} ou notre équipe.
            </p>
            <div class="signature">
              <p class="signature-text">Cordialement,</p>
              <p class="signature-name">L'équipe Advisy</p>
            </div>
          </div>
        `),
      };

    case "mandat_signed":
      return {
        subject: "🔐 Votre espace client Advisy est prêt !",
        html: getEmailWrapper(`
          <div class="header">
            <div class="logo-container">
              <img src="https://e-advisy.ch/advisy-logo.png" alt="Advisy" class="logo" />
            </div>
            <h1 class="header-title">Mandat de gestion activé</h1>
            <p class="header-subtitle">Votre espace client personnel est prêt</p>
          </div>
          <div class="content">
            <p class="greeting">Bonjour ${clientName} 👋</p>
            <div class="success-box">
              <strong>Votre mandat de gestion a été signé avec succès !</strong><br>
              Advisy est désormais mandaté pour gérer et optimiser votre portefeuille d'assurances.
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
              <a href="${data?.loginUrl || 'https://e-advisy.ch/connexion'}" class="cta-button">
                Accéder à mon espace client →
              </a>
            </div>
            <p class="text" style="text-align: center; color: #6b7280; font-size: 14px;">
              Si vous avez des questions, notre équipe est à votre entière disposition.
            </p>
            <div class="signature">
              <p class="signature-text">Cordialement,</p>
              <p class="signature-name">L'équipe Advisy</p>
            </div>
          </div>
        `),
      };

    case "account_created":
      return {
        subject: "🔑 Votre compte Advisy a été créé",
        html: getEmailWrapper(`
          <div class="header">
            <div class="logo-container">
              <img src="https://e-advisy.ch/advisy-logo.png" alt="Advisy" class="logo" />
            </div>
            <h1 class="header-title">Votre compte est prêt !</h1>
            <p class="header-subtitle">Connectez-vous à votre espace personnel</p>
          </div>
          <div class="content">
            <p class="greeting">Bonjour ${clientName} 👋</p>
            <p class="text">
              Votre compte client Advisy a été créé avec succès. Vous pouvez maintenant accéder à votre espace personnel pour gérer vos assurances.
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
              <a href="${data?.loginUrl || 'https://e-advisy.ch/connexion'}" class="cta-button">
                Se connecter maintenant →
              </a>
            </div>
            <div class="signature">
              <p class="signature-text">Cordialement,</p>
              <p class="signature-name">L'équipe Advisy</p>
            </div>
          </div>
        `),
      };

    case "relation_client":
      return {
        subject: "💬 Votre conseiller Advisy prend de vos nouvelles",
        html: getEmailWrapper(`
          <div class="header">
            <div class="logo-container">
              <img src="https://e-advisy.ch/advisy-logo.png" alt="Advisy" class="logo" />
            </div>
            <h1 class="header-title">Comment allez-vous ?</h1>
            <p class="header-subtitle">Votre conseiller Advisy pense à vous</p>
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
            <div class="cta-container">
              <a href="https://e-advisy.ch" class="cta-button">
                Prendre rendez-vous →
              </a>
            </div>
            <p class="text" style="text-align: center; color: #6b7280; font-size: 14px;">
              Nous sommes là pour vous accompagner à chaque étape de votre vie.
            </p>
            <div class="signature">
              <p class="signature-text">Chaleureusement,</p>
              <p class="signature-name">L'équipe Advisy</p>
            </div>
          </div>
        `),
      };

    case "offre_speciale":
      return {
        subject: "🎁 Offre exclusive pour vous - Économisez sur vos assurances !",
        html: getEmailWrapper(`
          <div class="header">
            <div class="logo-container">
              <img src="https://e-advisy.ch/advisy-logo.png" alt="Advisy" class="logo" />
            </div>
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
              <span style="color: #78350f;">Profitez de tarifs préférentiels sur plusieurs types d'assurances jusqu'à la fin du mois !</span>
            </div>
            <p class="text">Nos offres du moment :</p>
            <ul class="features-list">
              <li><strong>Assurance Santé :</strong> Jusqu'à 15% de réduction sur les complémentaires</li>
              <li><strong>3e Pilier :</strong> Bonus de bienvenue pour toute nouvelle souscription</li>
              <li><strong>Assurance Auto :</strong> -10% sur votre première année</li>
              <li><strong>RC Ménage :</strong> Couverture premium au prix standard</li>
            </ul>
            <div class="cta-container">
              <a href="https://e-advisy.ch" class="cta-button" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
                Découvrir les offres →
              </a>
            </div>
            <p class="text" style="text-align: center; color: #6b7280; font-size: 14px;">
              Contactez-nous pour bénéficier de ces offres exclusives réservées à nos clients.
            </p>
            <div class="signature">
              <p class="signature-text">À très bientôt,</p>
              <p class="signature-name">L'équipe Advisy</p>
            </div>
          </div>
        `),
      };

    default:
      return {
        subject: "Notification Advisy",
        html: getEmailWrapper(`
          <div class="header">
            <div class="logo-container">
              <img src="https://e-advisy.ch/advisy-logo.png" alt="Advisy" class="logo" />
            </div>
            <h1 class="header-title">Notification</h1>
          </div>
          <div class="content">
            <p class="greeting">Bonjour ${clientName},</p>
            <p class="text">Vous avez une nouvelle notification d'Advisy.</p>
            <div class="signature">
              <p class="signature-text">Cordialement,</p>
              <p class="signature-name">L'équipe Advisy</p>
            </div>
          </div>
        `),
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
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, clientEmail, clientName, data }: EmailRequest = await req.json();

    console.log(`Processing email request: type=${type}, email=${clientEmail}, name=${clientName}`);

    if (!clientEmail || !clientName || !type) {
      throw new Error("Missing required fields: type, clientEmail, clientName");
    }

    let emailData: EmailData = data || {};
    let createdUserId: string | null = null;

    // If mandat signed, create user account first
    if (type === "mandat_signed" && !data?.temporaryPassword) {
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      const temporaryPassword = generateTemporaryPassword();
      
      // Check if user already exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find((u: { email?: string }) => u.email === clientEmail);

      if (!existingUser) {
        // Create new user account
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

        // Assign 'client' role
        if (createdUserId) {
          const { error: roleError } = await supabaseAdmin
            .from('user_roles')
            .insert({ user_id: createdUserId, role: 'client' });

          if (roleError) {
            console.error("Error assigning role:", roleError);
          }

          // Link to existing client record if exists
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

        emailData = {
          ...emailData,
          temporaryPassword,
          clientEmail,
          loginUrl: `${Deno.env.get("SITE_URL") || "https://e-advisy.ch"}/connexion`,
        };

        console.log(`User account created for ${clientEmail}`);
      } else {
        console.log(`User already exists for ${clientEmail}, skipping account creation`);
        emailData = {
          ...emailData,
          clientEmail,
          loginUrl: `${Deno.env.get("SITE_URL") || "https://e-advisy.ch"}/connexion`,
        };
      }
    }

    // Get email content
    const { subject, html } = getEmailContent(type, clientName, emailData);

    // Send email via Resend API
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Advisy <hello@e-advisy.ch>",
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
