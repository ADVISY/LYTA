import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAuth, AuthError } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("tenant-onboarding");

const CLOUDFLARE_API_TOKEN = Deno.env.get("CLOUDFLARE_API_TOKEN");
const CLOUDFLARE_ZONE_ID = Deno.env.get("CLOUDFLARE_ZONE_ID");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const VERCEL_TOKEN = Deno.env.get("VERCEL_TOKEN");
const VERCEL_PROJECT_ID = Deno.env.get("VERCEL_PROJECT_ID");
const VERCEL_TEAM_ID = Deno.env.get("VERCEL_TEAM_ID");
const VERCEL_TEAM_SLUG = Deno.env.get("VERCEL_TEAM_SLUG");

const VERCEL_API_BASE = "https://api.vercel.com";
const TENANT_DOMAIN_SUFFIX = Deno.env.get("TENANT_DOMAIN_SUFFIX") ?? "lyta.ch";
const DEFAULT_TENANT_CNAME_TARGET = "cname.vercel-dns.com";
const TENANT_CNAME_TARGET_OVERRIDE = Deno.env.get("TENANT_CNAME_TARGET");
const TENANT_CNAME_PROXIED = (Deno.env.get("TENANT_CNAME_PROXIED") ?? "false").toLowerCase() === "true";

const DOMAIN_VERIFY_ATTEMPTS = 8;
const DOMAIN_VERIFY_DELAY_MS = 4000;

interface OnboardingRequest {
  tenant_id: string;
  slug: string;
  tenant_name: string;
  step: "dns" | "resend" | "full";
  email_domain?: string | null;
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

interface CloudflareApiError {
  code?: number;
  message?: string;
}

interface CloudflareRecord {
  id: string;
  type: string;
  name: string;
  content?: string;
  proxied?: boolean;
}

interface CloudflareResponse<T> {
  success: boolean;
  result?: T;
  errors?: CloudflareApiError[];
}

interface EnsureCloudflareRecordInput {
  type: string;
  name: string;
  content: string;
  proxied?: boolean;
  ttl?: number;
  allowMultiple?: boolean;
}

interface EnsureCloudflareRecordResult {
  success: boolean;
  message: string;
  record_id?: string;
  action?: "created" | "updated" | "unchanged";
}

interface VercelDomainConfig {
  configuredBy?: string | null;
  acceptedChallenges?: string[];
  recommendedCNAME?: Array<{ rank?: number | string; value?: string }>;
  misconfigured?: boolean;
}

interface VercelVerificationChallenge {
  type?: string;
  domain?: string;
  value?: string;
  reason?: string;
}

interface VercelProjectDomain {
  name?: string;
  apexName?: string;
  projectId?: string;
  verified?: boolean;
  verification?: VercelVerificationChallenge[];
  createdAt?: number;
  updatedAt?: number;
}

interface VercelRequestResult<T> {
  response: Response;
  data: T | null;
}

type AdminClient = ReturnType<typeof createClient>;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeJsonParse<T>(input: string): T | null {
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringifyErrors(errors: CloudflareApiError[] | undefined): string {
  if (!errors || errors.length === 0) {
    return "unknown error";
  }

  return errors
    .map((error) => {
      const code = error.code ? `[${error.code}] ` : "";
      return `${code}${error.message ?? "unknown error"}`;
    })
    .join(", ");
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) {
    return fallback;
  }

  const error = payload.error;
  if (typeof error === "string") {
    return error;
  }

  if (isRecord(error) && typeof error.message === "string") {
    return error.message;
  }

  if (typeof payload.message === "string") {
    return payload.message;
  }

  return fallback;
}

function buildTenantDomain(slug: string): string {
  return `${slug}.${TENANT_DOMAIN_SUFFIX}`;
}

function buildVercelUrl(path: string, query: Record<string, string> = {}): string {
  const params = new URLSearchParams();

  if (VERCEL_TEAM_ID) {
    params.set("teamId", VERCEL_TEAM_ID);
  } else if (VERCEL_TEAM_SLUG) {
    params.set("slug", VERCEL_TEAM_SLUG);
  }

  for (const [key, value] of Object.entries(query)) {
    params.set(key, value);
  }

  const qs = params.toString();
  return `${VERCEL_API_BASE}${path}${qs ? `?${qs}` : ""}`;
}

async function vercelRequest<T>(path: string, init: RequestInit = {}, query: Record<string, string> = {}): Promise<VercelRequestResult<T>> {
  if (!VERCEL_TOKEN) {
    throw new Error("VERCEL_TOKEN is not configured");
  }

  const headers = new Headers(init.headers ?? {});
  headers.set("Authorization", `Bearer ${VERCEL_TOKEN}`);
  headers.set("Content-Type", "application/json");

  const response = await fetch(buildVercelUrl(path, query), {
    ...init,
    headers,
  });

  const text = await response.text();
  const data = text ? safeJsonParse<T>(text) : null;

  return { response, data };
}

async function cloudflareRequest<T>(path: string, init: RequestInit = {}): Promise<CloudflareResponse<T>> {
  if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ZONE_ID) {
    throw new Error("Cloudflare credentials are not configured");
  }

  const headers = new Headers(init.headers ?? {});
  headers.set("Authorization", `Bearer ${CLOUDFLARE_API_TOKEN}`);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}${path}`, {
    ...init,
    headers,
  });

  const text = await response.text();
  const data = text ? safeJsonParse<CloudflareResponse<T>>(text) : null;

  if (!data) {
    throw new Error(`Cloudflare returned an unreadable response (${response.status})`);
  }

  return data;
}

async function createKingNotification(
  supabase: AdminClient,
  payload: NotificationPayload,
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

async function ensureCloudflareRecord(input: EnsureCloudflareRecordInput): Promise<EnsureCloudflareRecordResult> {
  if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ZONE_ID) {
    return { success: false, message: "Cloudflare credentials not configured" };
  }

  const ttl = input.ttl ?? 1;
  const proxied = input.proxied ?? false;
  const allowMultiple = input.allowMultiple ?? false;

  try {
    const list = await cloudflareRequest<CloudflareRecord[]>(
      `/dns_records?type=${encodeURIComponent(input.type)}&name=${encodeURIComponent(input.name)}`,
    );

    const existingRecords = Array.isArray(list.result) ? list.result : [];
    const exactMatch = existingRecords.find((record) =>
      record.type === input.type &&
      record.name === input.name &&
      record.content === input.content &&
      Boolean(record.proxied) === proxied
    );

    if (exactMatch) {
      return {
        success: true,
        message: `${input.type} record already exists for ${input.name}`,
        record_id: exactMatch.id,
        action: "unchanged",
      };
    }

    if (!allowMultiple && existingRecords.length > 0) {
      const recordToUpdate = existingRecords[0];
      const update = await cloudflareRequest<CloudflareRecord>(
        `/dns_records/${recordToUpdate.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            type: input.type,
            name: input.name,
            content: input.content,
            ttl,
            proxied,
          }),
        },
      );

      if (update.success) {
        return {
          success: true,
          message: `${input.type} record updated for ${input.name}`,
          record_id: update.result?.id ?? recordToUpdate.id,
          action: "updated",
        };
      }

      return {
        success: false,
        message: `Failed to update ${input.type} record for ${input.name}: ${stringifyErrors(update.errors)}`,
      };
    }

    const create = await cloudflareRequest<CloudflareRecord>(
      "/dns_records",
      {
        method: "POST",
        body: JSON.stringify({
          type: input.type,
          name: input.name,
          content: input.content,
          ttl,
          proxied,
        }),
      },
    );

    if (create.success) {
      return {
        success: true,
        message: `${input.type} record created for ${input.name}`,
        record_id: create.result?.id,
        action: "created",
      };
    }

    return {
      success: false,
      message: `Failed to create ${input.type} record for ${input.name}: ${stringifyErrors(create.errors)}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    log.error("Cloudflare record upsert failed", { name: input.name, type: input.type, error: message });
    return {
      success: false,
      message: `Cloudflare API error for ${input.name}: ${message}`,
    };
  }
}

async function getRecommendedTenantCnameTarget(domain: string): Promise<{ success: boolean; target: string; message: string; source: string }> {
  if (TENANT_CNAME_TARGET_OVERRIDE) {
    return {
      success: true,
      target: TENANT_CNAME_TARGET_OVERRIDE,
      message: `Using TENANT_CNAME_TARGET override for ${domain}`,
      source: "env_override",
    };
  }

  if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
    return {
      success: false,
      target: DEFAULT_TENANT_CNAME_TARGET,
      message: "Vercel credentials not configured, fallback to default target",
      source: "fallback",
    };
  }

  try {
    const { response, data } = await vercelRequest<VercelDomainConfig>(
      `/v6/domains/${encodeURIComponent(domain)}/config`,
      { method: "GET" },
      { projectIdOrName: VERCEL_PROJECT_ID },
    );

    if (!response.ok) {
      return {
        success: false,
        target: DEFAULT_TENANT_CNAME_TARGET,
        message: extractErrorMessage(data, `Vercel domain config failed (${response.status})`),
        source: "fallback",
      };
    }

    const recommendedTarget = data?.recommendedCNAME
      ?.map((record) => record.value)
      .find((value): value is string => typeof value === "string" && value.length > 0);

    if (!recommendedTarget) {
      return {
        success: false,
        target: DEFAULT_TENANT_CNAME_TARGET,
        message: `Vercel did not return a recommended CNAME for ${domain}`,
        source: "fallback",
      };
    }

    return {
      success: true,
      target: recommendedTarget,
      message: `Using Vercel recommended CNAME for ${domain}`,
      source: "vercel_config",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return {
      success: false,
      target: DEFAULT_TENANT_CNAME_TARGET,
      message: `Failed to fetch Vercel domain config: ${message}`,
      source: "fallback",
    };
  }
}

async function getProjectDomainOnVercel(domain: string): Promise<{ success: boolean; domain?: VercelProjectDomain; message: string; status?: number }> {
  if (!VERCEL_PROJECT_ID) {
    return { success: false, message: "VERCEL_PROJECT_ID is not configured" };
  }

  try {
    const { response, data } = await vercelRequest<VercelProjectDomain>(
      `/v9/projects/${encodeURIComponent(VERCEL_PROJECT_ID)}/domains/${encodeURIComponent(domain)}`,
      { method: "GET" },
    );

    if (response.ok && data) {
      return {
        success: true,
        domain: data,
        message: `Domain ${domain} is attached to the Vercel project`,
      };
    }

    return {
      success: false,
      message: extractErrorMessage(data, `Unable to fetch Vercel domain (${response.status})`),
      status: response.status,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return {
      success: false,
      message: `Failed to fetch project domain on Vercel: ${message}`,
    };
  }
}

async function addDomainToVercelProject(domain: string): Promise<{ success: boolean; message: string; domain?: VercelProjectDomain }> {
  if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
    return {
      success: false,
      message: "Vercel credentials are not configured (VERCEL_TOKEN / VERCEL_PROJECT_ID)",
    };
  }

  try {
    const { response, data } = await vercelRequest<VercelProjectDomain>(
      `/v10/projects/${encodeURIComponent(VERCEL_PROJECT_ID)}/domains`,
      {
        method: "POST",
        body: JSON.stringify({ name: domain }),
      },
    );

    if (response.ok && data) {
      return {
        success: true,
        message: `Domain ${domain} added to Vercel`,
        domain: data,
      };
    }

    if (response.status === 409) {
      const existing = await getProjectDomainOnVercel(domain);
      if (existing.success && existing.domain) {
        return {
          success: true,
          message: `Domain ${domain} already exists on the Vercel project`,
          domain: existing.domain,
        };
      }
    }

    return {
      success: false,
      message: extractErrorMessage(data, `Failed to add domain to Vercel (${response.status})`),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return {
      success: false,
      message: `Vercel API error: ${message}`,
    };
  }
}

async function ensureVercelVerificationRecords(challenges: VercelVerificationChallenge[]): Promise<{ success: boolean; message: string; results: EnsureCloudflareRecordResult[] }> {
  const relevantChallenges = challenges.filter((challenge) =>
    challenge.type === "TXT" &&
    typeof challenge.domain === "string" &&
    challenge.domain.length > 0 &&
    typeof challenge.value === "string" &&
    challenge.value.length > 0
  );

  if (relevantChallenges.length === 0) {
    return {
      success: true,
      message: "No Vercel TXT verification records required",
      results: [],
    };
  }

  const results: EnsureCloudflareRecordResult[] = [];

  for (const challenge of relevantChallenges) {
    results.push(await ensureCloudflareRecord({
      type: "TXT",
      name: challenge.domain!,
      content: challenge.value!,
      proxied: false,
      allowMultiple: true,
    }));
  }

  const failed = results.filter((result) => !result.success);
  return {
    success: failed.length === 0,
    message: failed.length === 0
      ? "Vercel TXT verification records are configured"
      : failed.map((result) => result.message).join(" | "),
    results,
  };
}

async function verifyVercelProjectDomain(domain: string): Promise<{
  success: boolean;
  verified: boolean;
  message: string;
  attempts: number;
  verification_records?: EnsureCloudflareRecordResult[];
}> {
  if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
    return {
      success: false,
      verified: false,
      message: "Vercel credentials are not configured",
      attempts: 0,
    };
  }

  let verificationRecords: EnsureCloudflareRecordResult[] = [];

  for (let attempt = 1; attempt <= DOMAIN_VERIFY_ATTEMPTS; attempt += 1) {
    const currentDomain = await getProjectDomainOnVercel(domain);
    const currentVerification = currentDomain.domain?.verification ?? [];

    if (currentDomain.domain?.verified) {
      return {
        success: true,
        verified: true,
        message: `Domain ${domain} is verified on Vercel`,
        attempts: attempt,
        verification_records: verificationRecords,
      };
    }

    if (currentVerification.length > 0) {
      const verificationResult = await ensureVercelVerificationRecords(currentVerification);
      verificationRecords = verificationResult.results;

      if (!verificationResult.success) {
        return {
          success: false,
          verified: false,
          message: verificationResult.message,
          attempts: attempt,
          verification_records: verificationRecords,
        };
      }
    }

    const { response, data } = await vercelRequest<{ verified?: boolean }>(
      `/v9/projects/${encodeURIComponent(VERCEL_PROJECT_ID)}/domains/${encodeURIComponent(domain)}/verify`,
      { method: "POST" },
    );

    if (response.ok && data?.verified) {
      return {
        success: true,
        verified: true,
        message: `Domain ${domain} verified on Vercel`,
        attempts: attempt,
        verification_records: verificationRecords,
      };
    }

    if (attempt < DOMAIN_VERIFY_ATTEMPTS) {
      await sleep(DOMAIN_VERIFY_DELAY_MS);
    } else {
      return {
        success: false,
        verified: false,
        message: extractErrorMessage(
          data,
          `Domain ${domain} is still waiting for DNS propagation on Vercel`,
        ),
        attempts: attempt,
        verification_records: verificationRecords,
      };
    }
  }

  return {
    success: false,
    verified: false,
    message: `Domain ${domain} could not be verified on Vercel`,
    attempts: DOMAIN_VERIFY_ATTEMPTS,
    verification_records: verificationRecords,
  };
}

async function ensureTenantDomainProvisioning(slug: string): Promise<{
  success: boolean;
  message: string;
  domain: string;
  cname_target: string;
  target_source: string;
  cloudflare: EnsureCloudflareRecordResult;
  vercel: { success: boolean; message: string; domain?: VercelProjectDomain };
  verification: {
    success: boolean;
    verified: boolean;
    message: string;
    attempts: number;
    verification_records?: EnsureCloudflareRecordResult[];
  };
}> {
  const domain = buildTenantDomain(slug);
  const targetResult = await getRecommendedTenantCnameTarget(domain);
  const cnameTarget = targetResult.target;

  const vercelResult = await addDomainToVercelProject(domain);
  if (!vercelResult.success) {
    return {
      success: false,
      message: vercelResult.message,
      domain,
      cname_target: cnameTarget,
      target_source: targetResult.source,
      cloudflare: {
        success: false,
        message: "Cloudflare step skipped because Vercel registration failed",
      },
      vercel: vercelResult,
      verification: {
        success: false,
        verified: false,
        message: "Verification skipped because Vercel registration failed",
        attempts: 0,
      },
    };
  }

  const cloudflareResult = await ensureCloudflareRecord({
    type: "CNAME",
    name: domain,
    content: cnameTarget,
    proxied: TENANT_CNAME_PROXIED,
    allowMultiple: false,
  });

  if (!cloudflareResult.success) {
    return {
      success: false,
      message: cloudflareResult.message,
      domain,
      cname_target: cnameTarget,
      target_source: targetResult.source,
      cloudflare: cloudflareResult,
      vercel: vercelResult,
      verification: {
        success: false,
        verified: false,
        message: "Verification skipped because Cloudflare DNS failed",
        attempts: 0,
      },
    };
  }

  const verificationResult = await verifyVercelProjectDomain(domain);

  return {
    success: vercelResult.success && cloudflareResult.success && verificationResult.verified,
    message: verificationResult.verified
      ? `Domain ${domain} is fully configured on Vercel and Cloudflare`
      : verificationResult.message,
    domain,
    cname_target: cnameTarget,
    target_source: targetResult.source,
    cloudflare: cloudflareResult,
    vercel: vercelResult,
    verification: verificationResult,
  };
}

/**
 * Envoie au tenant un email branded LYTA contenant les enregistrements DNS
 * à configurer pour activer l'envoi d'emails depuis SON domaine custom
 * (ex: support@advisy.ch) via Resend.
 *
 * Notes :
 * - On reste générique sur le fournisseur DNS (pas d'instruction Infomaniak/
 *   OVH/Cloudflare/etc.) : on dit juste "ton fournisseur DNS".
 * - On formate les records dans un <table> HTML clean avec monospace + bouton
 *   "Copier" via attribute data-* (le copy sera fait par le client mail si
 *   compatible, sinon il copie à la main).
 * - On envoie depuis `support@lyta.ch` (compte LYTA principal, garanti vérifié
 *   par Resend), pas depuis le domaine custom (qui n'est pas encore vérifié).
 */
async function sendTenantDnsInstructionsEmail(params: {
  toEmail: string;
  tenantName: string;
  domain: string;
  records: Array<{ type: string; name: string; value: string; priority?: number; ttl?: number }>;
}): Promise<{ success: boolean; message: string }> {
  if (!RESEND_API_KEY) {
    return { success: false, message: "RESEND_API_KEY missing" };
  }

  const { toEmail, tenantName, domain, records } = params;

  const tableRows = records
    .map((r, i) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#1a1a2e;vertical-align:top;white-space:nowrap;">${r.type}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-family:'Courier New',monospace;font-size:13px;color:#1a1a2e;word-break:break-all;vertical-align:top;">${r.name}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-family:'Courier New',monospace;font-size:13px;color:#1a1a2e;word-break:break-all;vertical-align:top;">${r.value}${r.priority ? ` <span style="color:#6b7280;">(priority ${r.priority})</span>` : ""}</td>
      </tr>
    `)
    .join("");

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;background:#f5f7fb;margin:0;padding:32px 16px;color:#1a1a2e;">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
    <div style="background:linear-gradient(135deg,#0066FF 0%,#4F46E5 100%);padding:36px 32px;text-align:center;">
      <h1 style="color:#fff;font-size:24px;margin:0;font-weight:700;">Configuration DNS — ${tenantName}</h1>
      <p style="color:rgba(255,255,255,0.9);font-size:14px;margin:8px 0 0;">Active l'envoi d'emails depuis ton domaine ${domain}</p>
    </div>

    <div style="padding:32px;">
      <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Bonjour,</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 16px;color:#4a4a68;">
        Pour que LYTA puisse envoyer des emails à tes clients <strong>depuis ton domaine ${domain}</strong>
        (par exemple <code style="background:#f0f2f5;padding:2px 6px;border-radius:4px;font-size:13px;">support@${domain}</code>),
        tu dois ajouter les enregistrements DNS ci-dessous chez ton fournisseur DNS.
      </p>

      <p style="font-size:15px;line-height:1.6;margin:0 0 24px;color:#4a4a68;">
        ⏱️ <strong>~10 minutes</strong> pour la configuration. La propagation DNS peut prendre de quelques minutes à 24 heures.
      </p>

      <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:14px 18px;border-radius:8px;margin:0 0 24px;">
        <p style="margin:0;font-size:14px;color:#92400e;line-height:1.5;">
          <strong>Important :</strong> tant que ces enregistrements ne sont pas en place, les emails envoyés aux clients
          partiront depuis l'adresse LYTA par défaut au lieu de la tienne.
        </p>
      </div>

      <h2 style="font-size:18px;margin:0 0 14px;color:#1a1a2e;">📋 Enregistrements à ajouter</h2>

      <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin:0 0 24px;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:12px;text-align:left;font-size:12px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb;">Type</th>
            <th style="padding:12px;text-align:left;font-size:12px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb;">Nom / Host</th>
            <th style="padding:12px;text-align:left;font-size:12px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb;">Valeur</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>

      <h2 style="font-size:18px;margin:24px 0 14px;color:#1a1a2e;">📖 Comment faire</h2>
      <ol style="font-size:15px;line-height:1.7;color:#4a4a68;padding-left:22px;margin:0 0 24px;">
        <li>Connecte-toi à l'interface DNS de ton fournisseur (celui chez qui ${domain} est enregistré).</li>
        <li>Ouvre la zone DNS du domaine <strong>${domain}</strong>.</li>
        <li>Pour chaque ligne du tableau ci-dessus :
          <ul style="padding-left:20px;margin:6px 0;">
            <li>Crée un nouvel enregistrement du <strong>type</strong> indiqué.</li>
            <li>Renseigne le <strong>nom / host</strong> exact.</li>
            <li>Copie-colle la <strong>valeur</strong> exactement (attention aux espaces).</li>
            <li>Laisse le TTL par défaut (généralement 3600 secondes / 1 heure).</li>
          </ul>
        </li>
        <li>Enregistre les modifications.</li>
        <li>Attends 10-30 minutes la propagation, puis nous vérifierons automatiquement.</li>
      </ol>

      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:16px;margin:0 0 24px;">
        <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#0c4a6e;">💡 Besoin d'aide ?</p>
        <p style="margin:0;font-size:14px;color:#075985;line-height:1.5;">
          Envoie ces 3 lignes par email à ton informaticien ou à ton fournisseur DNS — il saura quoi en faire.
          Sinon réponds à cet email et on s'en occupe ensemble.
        </p>
      </div>

      <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:24px 0 0;border-top:1px solid #e5e7eb;padding-top:20px;">
        Une fois la configuration en place et la vérification réussie, tu recevras un email de confirmation.
        D'ici là, tout fonctionne normalement sur LYTA — seul l'expéditeur des emails change ensuite.
      </p>

      <p style="font-size:14px;color:#4a4a68;margin:20px 0 0;">
        À très vite,<br><strong>L'équipe LYTA</strong>
      </p>
    </div>

    <div style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="margin:0;font-size:12px;color:#6b7280;">© ${new Date().getFullYear()} LYTA. Tous droits réservés.</p>
    </div>
  </div>
</body>
</html>`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "LYTA <support@lyta.ch>",
        to: [toEmail],
        subject: `🔧 Configuration DNS pour ${domain} — Étape finale`,
        html,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error("Failed to send DNS instructions email", { error: errorText, toEmail });
      return { success: false, message: `Resend error: ${errorText}` };
    }

    const result = await response.json();
    log.info("DNS instructions email sent to tenant", { toEmail, emailId: result.id });
    return { success: true, message: `Email envoyé à ${toEmail}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    log.error("DNS instructions email error", { error: message });
    return { success: false, message };
  }
}

async function addResendDomain(domain: string): Promise<{ success: boolean; message: string; domain_id?: string; records?: unknown[]; is_custom_domain?: boolean }> {
  if (!RESEND_API_KEY) {
    return { success: false, message: "Resend API key not configured" };
  }

  try {
    const listResponse = await fetch("https://api.resend.com/domains", {
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
    });

    const listData = await listResponse.json();

    if (listData.data) {
      const existingDomain = listData.data.find((item: { name: string }) => item.name === domain);
      if (existingDomain) {
        log.info("Resend domain already exists", { domain });
        return {
          success: true,
          message: `Domain ${domain} already configured in Resend`,
          domain_id: existingDomain.id,
          records: existingDomain.records,
          is_custom_domain: true,
        };
      }
    }

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
        is_custom_domain: true,
      };
    }

    log.error("Resend domain error", { error: createData });
    return {
      success: false,
      message: `Failed to add domain to Resend: ${createData.message || JSON.stringify(createData)}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    log.error("Resend API error", { error: message });
    return { success: false, message: `Resend API error: ${message}` };
  }
}

async function addResendDNSRecords(domain: string, records: Array<{ type: string; name: string; value: string }>): Promise<{ success: boolean; message: string }> {
  if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ZONE_ID) {
    return { success: false, message: "Cloudflare credentials not configured" };
  }

  const results: string[] = [];

  for (const record of records) {
    const fullRecordName = record.name.endsWith(`.${domain}`) ||
      record.name === domain ||
      record.name.endsWith(`.${TENANT_DOMAIN_SUFFIX}`) ||
      record.name === TENANT_DOMAIN_SUFFIX
      ? record.name
      : `${record.name}.${domain}`;
    const allowMultiple = record.type !== "CNAME";

    const result = await ensureCloudflareRecord({
      type: record.type,
      name: fullRecordName,
      content: record.value,
      proxied: false,
      allowMultiple,
    });

    results.push(result.message);
  }

  const hasFailure = results.some((message) => message.toLowerCase().includes("failed") || message.toLowerCase().includes("error"));

  return {
    success: !hasFailure,
    message: `DNS records processed: ${results.join(", ")}`,
  };
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase service credentials are not configured");
    }

    // Système d'auth :
    // - Si appelé avec le service_role bearer (depuis provision-self-signup-tenant
    //   ou autre fonction backend), on bypass le check king (caller=system)
    // - Sinon, on exige un user authentifié avec rôle king
    const authHeader = req.headers.get("authorization") || "";
    const bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    const isSystemCall = bearerToken === supabaseServiceKey;

    if (!isSystemCall) {
      const { user } = await requireAuth(req);
      const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: roleData } = await supabaseAuth
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();
      if (roleData?.role !== "king") {
        throw new Error("Unauthorized: Only KING users (or system) can run onboarding");
      }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { tenant_id, slug, tenant_name, step, email_domain }: OnboardingRequest = await req.json();

    if (!tenant_id || !slug || !tenant_name) {
      throw new Error("Missing required fields: tenant_id, slug, tenant_name");
    }

    const tenantDomain = buildTenantDomain(slug);

    const results: Record<string, unknown> = {
      tenant_id,
      slug,
      tenant_name,
      tenant_domain: tenantDomain,
      email_domain: email_domain || null,
      steps: [],
    };

    if (step === "dns" || step === "full") {
      await createKingNotification(supabase, {
        title: "Configuration DNS en cours",
        message: `Provisioning automatique de ${tenantDomain} sur Vercel et Cloudflare...`,
        kind: "info",
        priority: "high",
        tenant_id,
        tenant_name,
        metadata: { step: "dns", status: "in_progress", domain: tenantDomain },
      });

      const dnsResult = await ensureTenantDomainProvisioning(slug);
      results.dns = dnsResult;
      results.vercel = dnsResult.vercel;
      (results.steps as string[]).push("dns");

      await createKingNotification(supabase, {
        title: dnsResult.success ? "DNS configure" : "Erreur DNS",
        message: dnsResult.message,
        kind: dnsResult.success ? "success" : "error",
        priority: "high",
        tenant_id,
        tenant_name,
        metadata: {
          step: "dns",
          status: dnsResult.success ? "completed" : "failed",
          result: dnsResult,
        },
      });
    }

    if (step === "resend" || step === "full") {
      const resendDomain = email_domain || tenantDomain;
      const isCustomDomain = Boolean(email_domain);

      await createKingNotification(supabase, {
        title: "Configuration email en cours",
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

      if (resendResult.success && resendResult.records && Array.isArray(resendResult.records) && isCustomDomain) {
        const dnsRecords = resendResult.records as Array<{ type: string; name: string; value: string; priority?: number; ttl?: number }>;

        await createKingNotification(supabase, {
          title: "DNS a configurer par le tenant",
          message: `Le tenant doit ajouter ${dnsRecords.length} enregistrements DNS chez son provider pour ${resendDomain}`,
          kind: "warning",
          priority: "high",
          tenant_id,
          tenant_name,
          metadata: {
            step: "resend_dns_manual",
            status: "pending_tenant_action",
            domain: resendDomain,
            dns_records: dnsRecords.map((record) => ({
              type: record.type,
              name: record.name,
              value: record.value,
            })),
          },
        });

        // Envoi auto au tenant de l'email avec les records + instructions.
        // On récupère l'email admin/contact stocké sur la table tenants.
        const { data: tenantRow } = await supabase
          .from("tenants")
          .select("email, admin_email, name")
          .eq("id", tenant_id)
          .maybeSingle();

        const toEmail = (tenantRow?.admin_email as string | null)
          || (tenantRow?.email as string | null);
        const displayName = (tenantRow?.name as string | null) || tenant_name;

        if (toEmail) {
          const emailResult = await sendTenantDnsInstructionsEmail({
            toEmail,
            tenantName: displayName,
            domain: resendDomain,
            records: dnsRecords,
          });

          await createKingNotification(supabase, {
            title: emailResult.success
              ? "Email DNS envoye au tenant"
              : "Echec envoi email DNS au tenant",
            message: emailResult.success
              ? `Instructions envoyees a ${toEmail} pour le domaine ${resendDomain}.`
              : `Erreur: ${emailResult.message}. Le tenant ne recevra pas les instructions automatiquement.`,
            kind: emailResult.success ? "success" : "error",
            priority: emailResult.success ? "normal" : "high",
            tenant_id,
            tenant_name,
            metadata: {
              step: "resend_dns_email",
              status: emailResult.success ? "sent" : "failed",
              to: toEmail,
              domain: resendDomain,
            },
          });
        } else {
          await createKingNotification(supabase, {
            title: "Aucun email tenant pour envoyer les DNS",
            message: `Le tenant ${displayName} n'a pas d'email admin/contact. Les instructions DNS doivent etre transmises manuellement.`,
            kind: "warning",
            priority: "high",
            tenant_id,
            tenant_name,
            metadata: { step: "resend_dns_email", status: "no_tenant_email" },
          });
        }

        results.resend_dns = {
          success: true,
          message: `${dnsRecords.length} DNS records need to be configured by tenant`,
          requires_tenant_action: true,
          tenant_email_sent: Boolean(toEmail),
          records: dnsRecords,
        };
      } else if (resendResult.success && resendResult.records && Array.isArray(resendResult.records)) {
        await createKingNotification(supabase, {
          title: "Configuration DNS email",
          message: `Ajout des enregistrements SPF, DKIM et DMARC pour ${resendDomain}...`,
          kind: "info",
          priority: "normal",
          tenant_id,
          tenant_name,
          metadata: { step: "resend_dns", status: "in_progress" },
        });

        const dnsRecords = resendResult.records as Array<{ type: string; name: string; value: string }>;
        const resendDnsResult = await addResendDNSRecords(resendDomain, dnsRecords);
        results.resend_dns = resendDnsResult;

        await createKingNotification(supabase, {
          title: resendDnsResult.success ? "DNS email configure" : "DNS email partiel",
          message: resendDnsResult.message,
          kind: resendDnsResult.success ? "success" : "warning",
          priority: "normal",
          tenant_id,
          tenant_name,
          metadata: { step: "resend_dns", status: "completed", result: resendDnsResult },
        });
      }

      await createKingNotification(supabase, {
        title: resendResult.success ? "Email configure" : "Erreur email",
        message: resendResult.message,
        kind: resendResult.success ? "success" : "error",
        priority: "high",
        tenant_id,
        tenant_name,
        metadata: {
          step: "resend",
          status: resendResult.success ? "completed" : "failed",
          result: resendResult,
          is_custom_domain: isCustomDomain,
        },
      });
    }

    if (step === "full") {
      const dnsSuccess = (results.dns as { success?: boolean })?.success === true;
      const resendSuccess = (results.resend as { success?: boolean })?.success !== false;
      const allSuccess = dnsSuccess && resendSuccess;

      await createKingNotification(supabase, {
        title: allSuccess ? "Onboarding termine" : "Onboarding partiel",
        message: allSuccess
          ? `Le tenant ${tenant_name} est pret. Sous-domaine: ${tenantDomain}`
          : `Certaines etapes ont echoue pour ${tenant_name}. Verifiez les details.`,
        kind: allSuccess ? "success" : "warning",
        priority: "high",
        tenant_id,
        tenant_name,
        metadata: { step: "complete", results },
      });

      await supabase
        .from("tenants")
        .update({
          onboarding_completed: allSuccess,
          onboarding_last_error: allSuccess ? null : JSON.stringify({
            dns: (results.dns as any)?.message,
            vercel: (results.vercel as any)?.message,
            resend: (results.resend as any)?.message,
          }),
          metadata: {
            onboarding_completed: allSuccess,
            onboarding_date: new Date().toISOString(),
            dns_configured: dnsSuccess,
            vercel_domain_configured: (results.vercel as { success?: boolean })?.success === true,
            resend_configured: (results.resend as { success?: boolean })?.success || false,
            tenant_domain: tenantDomain,
          },
        })
        .eq("id", tenant_id);
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: error.status, headers: { "Content-Type": "application/json", ...getCorsHeaders(req) } },
      );
    }

    const message = error instanceof Error ? error.message : "Unknown onboarding error";
    log.error("Onboarding error", { error: message });

    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { "Content-Type": "application/json", ...getCorsHeaders(req) } },
    );
  }
});
