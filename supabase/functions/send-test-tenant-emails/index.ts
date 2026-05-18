/**
 * send-test-tenant-emails
 * =======================
 * King-only : envoie un email de TEST de chaque template auto à une boîte
 * cible, pour valider visuellement le rendu (branding, templates, etc.).
 *
 * Body : { target_email: string, tenant_id?: string, types?: string[] }
 *
 * Types supportés (par défaut tous) :
 *  - welcome             (envoi bienvenue espace client)
 *  - account_created     (compte client créé)
 *  - contract_signed     (contrat signé)
 *  - mandat_signed       (mandat de gestion signé)
 *  - relation_client     (relation client transmise)
 *  - offre_speciale      (offre commerciale)
 *  - password_reset      (lien de réinitialisation)
 *  - finalize_signup     (filet post-paiement Stripe)
 *
 * Pour chaque type, on appelle l'edge function de production sous-jacente
 * avec des données stub (pas besoin de créer un vrai contrat/client).
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAuth, AuthError } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("send-test-tenant-emails");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const APP_BASE = Deno.env.get("PUBLIC_APP_URL") || "https://app.lyta.ch";

const CRM_EMAIL_TYPES = [
  "welcome",
  "account_created",
  "contract_signed",
  "mandat_signed",
  "relation_client",
  "offre_speciale",
] as const;

const ALL_TYPES = [...CRM_EMAIL_TYPES, "password_reset", "finalize_signup"];

interface ReqBody {
  target_email?: string;
  tenant_id?: string;
  types?: string[];
}

interface DispatchResult {
  type: string;
  ok: boolean;
  error?: string;
}

async function callEdgeFunction(name: string, body: any): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: json?.error || `HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as any)?.message || String(e) };
  }
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

  try {
    const { user } = await requireAuth(req);
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Vérif king
    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id);
    const isKing = (roles || []).some((r: any) => r.role === "king");
    if (!isKing) throw new AuthError("King role required", 403);

    if (!RESEND_API_KEY) {
      throw new AuthError("RESEND_API_KEY non configurée", 500);
    }

    const body = (await req.json().catch(() => ({}))) as ReqBody;
    const targetEmail = body.target_email?.trim().toLowerCase();
    const requestedTypes = body.types && body.types.length > 0 ? body.types : ALL_TYPES;

    if (!targetEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(targetEmail)) {
      throw new AuthError("target_email invalide", 400);
    }

    // Récupère un tenant (soit celui demandé, soit le 1er actif comme défaut)
    let tenantId = body.tenant_id?.trim();
    if (!tenantId) {
      const { data: defaultTenant } = await supabase
        .from("tenants")
        .select("id, name, slug")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!defaultTenant) throw new AuthError("Aucun tenant actif en DB", 400);
      tenantId = defaultTenant.id;
    }

    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, name, slug")
      .eq("id", tenantId)
      .maybeSingle();
    if (!tenant) throw new AuthError("Tenant introuvable", 404);

    const results: DispatchResult[] = [];
    const tenantSlug = tenant.slug || "demo";

    for (const type of requestedTypes) {
      if (!ALL_TYPES.includes(type as any)) {
        results.push({ type, ok: false, error: "Type inconnu" });
        continue;
      }

      // CRM email types → on appelle send-crm-email
      if ((CRM_EMAIL_TYPES as readonly string[]).includes(type)) {
        const stub: any = {
          welcome: { contract_link: `https://${tenantSlug}.lyta.ch/espace-client` },
          account_created: {
            login_url: `https://${tenantSlug}.lyta.ch/connexion`,
            temp_password: "TestTemp123!",
          },
          contract_signed: {
            contract_number: "TEST-001",
            company: "Allianz Suisse",
            product: "RC privée",
            signed_date: new Date().toLocaleDateString("fr-CH"),
          },
          mandat_signed: {
            mandate_url: `https://${tenantSlug}.lyta.ch/espace-client/documents`,
            temp_password: "TestTemp123!",
          },
          relation_client: {
            collaborator_name: "Jean Dupont",
            collaborator_email: "jean@example.ch",
          },
          offre_speciale: {
            offer_title: "Offre exclusive — 10% sur RC",
            offer_message: "Profitez de notre nouvelle offre RC à -10% jusqu'au 30/06.",
          },
        }[type] || {};

        const r = await callEdgeFunction("send-crm-email", {
          type,
          clientEmail: targetEmail,
          clientName: "Habib (TEST)",
          tenantId,
          tenantSlug,
          data: stub,
        });
        results.push({ type, ...r });
      } else if (type === "password_reset") {
        const r = await callEdgeFunction("send-password-reset", {
          email: targetEmail,
          redirectUrl: `${APP_BASE}/reset-password`,
        });
        results.push({ type, ...r });
      } else if (type === "finalize_signup") {
        // Envoi direct Resend (l'email finalize n'a pas d'edge function dédié,
        // c'est noyé dans stripe-webhook). On envoie un HTML similaire.
        const finalizeUrl = `${APP_BASE}/finalize?session_id=TEST_SESSION_ID`;
        const html = `<!doctype html><html><body style="font-family:sans-serif;background:#f5f6fa;padding:24px">
          <div style="max-width:560px;margin:auto;background:white;border-radius:12px;padding:32px">
            <h2 style="color:#1800AD;margin:0 0 8px">Paiement reçu ✅ (TEST)</h2>
            <p>Merci pour ton inscription LYTA. Dernière étape : nous donner le nom de ton cabinet.</p>
            <p style="margin:24px 0">
              <a href="${finalizeUrl}" style="display:inline-block;background:#1800AD;color:white;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Finaliser mon inscription</a>
            </p>
            <p style="font-size:12px;color:#888">[Test email envoyé depuis send-test-tenant-emails. Le lien ne fonctionnera pas car session_id factice.]</p>
          </div></body></html>`;
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "LYTA <support@lyta.ch>",
              to: [targetEmail],
              subject: "[TEST] Active ton cabinet LYTA — dernière étape",
              html,
            }),
          });
          if (!res.ok) {
            const txt = await res.text();
            results.push({ type, ok: false, error: `Resend ${res.status}: ${txt.slice(0, 200)}` });
          } else {
            results.push({ type, ok: true });
          }
        } catch (e) {
          results.push({ type, ok: false, error: (e as any)?.message || String(e) });
        }
      }
    }

    log.info("Test emails dispatched", { targetEmail, tenantId, results });

    return new Response(JSON.stringify({
      ok: true,
      target_email: targetEmail,
      tenant_id: tenantId,
      tenant_name: tenant.name,
      sent: results.filter(r => r.ok).length,
      failed: results.filter(r => !r.ok).length,
      results,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err) {
    if (err instanceof AuthError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: err.status, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    log.error("Unexpected error", { err: (err as any)?.message });
    return new Response(JSON.stringify({ error: "Internal error", details: (err as any)?.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
