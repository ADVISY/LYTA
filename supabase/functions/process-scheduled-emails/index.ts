import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface ScheduledEmail {
  id: string;
  tenant_id: string;
  email_type: string;
  target_type: string;
  target_id: string;
  scheduled_for: string;
}

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

function generateEmailWrapper(content: string, branding: TenantBranding): string {
  const primaryColor = branding.primary_color || '#0EA5E9';
  const companyName = branding.display_name || 'Lyta';
  const logoUrl = branding.logo_url || 'https://hjedkkpmfzhtdzotskiv.supabase.co/storage/v1/object/public/documents/lyta-logo.png';
  const footerText = branding.email_footer_text || `© ${new Date().getFullYear()} ${companyName}. Tous droits réservés.`;
  
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Email</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
        <tr>
          <td style="padding: 40px 20px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%); padding: 30px; text-align: center;">
                  <img src="${logoUrl}" alt="${companyName}" style="max-height: 50px; max-width: 200px;">
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  ${content}
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                  <p style="margin: 0 0 10px 0; color: #64748b; font-size: 14px;">
                    ${footerText}
                  </p>
                  ${branding.company_address ? `<p style="margin: 0; color: #94a3b8; font-size: 12px;">${branding.company_address}</p>` : ''}
                  ${branding.company_phone ? `<p style="margin: 5px 0 0 0; color: #94a3b8; font-size: 12px;">Tél: ${branding.company_phone}</p>` : ''}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

function generateRenewalReminderContent(policyData: any, branding: TenantBranding): string {
  const primaryColor = branding.primary_color || '#0EA5E9';
  const clientName = policyData.client_name || 'Cher(e) client(e)';
  const endDate = new Date(policyData.end_date).toLocaleDateString('fr-CH');
  const productName = policyData.product_name || 'votre assurance';
  
  return `
    <h1 style="margin: 0 0 20px 0; color: #1e293b; font-size: 24px;">Rappel de renouvellement</h1>
    <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
      Bonjour ${clientName},
    </p>
    <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
      Nous vous informons que votre contrat <strong>${productName}</strong> arrive à échéance le <strong>${endDate}</strong>.
    </p>
    <p style="margin: 0 0 30px 0; color: #475569; font-size: 16px; line-height: 1.6;">
      Afin de vous assurer une continuité de couverture, nous vous invitons à prendre contact avec votre conseiller pour discuter du renouvellement de votre contrat.
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
      <tr>
        <td style="background-color: ${primaryColor}; border-radius: 8px;">
          <a href="${branding.company_website || '#'}" style="display: inline-block; padding: 14px 30px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px;">
            Nous contacter
          </a>
        </td>
      </tr>
    </table>
  `;
}

function generateFollowUpReminderContent(suiviData: any, branding: TenantBranding): string {
  const primaryColor = branding.primary_color || '#0EA5E9';
  const agentName = suiviData.agent_name || 'Conseiller';
  const clientName = suiviData.client_name || 'Client';
  const title = suiviData.title || 'Suivi à effectuer';
  const description = suiviData.description || '';
  
  return `
    <h1 style="margin: 0 0 20px 0; color: #1e293b; font-size: 24px;">Rappel de suivi</h1>
    <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
      Bonjour ${agentName},
    </p>
    <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
      Vous avez un suivi prévu aujourd'hui pour <strong>${clientName}</strong>.
    </p>
    <div style="background-color: #f8fafc; border-left: 4px solid ${primaryColor}; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <h3 style="margin: 0 0 10px 0; color: #1e293b; font-size: 18px;">${title}</h3>
      ${description ? `<p style="margin: 0; color: #64748b; font-size: 14px;">${description}</p>` : ''}
    </div>
    <p style="margin: 20px 0 0 0; color: #475569; font-size: 16px; line-height: 1.6;">
      N'oubliez pas de mettre à jour le statut du suivi une fois terminé.
    </p>
  `;
}

function generateBirthdayContent(clientData: any, branding: TenantBranding): string {
  const primaryColor = branding.primary_color || '#0EA5E9';
  const clientName = clientData.name || 'Cher(e) client(e)';
  const companyName = branding.display_name || 'Notre équipe';
  
  return `
    <h1 style="margin: 0 0 20px 0; color: #1e293b; font-size: 24px;">🎂 Joyeux anniversaire !</h1>
    <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
      Cher(e) ${clientName},
    </p>
    <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
      Toute l'équipe de ${companyName} vous souhaite un très joyeux anniversaire !
    </p>
    <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
      Nous vous remercions pour votre confiance et restons à votre disposition pour toute question concernant vos assurances.
    </p>
    <p style="margin: 20px 0 0 0; color: ${primaryColor}; font-size: 18px; font-weight: 600; text-align: center;">
      Excellente journée ! 🎉
    </p>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Processing scheduled emails...");

    // First, schedule new reminders
    await supabase.rpc('schedule_renewal_reminders');
    await supabase.rpc('schedule_follow_up_reminders');

    // Get pending emails that are due
    const { data: pendingEmails, error: fetchError } = await supabase
      .from('scheduled_emails')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .limit(50);

    if (fetchError) {
      console.error("Error fetching pending emails:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${pendingEmails?.length || 0} pending emails to process`);

    const results = [];

    for (const email of pendingEmails || []) {
      try {
        // Get tenant branding
        const { data: branding } = await supabase
          .from('tenant_branding')
          .select('*')
          .eq('tenant_id', email.tenant_id)
          .single();

        const tenantBranding: TenantBranding = branding || {};

        let emailContent = '';
        let subject = '';
        let recipientEmail = '';
        let recipientName = '';

        if (email.email_type === 'renewal_reminder' && email.target_type === 'policy') {
          // Get policy data with client info
          const { data: policy } = await supabase
            .from('policies')
            .select(`
              *,
              client:clients(first_name, last_name, email, company_name),
              product:insurance_products(name)
            `)
            .eq('id', email.target_id)
            .single();

          if (policy && policy.client) {
            const clientData = policy.client as any;
            recipientEmail = clientData.email;
            recipientName = clientData.first_name ? 
              `${clientData.first_name} ${clientData.last_name || ''}` : 
              clientData.company_name || '';
            
            subject = `Rappel: Votre contrat ${(policy.product as any)?.name || ''} arrive à échéance`;
            emailContent = generateRenewalReminderContent({
              client_name: recipientName,
              end_date: policy.end_date,
              product_name: (policy.product as any)?.name
            }, tenantBranding);
          }
        } else if (email.email_type === 'follow_up' && email.target_type === 'suivi') {
          // Get suivi data with client and agent info
          const { data: suivi } = await supabase
            .from('suivis')
            .select(`
              *,
              client:clients(first_name, last_name, email),
              agent:profiles!suivis_assigned_agent_id_fkey(first_name, last_name, email)
            `)
            .eq('id', email.target_id)
            .single();

          if (suivi && suivi.agent) {
            const agentData = suivi.agent as any;
            const clientData = suivi.client as any;
            recipientEmail = agentData.email;
            recipientName = `${agentData.first_name || ''} ${agentData.last_name || ''}`.trim();
            
            const clientName = clientData ? 
              `${clientData.first_name || ''} ${clientData.last_name || ''}`.trim() : 
              'Client';
            
            subject = `Rappel: Suivi prévu - ${suivi.title}`;
            emailContent = generateFollowUpReminderContent({
              agent_name: recipientName,
              client_name: clientName,
              title: suivi.title,
              description: suivi.description
            }, tenantBranding);
          }
        } else if (email.email_type === 'birthday' && email.target_type === 'client') {
          // Get client data
          const { data: client } = await supabase
            .from('clients')
            .select('first_name, last_name, email, company_name')
            .eq('id', email.target_id)
            .single();

          if (client) {
            recipientEmail = client.email;
            recipientName = client.first_name ? 
              `${client.first_name} ${client.last_name || ''}` : 
              client.company_name || '';
            
            subject = `🎂 Joyeux anniversaire ${recipientName} !`;
            emailContent = generateBirthdayContent({
              name: recipientName
            }, tenantBranding);
          }
        }

        if (recipientEmail && emailContent) {
          const senderName = tenantBranding.email_sender_name || 'Lyta';
          const senderEmail = tenantBranding.email_sender_address || 'onboarding@resend.dev';
          const fromAddress = senderEmail.includes('@resend.dev') || senderEmail.includes('@') 
            ? `${senderName} <${senderEmail}>` 
            : `${senderName} <onboarding@resend.dev>`;

          const html = generateEmailWrapper(emailContent, tenantBranding);

          const { error: sendError } = await resend.emails.send({
            from: fromAddress,
            to: [recipientEmail],
            subject: subject,
            html: html,
          });

          if (sendError) {
            console.error(`Error sending email ${email.id}:`, sendError);
            await supabase
              .from('scheduled_emails')
              .update({ 
                status: 'failed', 
                error_message: sendError.message 
              })
              .eq('id', email.id);
          } else {
            console.log(`Email ${email.id} sent successfully to ${recipientEmail}`);
            await supabase
              .from('scheduled_emails')
              .update({ 
                status: 'sent', 
                sent_at: new Date().toISOString() 
              })
              .eq('id', email.id);
          }

          results.push({ id: email.id, status: sendError ? 'failed' : 'sent' });
        } else {
          console.log(`Email ${email.id} skipped - no recipient or content`);
          await supabase
            .from('scheduled_emails')
            .update({ 
              status: 'failed', 
              error_message: 'No recipient email or content available' 
            })
            .eq('id', email.id);
          results.push({ id: email.id, status: 'skipped' });
        }
      } catch (emailError) {
        console.error(`Error processing email ${email.id}:`, emailError);
        await supabase
          .from('scheduled_emails')
          .update({ 
            status: 'failed', 
            error_message: emailError instanceof Error ? emailError.message : 'Unknown error' 
          })
          .eq('id', email.id);
        results.push({ id: email.id, status: 'error' });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: results.length,
        results 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in process-scheduled-emails:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
