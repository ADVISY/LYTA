import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  vita: 'VITA - Assurance Vie (Prévoyance)',
  medio: 'MEDIO - Complémentaire Santé',
  business: 'BUSINESS - Assurance Entreprise',
};

const formatFormData = (formType: string, formData: Record<string, any>): string => {
  const lines: string[] = [];
  
  switch (formType) {
    case 'sana':
      if (formData.lamalDateEffet) lines.push(`<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Date effet LAMal:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${formData.lamalDateEffet}</td></tr>`);
      if (formData.lcaDateEffet) lines.push(`<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Date effet LCA:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${formData.lcaDateEffet}</td></tr>`);
      if (formData.lcaProduction) lines.push(`<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Production LCA:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${formData.lcaProduction} CHF</td></tr>`);
      break;
    case 'vita':
      if (formData.vitaDateEffet) lines.push(`<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Date effet:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${formData.vitaDateEffet}</td></tr>`);
      if (formData.vitaDureeContrat) lines.push(`<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Durée contrat:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${formData.vitaDureeContrat}</td></tr>`);
      if (formData.vitaPrimeMensuelle) lines.push(`<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Prime mensuelle:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${formData.vitaPrimeMensuelle} CHF</td></tr>`);
      break;
    case 'medio':
      if (formData.dateEffet) lines.push(`<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Date effet:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${formData.dateEffet}</td></tr>`);
      if (formData.typeCouverture) lines.push(`<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Type couverture:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${formData.typeCouverture}</td></tr>`);
      if (formData.production) lines.push(`<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Production:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${formData.production} CHF</td></tr>`);
      break;
    case 'business':
      if (formData.entrepriseNom) lines.push(`<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Entreprise:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${formData.entrepriseNom}</td></tr>`);
      if (formData.entrepriseActivite) lines.push(`<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Activité:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${formData.entrepriseActivite}</td></tr>`);
      if (formData.formeSociete) lines.push(`<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Forme société:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${formData.formeSociete}</td></tr>`);
      if (formData.chefPrenom && formData.chefNom) lines.push(`<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Chef d'entreprise:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${formData.chefPrenom} ${formData.chefNom}</td></tr>`);
      if (formData.dateEffet) lines.push(`<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Date effet:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${formData.dateEffet}</td></tr>`);
      break;
  }
  
  if (formData.commentaires) {
    lines.push(`<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Commentaires:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${formData.commentaires}</td></tr>`);
  }
  
  return lines.join('\n');
};

const generateEmailHtml = (data: ContractData): string => {
  const formTypeLabel = formTypeLabels[data.formType] || data.formType.toUpperCase();
  const formattedData = formatFormData(data.formType, data.formData);
  const timestamp = new Date().toLocaleString('fr-CH', { 
    dateStyle: 'full', 
    timeStyle: 'short',
    timeZone: 'Europe/Zurich' 
  });

  const documentsHtml = data.documents && data.documents.length > 0 
    ? `
      <div style="margin-top: 24px;">
        <h3 style="color: #1a1a2e; margin-bottom: 12px;">📎 Documents joints (${data.documents.length})</h3>
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

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #0066FF 0%, #1a1a2e 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🎉 Nouveau dépôt de contrat</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">${formTypeLabel}</p>
      </div>
      
      <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <div style="background: #f0f9ff; border-left: 4px solid #0066FF; padding: 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
          <p style="margin: 0; font-size: 14px; color: #666;">
            <strong>Date de soumission:</strong> ${timestamp}
          </p>
        </div>

        <h2 style="color: #1a1a2e; border-bottom: 2px solid #0066FF; padding-bottom: 8px; margin-top: 0;">👤 Information Client</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Nom:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${data.clientPrenom} ${data.clientName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Email:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><a href="mailto:${data.clientEmail}" style="color: #0066FF;">${data.clientEmail}</a></td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Téléphone:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><a href="tel:${data.clientTel}" style="color: #0066FF;">${data.clientTel || 'Non renseigné'}</a></td>
          </tr>
        </table>

        <h2 style="color: #1a1a2e; border-bottom: 2px solid #0066FF; padding-bottom: 8px;">🏢 Agent / Collaborateur</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Nom:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${data.agentName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Email:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><a href="mailto:${data.agentEmail}" style="color: #0066FF;">${data.agentEmail}</a></td>
          </tr>
        </table>

        <h2 style="color: #1a1a2e; border-bottom: 2px solid #0066FF; padding-bottom: 8px;">📋 Détails du contrat</h2>
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

      <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
        <p>LYTA - Plateforme de gestion d'assurances</p>
      </div>
    </body>
    </html>
  `;
};

const sendEmail = async (to: string, subject: string, html: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "LYTA Contrats <onboarding@resend.dev>",
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

  // Handle CORS preflight
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

    // If no notification emails provided, try to fetch from tenant
    let emails = notificationEmails || [];
    
    if ((!emails || emails.length === 0) && contractData.tenantSlug) {
      console.log("Fetching notification emails from tenant:", contractData.tenantSlug);
      
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data: tenant, error } = await supabase
        .from('tenants')
        .select('contract_notification_emails')
        .eq('slug', contractData.tenantSlug)
        .single();

      if (error) {
        console.error("Error fetching tenant:", error);
      } else if (tenant?.contract_notification_emails) {
        emails = tenant.contract_notification_emails.filter((e: string) => e && e.trim());
        console.log("Found notification emails:", emails);
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
    const html = generateEmailHtml(contractData);
    const subject = `🆕 Nouveau dépôt ${formTypeLabel} - ${contractData.clientPrenom} ${contractData.clientName}`;

    console.log(`Sending email to ${emails.length} recipients:`, emails);

    const results = await Promise.all(
      emails.map((email: string) => sendEmail(email.trim(), subject, html))
    );
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`Emails sent: ${successful} successful, ${failed} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailsSent: successful,
        emailsFailed: failed,
        recipients: emails 
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
