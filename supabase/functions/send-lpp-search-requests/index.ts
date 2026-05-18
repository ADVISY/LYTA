/**
 * send-lpp-search-requests
 * ========================
 * Envoie automatiquement 2 emails aux institutions officielles LPP suisses :
 *  1. Centrale du 2e pilier (Sicherheitsfonds BVG / Zentralstelle 2. Säule)
 *  2. Fondation Institution Supplétive LPP (Stiftung Auffangeinrichtung BVG)
 *
 * Pour chaque institution :
 * - Email pré-rempli avec données client + AVS
 * - Pièces jointes : pièce d'identité + procuration depuis storage policy_documents
 *
 * Log dans tenant_email_log (kind='lpp_search') pour tracking dans Publicité.
 * Crée une entrée lpp_search_requests pour suivi global.
 *
 * Body : { policy_id: string, document_ids?: string[] }
 *        (si document_ids absent → utilise tous les docs ID + procuration du contrat)
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAuth, AuthError } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("send-lpp-search-requests");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// Adresses email officielles (modifiables via env si jamais elles changent)
const CENTRALE_EMAIL = Deno.env.get("LPP_CENTRALE_EMAIL") || "info@sfbvg.ch";
const SUPPLETIVE_EMAIL = Deno.env.get("LPP_SUPPLETIVE_EMAIL") || "kontakt@chaeis.net";

interface ReqBody {
  policy_id: string;
  document_ids?: string[];
  notes?: string;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function buildCentraleEmailHtml(client: any): string {
  const fn = client.first_name || "";
  const ln = client.last_name || "";
  const dn = client.birthdate ? new Date(client.birthdate).toLocaleDateString("fr-CH") : "—";
  const avs = client.numero_avs || client.avs || "—";
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.6">
  <p>Madame, Monsieur,</p>
  <p>Par la présente, nous vous prions de bien vouloir effectuer une recherche complète d'avoirs de prévoyance professionnelle (2e pilier) pour la personne suivante :</p>
  <table style="border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:6px 12px;background:#f5f5f5"><strong>Nom</strong></td><td style="padding:6px 12px">${escapeHtml(ln)}</td></tr>
    <tr><td style="padding:6px 12px;background:#f5f5f5"><strong>Prénom</strong></td><td style="padding:6px 12px">${escapeHtml(fn)}</td></tr>
    <tr><td style="padding:6px 12px;background:#f5f5f5"><strong>Date de naissance</strong></td><td style="padding:6px 12px">${dn}</td></tr>
    <tr><td style="padding:6px 12px;background:#f5f5f5"><strong>N° AVS</strong></td><td style="padding:6px 12px">${escapeHtml(avs)}</td></tr>
  </table>
  <p>Vous trouverez en annexe :</p>
  <ul>
    <li>Une copie de la pièce d'identité</li>
    <li>La procuration signée par le mandant</li>
  </ul>
  <p>Merci de bien vouloir nous communiquer la liste des institutions de prévoyance ayant ou ayant eu un compte au nom de cette personne, conformément à l'article 24a OPP 2.</p>
  <p>Avec nos meilleures salutations,</p>
  <p><strong>${escapeHtml(client.cabinet_name || "Cabinet de conseil en assurance")}</strong></p>
  </body></html>`;
}

function buildSuppletiveEmailHtml(client: any): string {
  const fn = client.first_name || "";
  const ln = client.last_name || "";
  const dn = client.birthdate ? new Date(client.birthdate).toLocaleDateString("fr-CH") : "—";
  const avs = client.numero_avs || client.avs || "—";
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.6">
  <p>Sehr geehrte Damen und Herren / Madame, Monsieur,</p>
  <p>Nous sollicitons par la présente une recherche d'avoirs de libre passage déposés auprès de votre Fondation Institution Supplétive LPP pour la personne suivante :</p>
  <table style="border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:6px 12px;background:#f5f5f5"><strong>Nom</strong></td><td style="padding:6px 12px">${escapeHtml(ln)}</td></tr>
    <tr><td style="padding:6px 12px;background:#f5f5f5"><strong>Prénom</strong></td><td style="padding:6px 12px">${escapeHtml(fn)}</td></tr>
    <tr><td style="padding:6px 12px;background:#f5f5f5"><strong>Date de naissance</strong></td><td style="padding:6px 12px">${dn}</td></tr>
    <tr><td style="padding:6px 12px;background:#f5f5f5"><strong>N° AVS</strong></td><td style="padding:6px 12px">${escapeHtml(avs)}</td></tr>
  </table>
  <p>Vous trouverez en annexe :</p>
  <ul>
    <li>Copie de la pièce d'identité</li>
    <li>Procuration signée</li>
  </ul>
  <p>Merci de nous communiquer si vous détenez des avoirs au nom de cette personne, et le cas échéant le montant et les modalités de transfert.</p>
  <p>Mit freundlichen Grüssen / Avec nos meilleures salutations,</p>
  <p><strong>${escapeHtml(client.cabinet_name || "Cabinet de conseil en assurance")}</strong></p>
  </body></html>`;
}

async function downloadAndEncode(supabase: any, fileKey: string): Promise<{ filename: string; content: string } | null> {
  try {
    const { data, error } = await supabase.storage.from("documents").download(fileKey);
    if (error || !data) return null;
    const buf = await data.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    const filename = fileKey.split("/").pop() || "document";
    return { filename, content: base64 };
  } catch (e) {
    log.warn("download failed", { fileKey, err: (e as any)?.message });
    return null;
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

    if (!RESEND_API_KEY) {
      throw new AuthError("RESEND_API_KEY non configurée", 500);
    }

    const body = (await req.json().catch(() => ({}))) as ReqBody;
    if (!body.policy_id) throw new AuthError("policy_id requis", 400);

    // Récupère le contrat + client + tenant (incluant les emails du tenant
    // pour pouvoir mettre reply_to = email cabinet, et utiliser le sender
    // custom s'il est vérifié sur Resend)
    const { data: policy, error: pErr } = await supabase
      .from("policies")
      .select(`
        id, tenant_id, client_id, product_type, notes,
        clients:client_id (id, first_name, last_name, email, birthdate),
        tenants:tenant_id (id, name, email, admin_email, tenant_branding(display_name, email_sender_name, email_sender_address))
      `)
      .eq("id", body.policy_id)
      .maybeSingle();
    if (pErr || !policy) throw new AuthError("Policy introuvable", 404);

    if (policy.product_type !== "lpp") {
      throw new AuthError("Ce contrat n'est pas un contrat LPP", 400);
    }

    // Vérif accès tenant
    const { data: assignment } = await supabase
      .from("user_tenant_assignments")
      .select("tenant_id")
      .eq("user_id", user.id)
      .eq("tenant_id", policy.tenant_id)
      .maybeSingle();
    if (!assignment) {
      // King peut tout faire
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      if (!(roles || []).some((r: any) => r.role === "king")) {
        throw new AuthError("Accès refusé à ce contrat", 403);
      }
    }

    const client = Array.isArray(policy.clients) ? policy.clients[0] : policy.clients;
    const tenant = Array.isArray(policy.tenants) ? policy.tenants[0] : policy.tenants;
    const branding = tenant?.tenant_branding && (Array.isArray(tenant.tenant_branding) ? tenant.tenant_branding[0] : tenant.tenant_branding);
    const cabinetName = branding?.display_name || branding?.email_sender_name || tenant?.name || "Cabinet de conseil";

    // Email du tenant → utilisé comme reply_to pour que les réponses des
    // institutions arrivent directement chez le cabinet (pas chez LYTA support)
    const tenantReplyTo = (
      branding?.email_sender_address
      || tenant?.admin_email
      || tenant?.email
      || ""
    ).trim();

    // Sender : on essaie d'utiliser l'adresse custom du tenant si elle est sur
    // un domaine déjà vérifié sur Resend (lyta.ch / e-advisy.ch — la whitelist
    // matche email-sender.ts du codebase). Sinon fallback support@lyta.ch.
    const verifiedDomains = /@(lyta\.ch|e-advisy\.ch)$/i;
    const senderAddress = branding?.email_sender_address && verifiedDomains.test(branding.email_sender_address)
      ? branding.email_sender_address
      : "support@lyta.ch";

    // Récupère le n° AVS depuis policy.notes (jsonb formData stocké au dépôt LPP)
    let numeroAvs = "";
    try {
      const notes = typeof policy.notes === "string" ? JSON.parse(policy.notes) : policy.notes;
      numeroAvs = notes?.numeroAvs || notes?.numero_avs || "";
    } catch { /* keep empty */ }

    const clientPayload = {
      ...client,
      numero_avs: numeroAvs,
      cabinet_name: cabinetName,
    };

    // Récupère les documents (depuis policy_documents ou via document_ids spécifiés)
    let attachments: Array<{ filename: string; content: string }> = [];
    if (body.document_ids && body.document_ids.length > 0) {
      const { data: docs } = await supabase
        .from("policy_documents")
        .select("file_key, file_name")
        .in("id", body.document_ids);
      for (const d of (docs || []) as any[]) {
        const enc = await downloadAndEncode(supabase, d.file_key);
        if (enc) attachments.push({ filename: d.file_name || enc.filename, content: enc.content });
      }
    } else {
      // Fallback : tous les docs de la policy avec doc_kind ID ou procuration
      const { data: docs } = await supabase
        .from("policy_documents")
        .select("file_key, file_name, doc_kind")
        .eq("policy_id", policy.id);
      for (const d of (docs || []) as any[]) {
        const kind = (d.doc_kind || "").toLowerCase();
        if (kind.includes("ident") || kind.includes("procur") || kind.includes("lpp_doc_0") || kind.includes("lpp_doc_2")) {
          const enc = await downloadAndEncode(supabase, d.file_key);
          if (enc) attachments.push({ filename: d.file_name || enc.filename, content: enc.content });
        }
      }
    }

    // Crée la ligne lpp_search_requests d'abord
    const { data: searchRow, error: srErr } = await supabase
      .from("lpp_search_requests")
      .insert({
        tenant_id: policy.tenant_id,
        policy_id: policy.id,
        client_id: client?.id || null,
        client_full_name: `${client?.first_name || ""} ${client?.last_name || ""}`.trim() || "Client",
        client_birthdate: client?.birthdate || null,
        client_avs_number: numeroAvs || null,
        documents_attached: attachments.map(a => a.filename),
        overall_status: "in_progress",
        requested_by: user.id,
        notes: body.notes || null,
      })
      .select("id")
      .single();
    if (srErr) {
      log.error("lpp_search_requests insert failed", { err: srErr.message });
      throw new AuthError(`DB error: ${srErr.message}`, 500);
    }
    const searchId = searchRow.id;

    const results: Array<{ institution: string; status: string; email_log_id?: string; error?: string }> = [];

    // Email 1 : Centrale 2e pilier
    const centraleSubject = `Recherche d'avoirs LPP — ${client?.last_name || ""} ${client?.first_name || ""}`.trim();
    const centraleHtml = buildCentraleEmailHtml(clientPayload);
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${cabinetName} <${senderAddress}>`,
          reply_to: tenantReplyTo || undefined,
          to: [CENTRALE_EMAIL],
          subject: centraleSubject,
          html: centraleHtml,
          attachments,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        results.push({ institution: "centrale", status: "failed", error: `Resend ${res.status}: ${txt.slice(0, 200)}` });
      } else {
        // Log dans tenant_email_log
        const { data: log1 } = await supabase.from("tenant_email_log").insert({
          tenant_id: policy.tenant_id,
          kind: "lpp_search",
          recipient_email: CENTRALE_EMAIL,
          recipient_name: "Centrale du 2e pilier",
          subject: centraleSubject,
          status: "sent",
          sent_at: new Date().toISOString(),
          related_entity_type: "lpp_search_request",
          related_entity_id: searchId,
          context: { institution: "centrale", policy_id: policy.id, client_id: client?.id },
        }).select("id").single();
        results.push({ institution: "centrale", status: "sent", email_log_id: log1?.id });
        await supabase.from("lpp_search_requests").update({
          centrale_status: "sent",
          centrale_sent_at: new Date().toISOString(),
          centrale_email_log_id: log1?.id || null,
        }).eq("id", searchId);
      }
    } catch (e) {
      results.push({ institution: "centrale", status: "failed", error: (e as any)?.message });
    }

    // Email 2 : Fondation Institution Supplétive
    const suppletiveSubject = `Demande de recherche LPP — ${client?.last_name || ""} ${client?.first_name || ""}`.trim();
    const suppletiveHtml = buildSuppletiveEmailHtml(clientPayload);
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${cabinetName} <${senderAddress}>`,
          reply_to: tenantReplyTo || undefined,
          to: [SUPPLETIVE_EMAIL],
          subject: suppletiveSubject,
          html: suppletiveHtml,
          attachments,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        results.push({ institution: "suppletive", status: "failed", error: `Resend ${res.status}: ${txt.slice(0, 200)}` });
      } else {
        const { data: log2 } = await supabase.from("tenant_email_log").insert({
          tenant_id: policy.tenant_id,
          kind: "lpp_search",
          recipient_email: SUPPLETIVE_EMAIL,
          recipient_name: "Fondation Institution Supplétive LPP",
          subject: suppletiveSubject,
          status: "sent",
          sent_at: new Date().toISOString(),
          related_entity_type: "lpp_search_request",
          related_entity_id: searchId,
          context: { institution: "suppletive", policy_id: policy.id, client_id: client?.id },
        }).select("id").single();
        results.push({ institution: "suppletive", status: "sent", email_log_id: log2?.id });
        await supabase.from("lpp_search_requests").update({
          suppletive_status: "sent",
          suppletive_sent_at: new Date().toISOString(),
          suppletive_email_log_id: log2?.id || null,
        }).eq("id", searchId);
      }
    } catch (e) {
      results.push({ institution: "suppletive", status: "failed", error: (e as any)?.message });
    }

    const allSent = results.every(r => r.status === "sent");
    await supabase.from("lpp_search_requests").update({
      overall_status: allSent ? "in_progress" : "failed",
      updated_at: new Date().toISOString(),
    }).eq("id", searchId);

    return new Response(JSON.stringify({
      ok: true,
      search_request_id: searchId,
      attachments_count: attachments.length,
      results,
      all_sent: allSent,
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
