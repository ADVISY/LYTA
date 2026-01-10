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
  default_language: string | null;
}

type SupportedLanguage = 'fr' | 'de' | 'it' | 'en';

// Translations for emails
const translations: Record<SupportedLanguage, {
  renewal: {
    title: string;
    greeting: (name: string) => string;
    body: (product: string, date: string) => string;
    cta: string;
    contactUs: string;
  };
  followUp: {
    title: string;
    greeting: (name: string) => string;
    body: (clientName: string) => string;
    cta: string;
  };
  birthday: {
    title: string;
    greeting: (name: string) => string;
    body: (company: string) => string;
    thanks: string;
    wish: string;
  };
  footer: (company: string, year: number) => string;
}> = {
  fr: {
    renewal: {
      title: "Rappel de renouvellement",
      greeting: (name) => `Bonjour ${name},`,
      body: (product, date) => `Nous vous informons que votre contrat <strong>${product}</strong> arrive à échéance le <strong>${date}</strong>.`,
      cta: "Afin de vous assurer une continuité de couverture, nous vous invitons à prendre contact avec votre conseiller pour discuter du renouvellement de votre contrat.",
      contactUs: "Nous contacter"
    },
    followUp: {
      title: "Rappel de suivi",
      greeting: (name) => `Bonjour ${name},`,
      body: (clientName) => `Vous avez un suivi prévu aujourd'hui pour <strong>${clientName}</strong>.`,
      cta: "N'oubliez pas de mettre à jour le statut du suivi une fois terminé."
    },
    birthday: {
      title: "🎂 Joyeux anniversaire !",
      greeting: (name) => `Cher(e) ${name},`,
      body: (company) => `Toute l'équipe de ${company} vous souhaite un très joyeux anniversaire !`,
      thanks: "Nous vous remercions pour votre confiance et restons à votre disposition pour toute question concernant vos assurances.",
      wish: "Excellente journée ! 🎉"
    },
    footer: (company, year) => `© ${year} ${company}. Tous droits réservés.`
  },
  de: {
    renewal: {
      title: "Erneuerungserinnerung",
      greeting: (name) => `Guten Tag ${name},`,
      body: (product, date) => `Wir informieren Sie, dass Ihr Vertrag <strong>${product}</strong> am <strong>${date}</strong> abläuft.`,
      cta: "Um eine Kontinuität des Versicherungsschutzes zu gewährleisten, kontaktieren Sie bitte Ihren Berater, um die Verlängerung Ihres Vertrags zu besprechen.",
      contactUs: "Kontaktieren Sie uns"
    },
    followUp: {
      title: "Nachverfolgungs-Erinnerung",
      greeting: (name) => `Guten Tag ${name},`,
      body: (clientName) => `Sie haben heute eine Nachverfolgung geplant für <strong>${clientName}</strong>.`,
      cta: "Vergessen Sie nicht, den Nachverfolgungsstatus nach Abschluss zu aktualisieren."
    },
    birthday: {
      title: "🎂 Herzlichen Glückwunsch zum Geburtstag!",
      greeting: (name) => `Liebe(r) ${name},`,
      body: (company) => `Das gesamte Team von ${company} wünscht Ihnen alles Gute zum Geburtstag!`,
      thanks: "Wir danken Ihnen für Ihr Vertrauen und stehen Ihnen für alle Fragen zu Ihren Versicherungen zur Verfügung.",
      wish: "Einen wunderschönen Tag! 🎉"
    },
    footer: (company, year) => `© ${year} ${company}. Alle Rechte vorbehalten.`
  },
  it: {
    renewal: {
      title: "Promemoria di rinnovo",
      greeting: (name) => `Buongiorno ${name},`,
      body: (product, date) => `La informiamo che il suo contratto <strong>${product}</strong> scade il <strong>${date}</strong>.`,
      cta: "Per garantire la continuità della copertura, la invitiamo a contattare il suo consulente per discutere il rinnovo del contratto.",
      contactUs: "Contattaci"
    },
    followUp: {
      title: "Promemoria follow-up",
      greeting: (name) => `Buongiorno ${name},`,
      body: (clientName) => `Hai un follow-up programmato oggi per <strong>${clientName}</strong>.`,
      cta: "Non dimenticare di aggiornare lo stato del follow-up una volta completato."
    },
    birthday: {
      title: "🎂 Buon compleanno!",
      greeting: (name) => `Caro/a ${name},`,
      body: (company) => `Tutto il team di ${company} ti augura un felicissimo compleanno!`,
      thanks: "Ti ringraziamo per la tua fiducia e restiamo a tua disposizione per qualsiasi domanda sulle tue assicurazioni.",
      wish: "Ottima giornata! 🎉"
    },
    footer: (company, year) => `© ${year} ${company}. Tutti i diritti riservati.`
  },
  en: {
    renewal: {
      title: "Renewal reminder",
      greeting: (name) => `Hello ${name},`,
      body: (product, date) => `We inform you that your <strong>${product}</strong> contract expires on <strong>${date}</strong>.`,
      cta: "To ensure continuity of coverage, please contact your advisor to discuss the renewal of your contract.",
      contactUs: "Contact us"
    },
    followUp: {
      title: "Follow-up reminder",
      greeting: (name) => `Hello ${name},`,
      body: (clientName) => `You have a follow-up scheduled today for <strong>${clientName}</strong>.`,
      cta: "Don't forget to update the follow-up status once completed."
    },
    birthday: {
      title: "🎂 Happy birthday!",
      greeting: (name) => `Dear ${name},`,
      body: (company) => `The entire team at ${company} wishes you a very happy birthday!`,
      thanks: "We thank you for your trust and remain at your disposal for any questions regarding your insurance.",
      wish: "Have a great day! 🎉"
    },
    footer: (company, year) => `© ${year} ${company}. All rights reserved.`
  }
};

// Subject translations
const subjectTranslations: Record<SupportedLanguage, {
  renewal: (productName: string) => string;
  followUp: (title: string) => string;
  birthday: (clientName: string) => string;
}> = {
  fr: {
    renewal: (productName) => `Rappel: Votre contrat ${productName} arrive à échéance`,
    followUp: (title) => `Rappel: Suivi prévu - ${title}`,
    birthday: (clientName) => `🎂 Joyeux anniversaire ${clientName} !`
  },
  de: {
    renewal: (productName) => `Erinnerung: Ihr Vertrag ${productName} läuft ab`,
    followUp: (title) => `Erinnerung: Geplante Nachverfolgung - ${title}`,
    birthday: (clientName) => `🎂 Herzlichen Glückwunsch zum Geburtstag ${clientName}!`
  },
  it: {
    renewal: (productName) => `Promemoria: Il tuo contratto ${productName} sta per scadere`,
    followUp: (title) => `Promemoria: Follow-up programmato - ${title}`,
    birthday: (clientName) => `🎂 Buon compleanno ${clientName}!`
  },
  en: {
    renewal: (productName) => `Reminder: Your ${productName} contract is expiring`,
    followUp: (title) => `Reminder: Scheduled follow-up - ${title}`,
    birthday: (clientName) => `🎂 Happy birthday ${clientName}!`
  }
};

function getLanguage(preferredLang: string | null, tenantDefault: string | null): SupportedLanguage {
  const lang = preferredLang || tenantDefault || 'fr';
  if (['fr', 'de', 'it', 'en'].includes(lang)) {
    return lang as SupportedLanguage;
  }
  return 'fr';
}

function formatDate(dateString: string, lang: SupportedLanguage): string {
  const date = new Date(dateString);
  const locales: Record<SupportedLanguage, string> = {
    fr: 'fr-CH',
    de: 'de-CH',
    it: 'it-CH',
    en: 'en-GB'
  };
  return date.toLocaleDateString(locales[lang]);
}

function generateEmailWrapper(content: string, branding: TenantBranding, lang: SupportedLanguage): string {
  const primaryColor = branding.primary_color || '#0EA5E9';
  const companyName = branding.display_name || 'Lyta';
  const logoUrl = branding.logo_url || 'https://hjedkkpmfzhtdzotskiv.supabase.co/storage/v1/object/public/documents/lyta-logo.png';
  const footerText = branding.email_footer_text || translations[lang].footer(companyName, new Date().getFullYear());
  
  const langAttr: Record<SupportedLanguage, string> = {
    fr: 'fr',
    de: 'de',
    it: 'it',
    en: 'en'
  };
  
  return `
    <!DOCTYPE html>
    <html lang="${langAttr[lang]}">
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
                  ${branding.company_phone ? `<p style="margin: 5px 0 0 0; color: #94a3b8; font-size: 12px;">Tel: ${branding.company_phone}</p>` : ''}
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

function generateRenewalReminderContent(policyData: any, branding: TenantBranding, lang: SupportedLanguage): string {
  const primaryColor = branding.primary_color || '#0EA5E9';
  const clientName = policyData.client_name || translations[lang].birthday.greeting('').replace(/[,:]/, '').trim();
  const endDate = formatDate(policyData.end_date, lang);
  const productName = policyData.product_name || '';
  const t = translations[lang].renewal;
  
  return `
    <h1 style="margin: 0 0 20px 0; color: #1e293b; font-size: 24px;">${t.title}</h1>
    <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
      ${t.greeting(clientName)}
    </p>
    <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
      ${t.body(productName, endDate)}
    </p>
    <p style="margin: 0 0 30px 0; color: #475569; font-size: 16px; line-height: 1.6;">
      ${t.cta}
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
      <tr>
        <td style="background-color: ${primaryColor}; border-radius: 8px;">
          <a href="${branding.company_website || '#'}" style="display: inline-block; padding: 14px 30px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px;">
            ${t.contactUs}
          </a>
        </td>
      </tr>
    </table>
  `;
}

function generateFollowUpReminderContent(suiviData: any, branding: TenantBranding, lang: SupportedLanguage): string {
  const primaryColor = branding.primary_color || '#0EA5E9';
  const agentName = suiviData.agent_name || '';
  const clientName = suiviData.client_name || '';
  const title = suiviData.title || '';
  const description = suiviData.description || '';
  const t = translations[lang].followUp;
  
  return `
    <h1 style="margin: 0 0 20px 0; color: #1e293b; font-size: 24px;">${t.title}</h1>
    <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
      ${t.greeting(agentName)}
    </p>
    <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
      ${t.body(clientName)}
    </p>
    <div style="background-color: #f8fafc; border-left: 4px solid ${primaryColor}; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <h3 style="margin: 0 0 10px 0; color: #1e293b; font-size: 18px;">${title}</h3>
      ${description ? `<p style="margin: 0; color: #64748b; font-size: 14px;">${description}</p>` : ''}
    </div>
    <p style="margin: 20px 0 0 0; color: #475569; font-size: 16px; line-height: 1.6;">
      ${t.cta}
    </p>
  `;
}

function generateBirthdayContent(clientData: any, branding: TenantBranding, lang: SupportedLanguage): string {
  const primaryColor = branding.primary_color || '#0EA5E9';
  const clientName = clientData.name || '';
  const companyName = branding.display_name || 'Lyta';
  const t = translations[lang].birthday;
  
  return `
    <h1 style="margin: 0 0 20px 0; color: #1e293b; font-size: 24px;">${t.title}</h1>
    <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
      ${t.greeting(clientName)}
    </p>
    <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
      ${t.body(companyName)}
    </p>
    <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
      ${t.thanks}
    </p>
    <p style="margin: 20px 0 0 0; color: ${primaryColor}; font-size: 18px; font-weight: 600; text-align: center;">
      ${t.wish}
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
        let lang: SupportedLanguage = 'fr';

        if (email.email_type === 'renewal_reminder' && email.target_type === 'policy') {
          // Get policy data with client info
          const { data: policy } = await supabase
            .from('policies')
            .select(`
              *,
              client:clients(first_name, last_name, email, company_name, user_id),
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
            
            // Get user preferred language if exists
            if (clientData.user_id) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('preferred_language')
                .eq('id', clientData.user_id)
                .single();
              
              lang = getLanguage(profile?.preferred_language, tenantBranding.default_language);
            } else {
              lang = getLanguage(null, tenantBranding.default_language);
            }
            
            subject = subjectTranslations[lang].renewal((policy.product as any)?.name || '');
            emailContent = generateRenewalReminderContent({
              client_name: recipientName,
              end_date: policy.end_date,
              product_name: (policy.product as any)?.name
            }, tenantBranding, lang);
          }
        } else if (email.email_type === 'follow_up' && email.target_type === 'suivi') {
          // Get suivi data with client and agent info
          const { data: suivi } = await supabase
            .from('suivis')
            .select(`
              *,
              client:clients(first_name, last_name, email),
              agent:profiles!suivis_assigned_agent_id_fkey(first_name, last_name, email, preferred_language)
            `)
            .eq('id', email.target_id)
            .single();

          if (suivi && suivi.agent) {
            const agentData = suivi.agent as any;
            const clientData = suivi.client as any;
            recipientEmail = agentData.email;
            recipientName = `${agentData.first_name || ''} ${agentData.last_name || ''}`.trim();
            
            // Use agent's preferred language
            lang = getLanguage(agentData.preferred_language, tenantBranding.default_language);
            
            const clientName = clientData ? 
              `${clientData.first_name || ''} ${clientData.last_name || ''}`.trim() : 
              '';
            
            subject = subjectTranslations[lang].followUp(suivi.title);
            emailContent = generateFollowUpReminderContent({
              agent_name: recipientName,
              client_name: clientName,
              title: suivi.title,
              description: suivi.description
            }, tenantBranding, lang);
          }
        } else if (email.email_type === 'birthday' && email.target_type === 'client') {
          // Get client data
          const { data: client } = await supabase
            .from('clients')
            .select('first_name, last_name, email, company_name, user_id')
            .eq('id', email.target_id)
            .single();

          if (client) {
            recipientEmail = client.email;
            recipientName = client.first_name ? 
              `${client.first_name} ${client.last_name || ''}` : 
              client.company_name || '';
            
            // Get user preferred language if exists
            if (client.user_id) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('preferred_language')
                .eq('id', client.user_id)
                .single();
              
              lang = getLanguage(profile?.preferred_language, tenantBranding.default_language);
            } else {
              lang = getLanguage(null, tenantBranding.default_language);
            }
            
            subject = subjectTranslations[lang].birthday(recipientName);
            emailContent = generateBirthdayContent({
              name: recipientName
            }, tenantBranding, lang);
          }
        }

        if (recipientEmail && emailContent) {
          const senderName = tenantBranding.email_sender_name || 'Lyta';
          const senderEmail = tenantBranding.email_sender_address || 'onboarding@resend.dev';
          const fromAddress = senderEmail.includes('@resend.dev') || senderEmail.includes('@') 
            ? `${senderName} <${senderEmail}>` 
            : `${senderName} <onboarding@resend.dev>`;

          const html = generateEmailWrapper(emailContent, tenantBranding, lang);

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
            console.log(`Email ${email.id} sent successfully to ${recipientEmail} in ${lang}`);
            await supabase
              .from('scheduled_emails')
              .update({ 
                status: 'sent', 
                sent_at: new Date().toISOString() 
              })
              .eq('id', email.id);
          }

          results.push({ id: email.id, status: sendError ? 'failed' : 'sent', language: lang });
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
