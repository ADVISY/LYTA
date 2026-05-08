// Public endpoint called by /signer/:token page when a client submits their signature.
// No JWT required - the token in the request body is the auth credential.
// Validates the token, stores the signed PDF, creates a documents row, and updates
// signature_requests to status='signed'. Also notifies the broker.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("complete-signature");

interface CompleteRequest {
  token: string;
  // base64-encoded PDF (without data: prefix)
  signedPdfBase64: string;
  // base64 PNG of the client signature (with or without data: prefix)
  clientSignatureImage: string;
  // Full name typed by the client at signing time (used as a confirmation, stored as evidence)
  clientFullName: string;
  // Optional: refusal mode
  refused?: boolean;
  refusalReason?: string;
}

const MAX_PDF_SIZE = 8 * 1024 * 1024; // 8 MB
const MAX_SIGNATURE_SIZE = 1 * 1024 * 1024; // 1 MB

const stripDataPrefix = (s: string): string => s.replace(/^data:[^;]+;base64,/, "");

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = stripDataPrefix(b64);
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const documentKindToDocKind = (kind: string): string => {
  switch (kind) {
    case "mandat_gestion": return "mandat_gestion";
    case "procuration": return "procuration";
    case "resiliation_lca_45": return "resiliation";
    default: return "autre";
  }
};

const fileNameForKind = (kind: string, clientLabel: string): string => {
  const safe = clientLabel.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 50);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
  switch (kind) {
    case "mandat_gestion": return `Mandat_Gestion_${safe}_${stamp}.pdf`;
    case "procuration": return `Procuration_${safe}_${stamp}.pdf`;
    case "resiliation_lca_45": return `Resiliation_LCA_${safe}_${stamp}.pdf`;
    default: return `Document_${safe}_${stamp}.pdf`;
  }
};

serve(async (req: Request): Promise<Response> => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body: CompleteRequest = await req.json();
    const { token, signedPdfBase64, clientSignatureImage, clientFullName, refused, refusalReason } = body;

    if (!token || typeof token !== "string") {
      throw new Error("token is required");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: sr, error: srErr } = await supabaseAdmin
      .from("signature_requests")
      .select("id, tenant_id, client_id, document_kind, status, expires_at, created_by")
      .eq("access_token", token)
      .maybeSingle();

    if (srErr || !sr) {
      return new Response(
        JSON.stringify({ error: "Lien invalide ou révoqué" }),
        { status: 404, headers: { "Content-Type": "application/json", ...getCorsHeaders(req) } },
      );
    }

    if (sr.status === "signed") {
      return new Response(
        JSON.stringify({ error: "Ce document a déjà été signé" }),
        { status: 409, headers: { "Content-Type": "application/json", ...getCorsHeaders(req) } },
      );
    }
    if (sr.status === "cancelled") {
      return new Response(
        JSON.stringify({ error: "Cette demande de signature a été annulée" }),
        { status: 410, headers: { "Content-Type": "application/json", ...getCorsHeaders(req) } },
      );
    }
    if (new Date(sr.expires_at as string).getTime() < Date.now()) {
      await supabaseAdmin.from("signature_requests")
        .update({ status: "expired" })
        .eq("id", sr.id);
      return new Response(
        JSON.stringify({ error: "Ce lien de signature a expiré" }),
        { status: 410, headers: { "Content-Type": "application/json", ...getCorsHeaders(req) } },
      );
    }

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "";
    const userAgent = req.headers.get("user-agent") || "";

    // Refusal flow: just mark as refused
    if (refused) {
      await supabaseAdmin.from("signature_requests").update({
        status: "refused",
        refused_at: new Date().toISOString(),
        refusal_reason: (refusalReason || "").slice(0, 500),
        client_ip: ip,
        client_user_agent: userAgent,
      }).eq("id", sr.id);

      return new Response(
        JSON.stringify({ success: true, refused: true }),
        { status: 200, headers: { "Content-Type": "application/json", ...getCorsHeaders(req) } },
      );
    }

    // Sign flow: validate inputs
    if (!signedPdfBase64 || !clientSignatureImage || !clientFullName) {
      throw new Error("signedPdfBase64, clientSignatureImage and clientFullName are required");
    }
    if (clientFullName.trim().length < 3) {
      throw new Error("Nom complet trop court");
    }

    const pdfBytes = base64ToBytes(signedPdfBase64);
    if (pdfBytes.length > MAX_PDF_SIZE) {
      throw new Error("PDF trop volumineux");
    }

    const sigImg = stripDataPrefix(clientSignatureImage);
    if (sigImg.length > MAX_SIGNATURE_SIZE) {
      throw new Error("Signature image trop volumineuse");
    }

    // Compute integrity hash on the final PDF
    const pdfHash = await sha256Hex(pdfBytes);

    // Load client info (label for filename + tenant_id confirmation)
    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("id, first_name, last_name, company_name, tenant_id")
      .eq("id", sr.client_id as string)
      .single();
    if (!client) throw new Error("Client introuvable");

    const clientLabel = (client.company_name as string) ||
      `${(client.first_name as string) || ""}_${(client.last_name as string) || ""}`.trim() ||
      "Client";

    const fileName = fileNameForKind(sr.document_kind as string, clientLabel);
    // Storage key under the broker's user folder so existing tenant-isolation policies hold
    const fileKey = `${sr.created_by}/signatures/${sr.client_id}/${fileName}`;

    const { error: upErr } = await supabaseAdmin.storage
      .from("documents")
      .upload(fileKey, pdfBytes, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (upErr) {
      log.error("Upload failed", { upErr });
      throw new Error(`Erreur lors de l'enregistrement du PDF: ${upErr.message}`);
    }

    // Insert documents row
    const { data: docRow, error: docErr } = await supabaseAdmin
      .from("documents")
      .insert({
        tenant_id: sr.tenant_id,
        owner_id: sr.client_id,
        owner_type: "client",
        file_name: fileName,
        file_key: fileKey,
        mime_type: "application/pdf",
        size_bytes: pdfBytes.length,
        doc_kind: documentKindToDocKind(sr.document_kind as string),
        created_by: sr.created_by,
      })
      .select("id")
      .single();

    if (docErr) {
      log.error("Documents insert failed", { docErr });
      throw new Error("Impossible d'enregistrer le document signé");
    }

    // Update signature request
    const { error: updErr } = await supabaseAdmin.from("signature_requests").update({
      status: "signed",
      signed_at: new Date().toISOString(),
      signed_file_key: fileKey,
      signed_document_id: docRow.id,
      client_signature_image: sigImg,
      client_full_name: clientFullName.trim().slice(0, 200),
      client_ip: ip,
      client_user_agent: userAgent,
      document_hash: pdfHash,
    }).eq("id", sr.id);

    if (updErr) {
      log.error("Signature request update failed", { updErr });
      throw new Error("Erreur lors de la finalisation de la signature");
    }

    // Notify the broker via in-app notification (best effort)
    try {
      await supabaseAdmin.from("notifications").insert({
        user_id: sr.created_by,
        kind: "signature_completed",
        title: "Document signé",
        message: `${clientFullName} a signé le document.`,
        payload: {
          signature_request_id: sr.id,
          document_id: docRow.id,
          client_id: sr.client_id,
          document_kind: sr.document_kind,
          tenant_id: sr.tenant_id,
        },
      });
    } catch (e) {
      log.error("Broker notification failed", { e: String(e) });
    }

    log.info("Signature completed", { signatureRequestId: sr.id, documentId: docRow.id });

    return new Response(
      JSON.stringify({
        success: true,
        documentId: docRow.id,
        documentHash: pdfHash,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...getCorsHeaders(req) } },
    );
  } catch (error: unknown) {
    log.error("complete-signature error", { error: error instanceof Error ? error.message : String(error) });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...getCorsHeaders(req) } },
    );
  }
});
