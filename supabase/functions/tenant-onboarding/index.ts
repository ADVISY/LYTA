import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAuth, AuthError } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("tenant-onboarding");

const CLOUDFLARE_API_TOKEN = Deno.env.get("CLOUDFLARE_API_TOKEN");
const CLOUDFLARE_ZONE_ID = Deno.env.get("CLOUDFLARE_ZONE_ID");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const DEFAULT_TENANT_CNAME_TARGET = "cname.vercel-dns.com";
const TENANT_CNAME_TARGET = Deno.env.get("TENANT_CNAME_TARGET") ?? DEFAULT_TENANT_CNAME_TARGET;
const TENANT_CNAME_PROXIED = (Deno.env.get("TENANT_CNAME_PROXIED") ?? "false").toLowerCase() === "true";

interface OnboardingRequest {
  tenant_id: string;
  slug: string;
  tenant_name: string;
  step: "dns" | "resend" | "full";
  email_domain?: string | null; // Custom email domain for the tenant
}

interface NotificationPayload {
  title: string;
  message: string;
  kind: "info" | "success" | "warning" | "error";
  priority: "normal" | "high";
  tenant_id: string;
  tenant_name: string;
  metadata?: Record<string, unknown>;
}

// Helper to create King notification
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createKingNotification(
  supabase: any,
  payload: NotificationPayload
) {
  const { error } = await supabase
    .from("king_notifications")
    .insert({
      title: payload.title,
      message: payload.message,
      kind: payload.kind,
      priority: payload.priority,
      tenant_id: payload.tenant_id,
      tenant_name: payload.tenant_name,
      metadata: payload.metadata || {},
    });

  if (error) {
    log.error("Error creating notification", { error });
  }
  return !error;
}

// Create Cloudflare DNS record
async function createCloudflareDNS(slug: string): Promise<{ success: boolean; message: string; record_id?: string }> {
  if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ZONE_ID) {
    return { success: false, message: "Cloudflare credentials not configured" };
  }

  const domain = `${slug}.lyta.ch`;
  
  try {
    // First check if record already exists
    const checkResponse = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records?name=${domain}`,
      {
        headers: {
          "Authorization": `Bearer ${CLOUDFLARE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    const checkData = await checkResponse.json();
    
    const existingRecord = checkData.result?.[0];

    if (existingRecord) {
      const recordAlreadyMatches =
        existingRecord.type === "CNAME" &&
        existingRecord.content === TENANT_CNAME_TARGET &&
        Boolean(existingRecord.proxied) === TENANT_CNAME_PROXIED;

      if (recordAlreadyMatches) {
        log.info("DNS record already exists", { domain });
        return {
          success: true,
          message: `DNS record already exists for ${domain}`,
          record_id: existingRecord.id
        };
      }

      const updateResponse = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records/${existingRecord.id}`,
        {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${CLOUDFLARE_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "CNAME",
            name: slug,
            content: TENANT_CNAME_TARGET,
            ttl: 1,
            proxied: TENANT_CNAME_PROXIED,
          }),
        }
      );

      const updateData = await updateResponse.json();

      if (updateData.success) {
        log.info("DNS record updated", { domain });
        return {
          success: true,
          message: `DNS record updated successfully for ${domain}`,
          record_id: updateData.result?.id ?? existingRecord.id
        };
      }

      log.error("Cloudflare DNS update error", { errors: updateData.errors });
      return {
        success: false,
        message: `Failed to update DNS: ${JSON.stringify(updateData.errors)}`
      };
    }

    // Create CNAME record pointing to the deployment target
    const createResponse = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${CLOUDFLARE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "CNAME",
          name: slug,
          content: TENANT_CNAME_TARGET,
          ttl: 1, // Auto
          proxied: TENANT_CNAME_PROXIED,
        }),
      }
    );

    const createData = await createResponse.json();
    
    if (createData.success) {
      log.info("DNS record created", { domain });
      return { 
        success: true, 
        message: `DNS record created successfully for ${domain}`,
        record_id: createData.result?.id
      };
    } else {
      log.error("Cloudflare DNS error", { errors: createData.errors });
      return { 
        success: false, 
        message: `Failed to create DNS: ${JSON.stringify(createData.errors)}` 
      };
    }
  } catch (err: unknown) {
    const error = err as Error;
    log.error("Cloudflare API error", { error: error.message });
    return { success: false, message: `Cloudflare API error: ${error.message}` };
  }
}

// Add domain to Resend for email sending
async function addResendDomain(domain: string): Promise<{ success: boolean; message: string; domain_id?: string; records?: unknown[]; is_custom_domain?: boolean }> {
  if (!RESEND_API_KEY) {
    return { success: false, message: "Resend API key not configured" };
  }

  try {
    // First check if domain already exists
    const listResponse = await fetch("https://api.resend.com/domains", {
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
    });

    const listData = await listResponse.json();
    
    if (listData.data) {
      const existingDomain = listData.data.find((d: { name: string }) => d.name === domain);
      if (existingDomain) {
        log.info("Resend domain already exists", { domain });
        return { 
          success: true, 
          message: `Domain ${domain} already configured in Resend`,
          domain_id: existingDomain.id,
          records: existingDomain.records,
          is_custom_domain: true
        };
      }
    }

    // Create new domain
    const createResponse = await fetch("https://api.resend.com/domains", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: domain,
      }),
    });

    const createData = await createResponse.json();

    if (createData.id) {
      log.info("Resend domain created", { domain });
      return { 
        success: true, 
        message: `Domain ${domain} added to Resend. DNS records need to be configured.`,
        domain_id: createData.id,
        records: createData.records,
        is_custom_domain: true
      };
    } else {
      log.error("Resend domain error", { error: createData });
      return { 
        success: false, 
        message: `Failed to add domain to Resend: ${createData.message || JSON.stringify(createData)}` 
      };
    }
  } catch (err: unknown) {
    const error = err as Error;
    log.error("Resend API error", { error: error.message });
    return { success: false, message: `Resend API error: ${error.message}` };
  }
}

// Add Resend DNS records to Cloudflare
async function addResendDNSRecords(slug: string, records: Array<{ type: string; name: string; value: string }>): Promise<{ success: boolean; message: string }> {
  if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ZONE_ID) {
    return { success: false, message: "Cloudflare credentials not configured" };
  }

  const results: string[] = [];
  
  for (const record of records) {
    try {
      // Check if record exists
      const recordName = record.name.replace(".lyta.ch", "");
      const checkResponse = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records?type=${record.type}&name=${record.name}`,
        {
          headers: {
            "Authorization": `Bearer ${CLOUDFLARE_API_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );
      
      const checkData = await checkResponse.json();
      
      if (checkData.result && checkData.result.length > 0) {
        results.push(`${record.type} ${record.name}: already exists`);
        continue;
      }

      // Create the DNS record
      const createResponse = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${CLOUDFLARE_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: record.type,
            name: recordName,
            content: record.value,
            ttl: 1,
            proxied: false,
          }),
        }
      );

      const createData = await createResponse.json();
      
      if (createData.success) {
        results.push(`${record.type} ${record.name}: created`);
      } else {
        results.push(`${record.type} ${record.name}: failed - ${JSON.stringify(createData.errors)}`);
      }
    } catch (err: unknown) {
      const error = err as Error;
      results.push(`${record.type} ${record.name}: error - ${error.message}`);
    }
  }

  return { 
    success: true, 
    message: `DNS records processed: ${results.join(", ")}` 
  };
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Verify caller identity via shared auth
    const { user } = await requireAuth(req);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify the caller is a KING user
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleData?.role !== "king") {
      throw new Error("Unauthorized: Only KING users can run onboarding");
    }

    const { tenant_id, slug, tenant_name, step, email_domain }: OnboardingRequest = await req.json();

    if (!tenant_id || !slug || !tenant_name) {
      throw new Error("Missing required fields: tenant_id, slug, tenant_name");
    }

    const results: Record<string, unknown> = {
      tenant_id,
      slug,
      tenant_name,
      email_domain: email_domain || null,
      steps: [],
    };

    // Step 1: DNS Configuration (for lyta.ch subdomain)
    if (step === "dns" || step === "full") {
      await createKingNotification(supabase, {
        title: "🌐 Configuration DNS en cours",
        message: `Création du sous-domaine ${slug}.lyta.ch sur Cloudflare...`,
        kind: "info",
        priority: "high",
        tenant_id,
        tenant_name,
        metadata: { step: "dns", status: "in_progress" },
      });

      const dnsResult = await createCloudflareDNS(slug);
      results.dns = dnsResult;
      (results.steps as string[]).push("dns");

      await createKingNotification(supabase, {
        title: dnsResult.success ? "✅ DNS configuré" : "❌ Erreur DNS",
        message: dnsResult.message,
        kind: dnsResult.success ? "success" : "error",
        priority: "high",
        tenant_id,
        tenant_name,
        metadata: { step: "dns", status: dnsResult.success ? "completed" : "failed", result: dnsResult },
      });
    }

    // Step 2: Resend Domain Configuration
    if (step === "resend" || step === "full") {
      // Use custom email domain if provided, otherwise fallback to slug.lyta.ch
      const resendDomain = email_domain || `${slug}.lyta.ch`;
      const isCustomDomain = !!email_domain;
      
      await createKingNotification(supabase, {
        title: "📧 Configuration email en cours",
        message: `Ajout du domaine ${resendDomain} sur Resend...`,
        kind: "info",
        priority: "high",
        tenant_id,
        tenant_name,
        metadata: { step: "resend", status: "in_progress", domain: resendDomain, is_custom: isCustomDomain },
      });

      const resendResult = await addResendDomain(resendDomain);
      results.resend = resendResult;
      (results.steps as string[]).push("resend");

      // If custom domain, show DNS records that tenant needs to configure
      if (resendResult.success && resendResult.records && Array.isArray(resendResult.records) && isCustomDomain) {
        // For custom domains, we can't add DNS records automatically - tenant must do it
        const dnsRecords = resendResult.records as Array<{ type: string; name: string; value: string }>;
        
        // Create notification with DNS records for tenant to configure
        await createKingNotification(supabase, {
          title: "📋 DNS à configurer par le tenant",
          message: `Le tenant doit ajouter ${dnsRecords.length} enregistrements DNS chez son provider pour ${resendDomain}`,
          kind: "warning",
          priority: "high",
          tenant_id,
          tenant_name,
          metadata: { 
            step: "resend_dns_manual", 
            status: "pending_tenant_action",
            domain: resendDomain,
            dns_records: dnsRecords.map(r => ({
              type: r.type,
              name: r.name,
              value: r.value
            }))
          },
        });
        
        results.resend_dns = { 
          success: true, 
          message: `${dnsRecords.length} DNS records need to be configured by tenant`,
          requires_tenant_action: true,
          records: dnsRecords
        };
      } else if (resendResult.success && resendResult.records && Array.isArray(resendResult.records)) {
        // For lyta.ch subdomain, we can add DNS records automatically
        await createKingNotification(supabase, {
          title: "📋 Configuration DNS email",
          message: `Ajout des enregistrements SPF, DKIM, DMARC pour ${resendDomain}...`,
          kind: "info",
          priority: "normal",
          tenant_id,
          tenant_name,
          metadata: { step: "resend_dns", status: "in_progress" },
        });

        const dnsRecords = resendResult.records as Array<{ type: string; name: string; value: string }>;
        const resendDnsResult = await addResendDNSRecords(slug, dnsRecords);
        results.resend_dns = resendDnsResult;

        await createKingNotification(supabase, {
          title: resendDnsResult.success ? "✅ DNS email configuré" : "⚠️ DNS email partiel",
          message: resendDnsResult.message,
          kind: resendDnsResult.success ? "success" : "warning",
          priority: "normal",
          tenant_id,
          tenant_name,
          metadata: { step: "resend_dns", status: "completed", result: resendDnsResult },
        });
      }

      await createKingNotification(supabase, {
        title: resendResult.success ? "✅ Email configuré" : "❌ Erreur email",
        message: resendResult.message,
        kind: resendResult.success ? "success" : "error",
        priority: "high",
        tenant_id,
        tenant_name,
        metadata: { 
          step: "resend", 
          status: resendResult.success ? "completed" : "failed", 
          result: resendResult,
          is_custom_domain: isCustomDomain
        },
      });
    }

    // Final notification
    if (step === "full") {
      const allSuccess = (results.dns as { success: boolean })?.success !== false && 
                         (results.resend as { success: boolean })?.success !== false;

      await createKingNotification(supabase, {
        title: allSuccess ? "🎉 Onboarding terminé" : "⚠️ Onboarding partiel",
        message: allSuccess 
          ? `Le tenant ${tenant_name} est prêt! Sous-domaine: ${slug}.lyta.ch`
          : `Certaines étapes ont échoué pour ${tenant_name}. Vérifiez les détails.`,
        kind: allSuccess ? "success" : "warning",
        priority: "high",
        tenant_id,
        tenant_name,
        metadata: { step: "complete", results },
      });

      // Update tenant with onboarding status
      await supabase
        .from("tenants")
        .update({
          metadata: {
            onboarding_completed: allSuccess,
            onboarding_date: new Date().toISOString(),
            dns_configured: (results.dns as { success: boolean })?.success || false,
            resend_configured: (results.resend as { success: boolean })?.success || false,
          }
        })
        .eq("id", tenant_id);
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
    });

  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return new Response(
        JSON.stringify({ success: false, error: (err as AuthError).message }),
        { status: (err as AuthError).status, headers: { "Content-Type": "application/json", ...getCorsHeaders(req) } }
      );
    }
    const error = err as Error;
    log.error("Onboarding error", { error: error.message });
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...getCorsHeaders(req) } }
    );
  }
});
