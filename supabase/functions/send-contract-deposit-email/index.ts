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

interface ContractData {
  formType: 'sana' | 'vita' | 'medio' | 'business';
  clientName: string;
  clientPrenom: string;
  clientEmail: string;
  clientTel: string;
  agentName: string;
  agentEmail: string;
  formData: Record<string, any>;
  documents: Array<{
    file_name: string;
    doc_kind: string;
    file_key: string;
  }>;
  tenantSlug?: string;
}

interface ContractDepositRequest {
  contractData: ContractData;
  notificationEmails?: string[];
}

const formTypeLabels: Record<string, string> = {
  sana: 'SANA - Assurance Maladie (LAMal/LCA)',
  vita: 'VITA - Prévoyance (3e pilier)',
  medio: 'MEDIO - RC/Ménage/Auto',
  business: 'BUSINESS - Assurance Entreprise',
};

const formatFormData = (formType: string, formData: Record<string, any>): string => {
  const lines: string[] = [];
  
  switch (formType) {
    case 'sana':
      if (formData.dateNaissance) lines.push(`<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Date de naissance:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${formData.dateNaissance}</td></tr>`);
      if (formData.assureurActuel) lines.push(`<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Assureur actuel:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${formData.assureurActuel}</td></tr>`);
      if (formData.lamalDateEffet) lines.push(`<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Date effet LAMal:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${formData.lamalDateEffet}</td></tr>`);
      if (formData.lcaDateEffet) lines.push(`<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Date effet LCA:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${formData.lcaDateEffet}</td></tr>`);
      if (formData.lcaProduction) lines.push(`<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Production LCA:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${formData.lcaProduction} CHF</td></tr>`);
      break;
    case 'vita':
      if (formData.vitaDateEffet) lines.push(`<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Date effet:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${formData.vitaDateEffet}</td></tr>`);
      if (formData.vitaDureeContrat) lines.push(`<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Durée contrat:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${formData.vitaDureeContrat} ans</td></tr>`);
      if (formData.vitaPrimeMensuelle) lines.push(`<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Prime mensuelle:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${formData.vitaPrimeMensuelle} CHF</td></tr>`);
      break;
    case 'medio':
      if (formData.rcPrivee) lines.push(`<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>RC Privée:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">Oui - ${formData.rcMontant ? (parseInt(formData.rcMontant)/1000000) + ' Mio CHF' : ''}</td></tr>`);
      if (formData.menage) lines.push(`<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Ménage:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">Oui - ${formData.menageMontant || ''} CHF</td></tr>`);
      if (formData.auto) lines.push(`<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Auto:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${formData.marqueVehicule || ''} ${formData.modeleVehicule || ''} (${formData.anneeVehicule || ''})</td></tr>`);
      if (formData.dateEffet) lines.push(`<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Date effet:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${formData.dateEffet}</td></tr>`);
      break;
    case 'business':
      if (formData.entrepriseNom) lines.push(`<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Entreprise:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${formData.entrepriseNom}</td></tr>`);
      if (formData.entrepriseActivite) lines.push(`<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Activité:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${formData.entrepriseActivite}</td></tr>`);
      if (formData.formeSociete) lines.push(`<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Forme société:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${formData.formeSociete.toUpperCase()}</td></tr>`);
      if (formData.chefPrenom && formData.chefNom) lines.push(`<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Chef d'entreprise:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${formData.chefPrenom} ${formData.chefNom}</td></tr>`);
      if (formData.rcEntreprise) lines.push(`<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>RC Entreprise:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">Oui - ${formData.rcSommeAssurance ? (parseInt(formData.rcSommeAssurance)/1000000) + ' Mio CHF' : ''}</td></tr>`);
      if (formData.laaObligatoire) lines.push(`<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>LAA Obligatoire:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">Oui</td></tr>`);
      if (formData.laaComplementaire) lines.push(`<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>LAA Complémentaire:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">Oui</td></tr>`);
      if (formData.perteGainMaladie) lines.push(`<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Perte de gain maladie:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">Oui</td></tr>`);
      if (formData.dateEffet) lines.push(`<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Date effet:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${formData.dateEffet}</td></tr>`);
      break;
  }
  
  if (formData.commentaires) {
    lines.push(`<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Commentaires:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${formData.commentaires}</td></tr>`);
  }
  
  return lines.join('\n');
};

const generateEmailHtml = (data: ContractData, branding: TenantBranding | null): string => {
  const formTypeLabel = formTypeLabels[data.formType] || data.formType.toUpperCase();
  const formattedData = formatFormData(data.formType, data.formData);
  const timestamp = new Date().toLocaleString('fr-CH', { 
    dateStyle: 'full', 
    timeStyle: 'short',
    timeZone: 'Europe/Zurich' 
  });

  // Use tenant branding or defaults
  const companyName = branding?.display_name || branding?.email_sender_name || 'LYTA';
  const primaryColor = branding?.primary_color || '#0066FF';
  const secondaryColor = branding?.secondary_color || '#1a1a2e';
  const logoUrl = branding?.logo_url || '';
  const companyAddress = branding?.company_address || '';
  const companyPhone = branding?.company_phone || '';
  const companyWebsite = branding?.company_website || '';
  const companyEmail = branding?.company_email || '';

  const documentsHtml = data.documents && data.documents.length > 0 
    ? `
      <div style="margin-top: 24px;">
        <h3 style="color: ${secondaryColor}; margin-bottom: 12px;">📎 Documents joints (${data.documents.length})</h3>
        <ul style="list-style: none; padding: 0; margin: 0;">
          ${data.documents.map(doc => `
            <li style="padding: 8px 12px; background: #f8f9fa; margin-bottom: 4px; border-radius: 4px;">
              📄 ${doc.file_name} <span style="color: #666; font-size: 12px;">(${doc.doc_kind || 'Document'})</span>
            </li>
          `).join('')}
        </ul>
      </div>
    `
    : '<p style="color: #666; font-style: italic;">Aucun document joint</p>';

  const logoHtml = logoUrl 
    ? `<img src="${logoUrl}" alt="${companyName}" style="height: 50px; max-width: 200px; object-fit: contain;" />`
    : `<span style="font-size: 28px; font-weight: 700; color: white;">${companyName}</span>`;

  const footerHtml = `
    <div style="text-align: center; padding: 20px; color: #666; font-size: 12px; background: #f8f9fa; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0 0 8px; font-weight: 600; color: ${primaryColor};">${companyName}</p>
      ${companyAddress ? `<p style="margin: 4px 0;">📍 ${companyAddress}</p>` : ''}
      ${companyPhone ? `<p style="margin: 4px 0;">📞 ${companyPhone}</p>` : ''}
      ${companyWebsite || companyEmail ? `
        <p style="margin: 8px 0;">
          ${companyWebsite ? `<a href="https://${companyWebsite.replace(/^https?:\/\//, '')}" style="color: ${primaryColor}; text-decoration: none;">${companyWebsite}</a>` : ''}
          ${companyWebsite && companyEmail ? ' | ' : ''}
          ${companyEmail ? `<a href="mailto:${companyEmail}" style="color: ${primaryColor}; text-decoration: none;">${companyEmail}</a>` : ''}
        </p>
      ` : ''}
      <p style="margin-top: 16px; color: #999; font-size: 11px;">
        Cet email a été envoyé automatiquement. © ${new Date().getFullYear()} ${companyName}. Tous droits réservés.
      </p>
    </div>
  `;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0; background: #f0f2f5;">
      <div style="background: linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%); padding: 30px; text-align: center;">
        ${logoHtml}
        <h1 style="color: white; margin: 16px 0 0; font-size: 22px;">🎉 Nouveau dépôt de contrat</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">${formTypeLabel}</p>
      </div>
      
      <div style="background: white; padding: 30px;">
        <div style="background: #f0f9ff; border-left: 4px solid ${primaryColor}; padding: 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
          <p style="margin: 0; font-size: 14px; color: #666;">
            <strong>Date de soumission:</strong> ${timestamp}
          </p>
        </div>

        <h2 style="color: ${secondaryColor}; border-bottom: 2px solid ${primaryColor}; padding-bottom: 8px; margin-top: 0;">👤 Information Client</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Nom:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${data.clientPrenom} ${data.clientName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Email:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><a href="mailto:${data.clientEmail}" style="color: ${primaryColor};">${data.clientEmail}</a></td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Téléphone:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><a href="tel:${data.clientTel}" style="color: ${primaryColor};">${data.clientTel || 'Non renseigné'}</a></td>
          </tr>
        </table>

        <h2 style="color: ${secondaryColor}; border-bottom: 2px solid ${primaryColor}; padding-bottom: 8px;">🏢 Agent / Collaborateur</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Nom:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${data.agentName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Email:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><a href="mailto:${data.agentEmail}" style="color: ${primaryColor};">${data.agentEmail}</a></td>
          </tr>
        </table>

        <h2 style="color: ${secondaryColor}; border-bottom: 2px solid ${primaryColor}; padding-bottom: 8px;">📋 Détails du contrat</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          ${formattedData}
        </table>

        ${documentsHtml}

        <div style="margin-top: 32px; padding: 20px; background: #f8f9fa; border-radius: 8px; text-align: center;">
          <p style="margin: 0; color: #666; font-size: 14px;">
            Ce dépôt nécessite votre validation. Veuillez vérifier les informations et les documents joints.
          </p>
        </div>
      </div>

      ${footerHtml}
    </body>
    </html>
  `;
};

const sendEmail = async (
  to: string, 
  subject: string, 
  html: string,
  senderName: string,
  senderEmail?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Use verified sender or fallback to resend.dev
    const fromAddress = senderEmail && senderEmail.includes('@') 
      ? `${senderName} <${senderEmail}>`
      : `${senderName} <onboarding@resend.dev>`;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [to],
        subject: subject,
        html: html,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`Failed to send email to ${to}:`, errorData);
      return { success: false, error: errorData };
    }

    const data = await response.json();
    console.log(`Email sent successfully to ${to}:`, data.id);
    return { success: true };
  } catch (error: any) {
    console.error(`Error sending email to ${to}:`, error);
    return { success: false, error: error.message };
  }
};

const handler = async (req: Request): Promise<Response> => {
  console.log("send-contract-deposit-email function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contractData, notificationEmails }: ContractDepositRequest = await req.json();

    console.log("Contract data received:", {
      formType: contractData.formType,
      clientName: contractData.clientName,
      agentName: contractData.agentName,
      tenantSlug: contractData.tenantSlug,
      documentsCount: contractData.documents?.length || 0,
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch tenant info and branding
    let emails = (notificationEmails || [])
      .map((e) => (typeof e === 'string' ? e.trim().toLowerCase() : ''))
      .filter((e) => e);
    let branding: TenantBranding | null = null;
    let tenantName = 'LYTA';
    
    if (contractData.tenantSlug) {
      console.log("Fetching tenant info:", contractData.tenantSlug);
      
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select(`
          name,
          contract_notification_emails,
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
        .eq('slug', contractData.tenantSlug)
        .single();

      if (tenantError) {
        console.error("Error fetching tenant:", tenantError);
      } else if (tenant) {
        tenantName = tenant.name;
        if (tenant.contract_notification_emails) {
          const tenantEmails = tenant.contract_notification_emails
            .map((e: string) => (typeof e === 'string' ? e.trim().toLowerCase() : ''))
            .filter((e: string) => e);
          emails = Array.from(new Set([...emails, ...tenantEmails]));
        }
        if (tenant.tenant_branding && tenant.tenant_branding.length > 0) {
          branding = tenant.tenant_branding[0];
        }
        console.log("Found tenant branding:", branding?.display_name || tenantName);
      }
    }

    if (!emails || emails.length === 0) {
      console.log("No notification emails configured, skipping email send");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No notification emails configured",
          emailsSent: 0 
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const formTypeLabel = formTypeLabels[contractData.formType] || contractData.formType.toUpperCase();
    const html = generateEmailHtml(contractData, branding);
    const senderName = branding?.email_sender_name || branding?.display_name || tenantName;
    const subject = `🆕 Nouveau dépôt ${formTypeLabel} - ${contractData.clientPrenom} ${contractData.clientName}`;

    console.log(`Sending email from "${senderName}" to ${emails.length} recipients:`, emails);

    const results = await Promise.all(
      emails.map((email: string) => sendEmail(
        email.trim(), 
        subject, 
        html, 
        senderName,
        branding?.email_sender_address || undefined
      ))
    );
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`Emails sent: ${successful} successful, ${failed} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailsSent: successful,
        emailsFailed: failed,
        recipients: emails,
        sender: senderName
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in send-contract-deposit-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
