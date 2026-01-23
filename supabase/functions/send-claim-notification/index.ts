import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ClaimNotificationRequest {
  claimId: string;
  tenantId: string;
}

interface ClaimDocument {
  document_id: string;
  document: {
    id: string;
    file_name: string;
    file_key: string;
    mime_type: string | null;
    size_bytes: number | null;
  };
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { claimId, tenantId }: ClaimNotificationRequest = await req.json();
    
    if (!claimId) {
      throw new Error("claimId est requis");
    }
    
    // Fetch claim details with client info
    const { data: claim, error: claimError } = await supabase
      .from("claims")
      .select(`
        id,
        claim_type,
        incident_date,
        description,
        status,
        created_at,
        tenant_id,
        client_id,
        policy_id
      `)
      .eq("id", claimId)
      .single();
    
    if (claimError || !claim) {
      console.error("Error fetching claim:", claimError);
      throw new Error("Sinistre non trouvé");
    }
    
    // Fetch client separately
    const { data: client } = await supabase
      .from("clients")
      .select("id, first_name, last_name, email, phone, mobile, address, postal_code, city, canton, birthdate, tenant_id")
      .eq("id", claim.client_id)
      .single();
    
    // Fetch policy separately if exists
    let policy = null;
    if (claim.policy_id) {
      const { data: policyData } = await supabase
        .from("policies")
        .select("policy_number, company_name, product_type")
        .eq("id", claim.policy_id)
        .single();
      policy = policyData;
    }
    
    // Fetch documents linked to this claim
    const { data: claimDocuments } = await supabase
      .from("claim_documents")
      .select(`
        document_id,
        document:documents!claim_documents_document_id_fkey (
          id,
          file_name,
          file_key,
          mime_type,
          size_bytes
        )
      `)
      .eq("claim_id", claimId);
    
    console.log("Claim documents found:", claimDocuments?.length || 0);
    
    // Generate signed URLs for documents
    const documentsWithUrls: Array<{
      fileName: string;
      fileSize: string;
      mimeType: string;
      downloadUrl: string;
    }> = [];
    
    if (claimDocuments && claimDocuments.length > 0) {
      for (const docRow of claimDocuments) {
        const doc = docRow.document as unknown as {
          id: string;
          file_name: string;
          file_key: string;
          mime_type: string | null;
          size_bytes: number | null;
        };
        
        if (doc?.file_key) {
          const { data: signedUrlData } = await supabase.storage
            .from("documents")
            .createSignedUrl(doc.file_key, 60 * 60 * 24 * 7); // 7 days expiry
          
          if (signedUrlData?.signedUrl) {
            const sizeInMb = doc.size_bytes 
              ? (doc.size_bytes / 1024 / 1024).toFixed(2) + ' MB'
              : 'Taille inconnue';
            
            documentsWithUrls.push({
              fileName: doc.file_name,
              fileSize: sizeInMb,
              mimeType: doc.mime_type || 'application/octet-stream',
              downloadUrl: signedUrlData.signedUrl
            });
          }
        }
      }
    }
    
    const clientTenantId = tenantId || claim.tenant_id || client?.tenant_id;
    
    if (!clientTenantId) {
      console.log("No tenant ID found, skipping notification");
      return new Response(
        JSON.stringify({ success: true, message: "No tenant configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Get tenant branding with claims notification email
    const { data: branding, error: brandingError } = await supabase
      .from("tenant_branding")
      .select("display_name, claims_notification_email, email_sender_name, email_sender_address, logo_url, primary_color")
      .eq("tenant_id", clientTenantId)
      .single();
    
    if (brandingError) {
      console.error("Error fetching branding:", brandingError);
    }
    
    const notificationEmail = branding?.claims_notification_email;
    
    if (!notificationEmail) {
      console.log("No claims notification email configured for tenant");
      return new Response(
        JSON.stringify({ success: true, message: "No notification email configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (!resendApiKey) {
      console.log("RESEND_API_KEY not configured, skipping email");
      return new Response(
        JSON.stringify({ success: true, message: "Email service not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const resend = new Resend(resendApiKey);
    
    const clientName = `${client?.first_name || ''} ${client?.last_name || ''}`.trim() || 'Client';
    const clientEmail = client?.email || 'Non renseigné';
    const clientPhone = client?.mobile || client?.phone || 'Non renseigné';
    const clientAddress = client?.address || '';
    const clientPostalCode = client?.postal_code || '';
    const clientCity = client?.city || '';
    const clientCanton = client?.canton || '';
    const clientBirthdate = client?.birthdate 
      ? new Date(client.birthdate).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : 'Non renseigné';
    
    const fullAddress = [clientAddress, `${clientPostalCode} ${clientCity}`.trim(), clientCanton]
      .filter(Boolean)
      .join(', ') || 'Non renseignée';
    
    const claimTypeLabels: Record<string, string> = {
      'auto': 'Automobile',
      'sante': 'Santé',
      'menage': 'Ménage/RC',
      'juridique': 'Protection juridique',
      'autre': 'Autre',
    };
    
    const claimTypeLabel = claimTypeLabels[claim.claim_type] || claim.claim_type;
    const primaryColor = branding?.primary_color || '#0EA5E9';
    const companyName = branding?.display_name || branding?.email_sender_name || 'Votre courtier';
    const logoUrl = branding?.logo_url;
    
    const formattedDate = new Date(claim.incident_date).toLocaleDateString('fr-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    
    const submittedAt = new Date(claim.created_at).toLocaleString('fr-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const policyInfo = policy 
      ? `<tr>
          <td style="padding: 8px 0; color: #6b7280;">Contrat associé:</td>
          <td style="padding: 8px 0; font-weight: 500;">${policy.company_name || ''} - ${policy.product_type || ''} (${policy.policy_number || 'N/A'})</td>
        </tr>`
      : '';
    
    // Build documents section HTML
    let documentsHtml = '';
    if (documentsWithUrls.length > 0) {
      const docItems = documentsWithUrls.map(doc => `
        <tr>
          <td style="padding: 12px; background: white; border-radius: 8px; margin-bottom: 8px;">
            <table style="width: 100%;">
              <tr>
                <td style="vertical-align: middle;">
                  <span style="font-size: 20px;">📎</span>
                </td>
                <td style="padding-left: 12px; vertical-align: middle;">
                  <div style="font-weight: 500; color: #1f2937;">${doc.fileName}</div>
                  <div style="font-size: 12px; color: #6b7280;">${doc.fileSize}</div>
                </td>
                <td style="text-align: right; vertical-align: middle;">
                  <a href="${doc.downloadUrl}" 
                     style="display: inline-block; padding: 8px 16px; background: ${primaryColor}; color: white; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500;">
                    Télécharger
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr><td style="height: 8px;"></td></tr>
      `).join('');
      
      documentsHtml = `
        <h2 style="color: #1f2937; font-size: 18px; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb;">
          📁 Documents joints (${documentsWithUrls.length})
        </h2>
        <div style="background: #f3f4f6; border-radius: 8px; padding: 12px; margin-bottom: 24px;">
          <table style="width: 100%;">
            ${docItems}
          </table>
          <p style="color: #6b7280; font-size: 12px; margin: 12px 0 0 0; text-align: center;">
            ⚠️ Les liens de téléchargement expirent dans 7 jours
          </p>
        </div>
      `;
    }
    
    const emailHtml = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nouvelle déclaration de sinistre</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
      <!-- Header -->
      <div style="background: ${primaryColor}; padding: 24px; text-align: center;">
        ${logoUrl ? `<img src="${logoUrl}" alt="${companyName}" style="max-height: 50px; margin-bottom: 16px;">` : ''}
        <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">🚨 Nouvelle déclaration de sinistre</h1>
      </div>
      
      <!-- Content -->
      <div style="padding: 32px;">
        <p style="color: #374151; font-size: 16px; margin: 0 0 24px 0;">
          Un client a soumis une nouvelle déclaration de sinistre. Voici les détails complets :
        </p>
        
        <!-- Alert Box -->
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
          <p style="color: #92400e; margin: 0; font-weight: 500;">
            Sinistre de type <strong>${claimTypeLabel}</strong> déclaré le ${submittedAt}
          </p>
        </div>
        
        <!-- Client Info -->
        <h2 style="color: #1f2937; font-size: 18px; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb;">
          👤 Informations client
        </h2>
        <table style="width: 100%; margin-bottom: 24px;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; width: 140px;">Nom:</td>
            <td style="padding: 8px 0; font-weight: 500;">${clientName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Email:</td>
            <td style="padding: 8px 0;"><a href="mailto:${clientEmail}" style="color: ${primaryColor};">${clientEmail}</a></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Téléphone:</td>
            <td style="padding: 8px 0;"><a href="tel:${clientPhone}" style="color: ${primaryColor};">${clientPhone}</a></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Date de naissance:</td>
            <td style="padding: 8px 0;">${clientBirthdate}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Adresse:</td>
            <td style="padding: 8px 0;">${fullAddress}</td>
          </tr>
        </table>
        
        <!-- Claim Info -->
        <h2 style="color: #1f2937; font-size: 18px; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb;">
          📋 Détails du sinistre
        </h2>
        <table style="width: 100%; margin-bottom: 24px;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; width: 140px;">Type:</td>
            <td style="padding: 8px 0; font-weight: 500;">${claimTypeLabel}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Date du sinistre:</td>
            <td style="padding: 8px 0; font-weight: 500;">${formattedDate}</td>
          </tr>
          ${policyInfo}
        </table>
        
        <!-- Description -->
        <h2 style="color: #1f2937; font-size: 18px; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb;">
          📝 Description du sinistre
        </h2>
        <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <p style="color: #374151; margin: 0; white-space: pre-wrap; line-height: 1.6;">${claim.description}</p>
        </div>
        
        <!-- Documents -->
        ${documentsHtml}
        
        <!-- CTA -->
        <div style="text-align: center; margin-top: 32px;">
          <p style="color: #6b7280; font-size: 14px; margin: 0;">
            Connectez-vous au CRM pour traiter cette demande.
          </p>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="background: #f9fafb; padding: 16px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          Notification automatique de ${companyName}
        </p>
      </div>
    </div>
  </div>
</body>
</html>
    `;
    
    const senderEmail = branding?.email_sender_address || 'noreply@resend.dev';
    const senderName = branding?.email_sender_name || companyName;
    
    // Determine the from address
    let fromAddress = `${senderName} <onboarding@resend.dev>`;
    if (senderEmail && !senderEmail.includes('@resend.dev')) {
      fromAddress = `${senderName} <${senderEmail}>`;
    }
    
    const docCount = documentsWithUrls.length;
    const docSuffix = docCount > 0 ? ` + ${docCount} document${docCount > 1 ? 's' : ''}` : '';
    
    const emailResponse = await resend.emails.send({
      from: fromAddress,
      to: [notificationEmail],
      subject: `🚨 Nouveau sinistre - ${clientName} (${claimTypeLabel})${docSuffix}`,
      html: emailHtml,
    });
    
    console.log("Claim notification email sent:", emailResponse);
    console.log("Documents included:", docCount);
    
    return new Response(
      JSON.stringify({ success: true, emailId: emailResponse.data?.id, documentsIncluded: docCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in send-claim-notification:", error);
    const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
