/**
 * provision-self-signup-tenant
 * ============================
 * Orchestrateur central du flow self-signup. Appelé par lyta.ch/access (Lovable)
 * au submit du formulaire post-paiement.
 *
 * 1. Vérifie la session Stripe (paiement OK)
 * 2. Idempotence : si un tenant existe déjà pour cette session → retourne-le
 * 3. Crée le tenant en `pending_setup`
 * 4. Crée l'admin user via create-tenant-admin (envoie l'email bienvenue avec magic link)
 * 5. Déclenche tenant-onboarding pour DNS Cloudflare + projet Vercel + Resend
 * 6. Notification king
 * 7. Retourne {tenant_id, slug, url}
 *
 * Public — la sécurité repose sur la session Stripe (qui contient un secret
 * non-devinable et a été retournée par Stripe à la fin du paiement).
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("provision-self-signup-tenant");

const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const stripe = new Stripe(STRIPE_KEY, { apiVersion: "2024-09-30.acacia" });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const RESERVED_SLUGS = new Set([
  "www", "app", "api", "admin", "king", "support", "help",
  "lyta", "advisy", "blog", "docs", "status", "mail",
  "ftp", "ns1", "ns2", "test", "staging", "dev", "preview",
  "demo", "beta", "auth", "login", "signup", "inscription",
  "access", "checkout", "pay", "billing", "stripe",
]);

interface ReqBody {
  stripe_session_id?: string;
  tenant_name?: string;
  /** Raison sociale (si différente du nom commercial) */
  legal_name?: string;
  slug?: string;
  admin_first_name?: string;
  admin_last_name?: string;
  admin_phone?: string;
  /** Permet d'overrider l'email payé sur Stripe (rare, par défaut on prend celui du paiement) */
  admin_email?: string;
  /** Email back-office optionnel (pour notifications contrats) */
  backoffice_email?: string;
  language?: "fr" | "de" | "it" | "en";
  /** Branding visuel — stockés dans tenant_branding */
  primary_color?: string;
  secondary_color?: string;
  /** Logo PNG/JPEG/WebP/SVG en base64 (data:image/...;base64,xxxx). Max 2 Mo. */
  logo_base64?: string;
  logo_filename?: string;
  /** Sièges supplémentaires (CHF 20/mois chacun) */
  extra_users?: number;
}

function sluggify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, 40);
}

function isValidSlug(s: string): boolean {
  return /^[a-z][a-z0-9-]{2,39}$/.test(s);
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const body = (await req.json().catch(() => ({}))) as ReqBody;
    const sessionId = body.stripe_session_id?.trim();
    const tenantName = body.tenant_name?.trim();
    const legalName = body.legal_name?.trim() || null;
    const slugRaw = body.slug?.trim();
    const firstName = body.admin_first_name?.trim();
    const lastName  = body.admin_last_name?.trim();
    const phone     = body.admin_phone?.trim() || null;
    const backofficeEmail = body.backoffice_email?.trim().toLowerCase() || null;
    const language  = body.language || "fr";
    const primaryColor   = body.primary_color?.trim() || "#3B82F6";
    const secondaryColor = body.secondary_color?.trim() || "#10B981";
    const extraUsers     = Math.max(0, Math.min(50, body.extra_users ?? 0));
    const logoBase64     = body.logo_base64?.trim() || null;
    const logoFilename   = body.logo_filename?.trim() || null;

    // ============ Validation ============
    if (!sessionId) {
      return new Response(JSON.stringify({ error: "stripe_session_id required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    if (!tenantName || tenantName.length < 2) {
      return new Response(JSON.stringify({ error: "tenant_name required (min 2 chars)" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    if (!firstName || !lastName) {
      return new Response(JSON.stringify({ error: "admin_first_name and admin_last_name required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const slug = sluggify(slugRaw || tenantName);
    if (!isValidSlug(slug)) {
      return new Response(JSON.stringify({
        error: "invalid_slug",
        message: "Le slug doit faire 3-40 caractères, commencer par une lettre, ne contenir que lettres/chiffres/tirets.",
      }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (RESERVED_SLUGS.has(slug)) {
      return new Response(JSON.stringify({
        error: "reserved_slug",
        message: "Ce nom est réservé. Choisis-en un autre.",
      }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ============ Idempotence : tenant déjà provisionné ============
    const { data: existing } = await supabase
      .from("tenants")
      .select("id, slug, name, tenant_status")
      .eq("signup_session_id", sessionId)
      .maybeSingle();

    if (existing) {
      log.info("Idempotent — tenant already exists for this session", { sessionId, tenantId: existing.id });
      return new Response(JSON.stringify({
        ok: true,
        already_provisioned: true,
        tenant_id: existing.id,
        slug: existing.slug,
        name: existing.name,
        tenant_status: existing.tenant_status,
        url: `https://${existing.slug}.lyta.ch`,
        login_url: `https://${existing.slug}.lyta.ch/connexion`,
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ============ Vérification Stripe ============
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });
    if (!session) {
      return new Response(JSON.stringify({ error: "session_not_found" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
      return new Response(JSON.stringify({
        error: "payment_not_completed",
        payment_status: session.payment_status,
        message: "Le paiement n'a pas été complété sur Stripe. Réessaye le paiement.",
      }), { status: 402, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const adminEmail = (body.admin_email
      || session.customer_email
      || session.customer_details?.email
      || "").trim().toLowerCase();
    if (!adminEmail) {
      return new Response(JSON.stringify({ error: "no email in Stripe session" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const planId = (session.metadata?.plan_id || "").toLowerCase().trim();
    const affiliateRef = (session.metadata?.affiliate_ref || "").trim();
    const stripeCustomerId = typeof session.customer === "string" ? session.customer : session.customer?.id || null;
    const stripeSubscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id || null;

    // Si affiliate_ref → lookup l'affilié + sa rate par défaut + son eligibility
    let affiliateLink: {
      id: string;
      commission_rate: number;
      eligibility_end: string;
    } | null = null;
    if (affiliateRef) {
      const { data: affiliate } = await supabase
        .from("affiliates")
        .select("id, commission_rate, default_eligibility_months, status")
        .filter("ref_code", "ilike", affiliateRef)
        .eq("status", "active")
        .maybeSingle();
      if (affiliate) {
        const months = affiliate.default_eligibility_months || 12;
        const end = new Date();
        end.setMonth(end.getMonth() + months);
        affiliateLink = {
          id: affiliate.id,
          commission_rate: Number(affiliate.commission_rate),
          eligibility_end: end.toISOString(),
        };
      }
    }

    let trialEndsAt: string | null = null;
    if (session.subscription && typeof session.subscription === "object" && "trial_end" in session.subscription) {
      const t = (session.subscription as any).trial_end;
      if (t) trialEndsAt = new Date(t * 1000).toISOString();
    }

    // ============ Vérifier que le slug n'est pas pris (race condition) ============
    const { data: slugTaken } = await supabase
      .from("tenants").select("id").eq("slug", slug).maybeSingle();
    if (slugTaken) {
      return new Response(JSON.stringify({
        error: "slug_taken",
        message: "Ce nom a été pris entre-temps. Choisis-en un autre.",
      }), { status: 409, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ============ Création tenant ============
    log.info("Creating tenant for self-signup", { slug, adminEmail, planId });

    const { data: tenant, error: tenantErr } = await supabase
      .from("tenants")
      .insert({
        name: tenantName,
        legal_name: legalName,
        slug,
        email: adminEmail,
        admin_email: adminEmail,
        phone,
        status: "active",
        tenant_status: "pending_setup",
        payment_status: "trialing",
        plan: planId || null,
        extra_users: extraUsers,
        contract_notification_emails: backofficeEmail ? [backofficeEmail] : [],
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        signup_source: "self_signup",
        signup_session_id: sessionId,
        trial_ends_at: trialEndsAt,
        // Tracking apporteur d'affaires (si lien valide)
        affiliate_id: affiliateLink?.id || null,
        affiliate_commission_rate: affiliateLink?.commission_rate || null,
        affiliate_linked_at: affiliateLink ? new Date().toISOString() : null,
        affiliate_eligibility_end: affiliateLink?.eligibility_end || null,
      })
      .select("id")
      .single();

    if (tenantErr || !tenant) {
      log.error("Failed to create tenant", { err: tenantErr?.message });
      return new Response(JSON.stringify({ error: "Tenant creation failed", details: tenantErr?.message }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const tenantId = tenant.id;

    // ============ Upload logo (si fourni) + tenant_branding ============
    let uploadedLogoUrl: string | null = null;
    if (logoBase64) {
      try {
        // Parse data URL : "data:image/png;base64,iVBORw0KG..."
        const match = logoBase64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (!match) {
          log.warn("logo_base64 format invalide — skip upload");
        } else {
          const mimeType = match[1];
          const b64data  = match[2];
          // Decode base64 → Uint8Array
          const binary = atob(b64data);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          // Limite 2 Mo serveur (au cas où le client a triché)
          if (bytes.length > 2 * 1024 * 1024) {
            log.warn("logo dépasse 2Mo — skip upload");
          } else {
            const ext = (logoFilename?.split('.').pop()?.toLowerCase())
              || (mimeType.split('/')[1] || 'png').replace('+xml', '');
            const path = `${tenantId}/logo-${Date.now()}.${ext}`;
            const { error: upErr } = await supabase.storage
              .from('tenant-logos')
              .upload(path, bytes, {
                contentType: mimeType,
                upsert: true,
                cacheControl: '3600',
              });
            if (upErr) {
              log.warn("logo upload failed", { err: upErr.message });
            } else {
              const { data: pub } = supabase.storage.from('tenant-logos').getPublicUrl(path);
              uploadedLogoUrl = pub?.publicUrl || null;
              log.info("logo uploaded", { url: uploadedLogoUrl });
            }
          }
        }
      } catch (e) {
        log.warn("logo processing exception", { err: (e as any)?.message });
      }
    }

    // tenant_branding upsert (logo + couleurs, même si pas de logo on stocke les couleurs)
    try {
      await supabase.from('tenant_branding').upsert({
        tenant_id: tenantId,
        logo_url: uploadedLogoUrl,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        display_name: tenantName,
      }, { onConflict: 'tenant_id' });
    } catch (e) {
      log.warn("tenant_branding upsert failed", { err: (e as any)?.message });
    }

    // ============ Création admin user (envoie email avec magic link) ============
    let adminCreationOk = false;
    let adminCreationError: string | null = null;
    try {
      const adminRes = await fetch(`${SUPABASE_URL}/functions/v1/create-tenant-admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SERVICE_KEY}`,
          "apikey": SERVICE_KEY,
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          email: adminEmail,
          first_name: firstName,
          last_name: lastName,
          phone,
          language,
        }),
      });
      const adminData = await adminRes.json().catch(() => ({}));
      if (!adminRes.ok) {
        adminCreationError = adminData.error || `HTTP ${adminRes.status}`;
        log.warn("create-tenant-admin returned error", { adminCreationError });
      } else {
        adminCreationOk = true;
      }
    } catch (e) {
      adminCreationError = (e as any)?.message || String(e);
      log.error("create-tenant-admin invocation failed", { adminCreationError });
    }

    // ============ Onboarding DNS / Vercel / Resend (SYNCHRONE avec timeout) ============
    // ZERO TOLERANCE : on attend le résultat avec 25s max pour pouvoir notifier
    // le user immédiatement. Si timeout/erreur, un pg_cron retry prend le relais.
    let onboardingOk = false;
    let onboardingError: string | null = null;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25_000);
      const obRes = await fetch(`${SUPABASE_URL}/functions/v1/tenant-onboarding`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SERVICE_KEY}`,
          "apikey": SERVICE_KEY,
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          slug,
          tenant_name: tenantName,
          step: "full",
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));
      const obJson = await obRes.json().catch(() => ({} as any));
      if (!obRes.ok) {
        onboardingError = obJson?.error || `HTTP ${obRes.status}`;
      } else {
        onboardingOk = obJson?.success !== false;
        if (!onboardingOk) onboardingError = obJson?.message || "Onboarding non confirmé";
      }
    } catch (e) {
      const msg = (e as any)?.name === "AbortError"
        ? "Timeout 25s (DNS sera retenté par le cron)"
        : (e as any)?.message || String(e);
      onboardingError = msg;
      log.warn("tenant-onboarding sync call failed", { err: msg });
    }

    // Notif King obligatoire (succès ou échec)
    await supabase.from("king_notifications").insert({
      title: onboardingOk ? "✅ DNS configuré" : "❌ DNS échoué (retry auto)",
      message: onboardingOk
        ? `${slug}.lyta.ch est actif sur Cloudflare + Vercel.`
        : `${slug}.lyta.ch : ${onboardingError}. pg_cron retentera dans 5 min.`,
      kind: onboardingOk ? "tenant_onboarding_ok" : "tenant_onboarding_failed",
      priority: onboardingOk ? "low" : "high",
      tenant_id: tenantId,
      tenant_name: tenantName,
      action_url: `/king/tenants/${tenantId}`,
      action_label: onboardingOk ? "Voir le tenant" : "Diagnostiquer",
      metadata: { onboarding_error: onboardingError, slug },
    }).catch(() => null);

    // ============ Notification king ============
    await supabase.from("king_notifications").insert({
      title: "🎉 Nouveau cabinet self-signup",
      message: `${tenantName} (${slug}.lyta.ch) — admin: ${adminEmail}`,
      kind: "tenant_created",
      priority: "high",
      tenant_id: tenantId,
      tenant_name: tenantName,
      action_url: `/king/tenants/${tenantId}`,
      action_label: "Voir le tenant",
      metadata: {
        plan_id: planId,
        signup_session_id: sessionId,
        trial_ends_at: trialEndsAt,
        admin_creation_ok: adminCreationOk,
        admin_creation_error: adminCreationError,
      },
    }).catch(() => null);

    // Marquer signup_completed_at
    await supabase
      .from("tenants")
      .update({ signup_completed_at: new Date().toISOString() })
      .eq("id", tenantId);

    // Marquer le pending_signups comme finalisé (le tenant n'est plus orphelin)
    await supabase
      .from("pending_signups")
      .update({
        status: 'finalized',
        finalized_at: new Date().toISOString(),
        finalized_tenant_id: tenantId,
      })
      .eq("stripe_session_id", sessionId);

    const dnsMessage = onboardingOk
      ? "Le DNS est configuré, ton sous-domaine est actif."
      : "Le DNS n'a pas pu être configuré tout de suite, un retry automatique tourne toutes les 5 min (sinon contacte le support).";
    const emailMessage = adminCreationOk
      ? "Vérifie ta boîte mail pour le lien de connexion."
      : "L'email d'accès n'a pas pu être envoyé — contacte le support.";

    return new Response(JSON.stringify({
      ok: true,
      tenant_id: tenantId,
      slug,
      name: tenantName,
      url: `https://${slug}.lyta.ch`,
      login_url: `https://${slug}.lyta.ch/connexion`,
      admin_email: adminEmail,
      trial_ends_at: trialEndsAt,
      admin_email_sent: adminCreationOk,
      admin_email_error: adminCreationError,
      dns_ready: onboardingOk,
      dns_error: onboardingError,
      message: `Cabinet créé. ${emailMessage} ${dnsMessage}`,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err) {
    log.error("Unexpected error", { err: (err as any)?.message });
    return new Response(JSON.stringify({ error: "Internal error", details: (err as any)?.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
