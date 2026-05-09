/**
 * dispatch-mandat-to-companies
 *
 * Triggered manually by the broker after a Mandat de gestion is signed.
 * Reads the list of insurance companies the client authorised on the mandat
 * (free-text strings stored in signature_requests.payload.insurances), looks
 * up each tenant's "service courtier" email contact for that company, and
 * forwards the signed PDF + a takeover letter to each.
 *
 * Input  (POST JSON):
 *   { signature_request_id: string }
 *
 * Output:
 *   {
 *     ok: true,
 *     dispatched: number,        // emails actually sent
 *     manual_required: number,   // companies with no email on file
 *     details: Array<{
 *       company_name: string,
 *       company_id: string | null,
 *       status: "sent" | "failed" | "manual_required",
 *       recipient_email: string | null,
 *       error: string | null,
 *     }>
 *   }
 *
 * Behaviour:
 *   - 100% manual trigger — does NOT auto-fire on signature completion. The
 *     broker reviews + clicks "Envoyer aux compagnies" on the signed mandat.
 *   - Skips empty insurance slots ("Non", "" …)
 *   - Picks the best email by priority:
 *       1. SUPPORT_COURTIER + EMAIL + is_primary
 *       2. SUPPORT_COURTIER + EMAIL
 *       3. BACK_OFFICE     + EMAIL + is_primary
 *       4. GENERAL         + EMAIL + is_primary
 *       5. any             + EMAIL
 *     If still nothing → manual_required (broker handles it manually).
 *   - Idempotent: if a row already exists in mandat_dispatch_log for this
 *     (signature_request_id, company_name) and is `sent`, we skip and
 *     return its record. Status `failed` / `manual_required` rows are
 *     re-attempted.
 */

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// -- Types ----------------------------------------------------------------

interface MandatInsurances {
  rcMenage?: string;
  auto?: string;
  protectionJuridique?: string;
  sante?: string;
  vie3ePilier?: string;
  autre?: string;
}

interface SignatureRequest {
  id: string;
  tenant_id: string;
  client_id: string | null;
  document_kind: string;
  signed_file_key: string | null;
  status: string;
  payload: {
    insurances?: MandatInsurances;
    clientName?: string;
    clientFirstName?: string;
    clientLastName?: string;
    clientAddress?: string;
    clientPostalCode?: string;
    clientCity?: string;
    clientBirthDate?: string;
    clientEmail?: string;
    cabinetName?: string;
    brokerName?: string;
    brokerEmail?: string;
    lieu?: string;
  } | null;
}

interface CompanyContact {
  id: string;
  contact_type: string;
  channel: string;
  value: string;
  is_primary: boolean;
}

interface DispatchDetail {
  company_name: string;
  company_id: string | null;
  status: "sent" | "failed" | "manual_required";
  recipient_email: string | null;
  error: string | null;
  log_id: string;
}

// -- Constants ------------------------------------------------------------

const FROM_EMAIL = Deno.env.get("DISPATCH_FROM_EMAIL") ?? "noreply@lyta.ch";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// "Non", "Aucun", empty etc. → don't try to dispatch
const EMPTY_VALUES = new Set(["", "non", "aucun", "n/a", "—", "-", "n.a."]);

function isMeaningfulCompanyName(s: string | undefined | null): boolean {
  if (!s) return false;
  return !EMPTY_VALUES.has(s.trim().toLowerCase());
}

// -- Email rendering -----------------------------------------------------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderEmailHtml(opts: {
  cabinetName: string;
  clientFullName: string;
  clientBirthDate?: string;
  clientAddress?: string;
  brokerSignerName?: string;
  insuranceCompanyName: string;
}): string {
  const safeClient = escapeHtml(opts.clientFullName);
  const safeCabinet = escapeHtml(opts.cabinetName);
  const safeBroker = escapeHtml(opts.brokerSignerName ?? opts.cabinetName);
  const safeCompany = escapeHtml(opts.insuranceCompanyName);
  const safeAddress = opts.clientAddress
    ? escapeHtml(opts.clientAddress)
    : "";
  const safeDob = opts.clientBirthDate
    ? escapeHtml(opts.clientBirthDate)
    : "";

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>Mandat de gestion</title></head>
<body style="margin:0;padding:24px;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;line-height:1.55;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
    <div style="padding:24px 28px;border-bottom:1px solid #e5e7eb;background:linear-gradient(135deg,#1e3a8a 0%,#3730a3 100%);color:#fff;">
      <div style="font-size:13px;letter-spacing:0.1em;text-transform:uppercase;opacity:0.85;">Mandat de gestion</div>
      <div style="font-size:20px;font-weight:600;margin-top:4px;">À l'attention du Service Courtage — ${safeCompany}</div>
    </div>

    <div style="padding:28px;">
      <p>Madame, Monsieur,</p>

      <p>Veuillez trouver ci-joint le mandat de gestion signé par notre client
        <strong>${safeClient}</strong>${
    safeDob ? `, né(e) le ${safeDob}` : ""
  }${
    safeAddress ? `, domicilié(e) ${safeAddress}` : ""
  }, par lequel notre cabinet <strong>${safeCabinet}</strong> est
        autorisé à gérer ses contrats d'assurance auprès de votre compagnie.</p>

      <p>Nous vous prions de bien vouloir :</p>
      <ol style="padding-left:20px;margin:12px 0;">
        <li style="margin-bottom:8px;">
          <strong>Nous reconnaître comme courtier officiel</strong> sur les
          contrats existants et futurs de ce client.
        </li>
        <li style="margin-bottom:8px;">
          <strong>Nous transmettre l'ensemble des polices actuellement en
          cours</strong> pour ce client (numéro de police, type de couverture,
          prime, échéance, conditions particulières).
        </li>
        <li style="margin-bottom:8px;">
          Nous adresser à l'avenir toute correspondance, échéance ou
          notification de sinistre concernant ce client.
        </li>
      </ol>

      <p>Restant à votre disposition pour tout complément d'information,
         nous vous adressons, Madame, Monsieur, nos salutations distinguées.</p>

      <p style="margin-top:24px;">
        <strong>${safeBroker}</strong><br>
        ${safeCabinet}
      </p>
    </div>

    <div style="padding:16px 28px;border-top:1px solid #e5e7eb;background:#f9fafb;font-size:12px;color:#6b7280;text-align:center;">
      Document généré automatiquement via LYTA — gestion de mandats. Le PDF
      signé est joint à cet email.
    </div>
  </div>
</body>
</html>`;
}

// -- Helpers --------------------------------------------------------------

/** Best-effort match a free-text mandat company name to an insurance_companies row. */
function pickBestCompanyMatch(
  rawName: string,
  candidates: Array<{ id: string; name: string }>,
): { id: string; name: string } | null {
  const target = rawName.trim().toLowerCase();
  if (!target) return null;

  // 1. Exact case-insensitive match
  let hit = candidates.find((c) => c.name.trim().toLowerCase() === target);
  if (hit) return hit;

  // 2. One contains the other (handles "Allianz" vs "Allianz Suisse")
  hit = candidates.find((c) => {
    const n = c.name.trim().toLowerCase();
    return n.includes(target) || target.includes(n);
  });
  if (hit) return hit;

  return null;
}

/** Pick the best email contact, ranked by usefulness for broker takeover. */
function pickBestEmail(contacts: CompanyContact[]): CompanyContact | null {
  const emails = contacts.filter(
    (c) => c.channel === "EMAIL" && c.value && c.value.trim() !== "",
  );
  if (emails.length === 0) return null;

  const rankFor = (c: CompanyContact): number => {
    let r = 0;
    if (c.contact_type === "SUPPORT_COURTIER") r += 100;
    else if (c.contact_type === "BACK_OFFICE") r += 60;
    else if (c.contact_type === "GENERAL") r += 30;
    else r += 10;
    if (c.is_primary) r += 5;
    return r;
  };

  return [...emails].sort((a, b) => rankFor(b) - rankFor(a))[0];
}

/** Encode a Uint8Array to base64 (Resend wants base64, not raw binary). */
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Send via Resend with attachment support. Throws on hard failure. */
async function sendResendWithAttachment(opts: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  attachment: { filename: string; contentBase64: string };
}): Promise<{ id?: string }> {
  const body = {
    from: FROM_EMAIL,
    to: [opts.to],
    subject: opts.subject,
    html: opts.html,
    reply_to: opts.replyTo,
    attachments: [
      {
        filename: opts.attachment.filename,
        content: opts.attachment.contentBase64,
        content_type: "application/pdf",
      },
    ],
  };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${text || res.statusText}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

// -- Main handler ---------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // User-context client → identifies the caller via the JWT (used for
    // "triggered_by" attribution on the dispatch log).
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userResp, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userResp?.user) {
      return new Response(JSON.stringify({ error: "Invalid user" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    const triggeredBy = userResp.user.id;

    // Service client → bypasses RLS to write log rows + read signed PDF
    // from storage. We re-validate the tenant_id ourselves.
    const admin = createClient(supabaseUrl, serviceKey);

    const { signature_request_id } = await req.json().catch(() => ({}));
    if (!signature_request_id) {
      return new Response(
        JSON.stringify({ error: "signature_request_id required" }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    // Load the mandat. The user-scoped client + RLS guarantees the user
    // can only read their tenant's signature_requests.
    const { data: sr, error: srErr } = await userClient
      .from("signature_requests")
      .select(
        "id, tenant_id, client_id, document_kind, signed_file_key, status, payload",
      )
      .eq("id", signature_request_id)
      .single();

    if (srErr || !sr) {
      return new Response(
        JSON.stringify({ error: "Mandat introuvable ou non accessible" }),
        {
          status: 404,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    const mandat = sr as SignatureRequest;

    if (mandat.document_kind !== "mandat_gestion") {
      return new Response(
        JSON.stringify({
          error: `Ce document n'est pas un mandat de gestion (kind=${mandat.document_kind})`,
        }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    if (mandat.status !== "signed") {
      return new Response(
        JSON.stringify({
          error: `Le mandat doit être signé avant dispatch (statut actuel: ${mandat.status})`,
        }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    if (!mandat.signed_file_key) {
      return new Response(
        JSON.stringify({ error: "PDF signé introuvable sur le mandat" }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    // -- Extract list of insurance company names from payload ----------
    const insurances = mandat.payload?.insurances ?? {};
    const requestedNames: string[] = [
      insurances.rcMenage,
      insurances.auto,
      insurances.protectionJuridique,
      insurances.sante,
      insurances.vie3ePilier,
      insurances.autre,
    ]
      .filter((s): s is string => isMeaningfulCompanyName(s))
      .map((s) => s.trim());

    // Dedupe (a broker may have selected "Allianz" both for RC and home).
    const uniqueNames = Array.from(new Set(requestedNames));

    if (uniqueNames.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          dispatched: 0,
          manual_required: 0,
          details: [],
          message: "Aucune compagnie listée dans ce mandat",
        }),
        {
          status: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    // -- Bulk-load insurance_companies for matching --------------------
    const { data: companies } = await admin
      .from("insurance_companies")
      .select("id, name");
    const companyList = (companies ?? []) as Array<{ id: string; name: string }>;

    // -- Bulk-load this tenant's company_contacts (EMAIL channel) ------
    const { data: contactRows } = await admin
      .from("company_contacts")
      .select("id, company_id, contact_type, channel, value, is_primary")
      .eq("tenant_id", mandat.tenant_id)
      .eq("channel", "EMAIL");
    const contactsByCompany = new Map<string, CompanyContact[]>();
    for (const c of (contactRows ?? []) as Array<
      CompanyContact & { company_id: string }
    >) {
      const arr = contactsByCompany.get(c.company_id) ?? [];
      arr.push(c);
      contactsByCompany.set(c.company_id, arr);
    }

    // -- Fetch the signed PDF once, reuse for every email -------------
    const { data: pdfBlob, error: pdfErr } = await admin.storage
      .from("documents")
      .download(mandat.signed_file_key);
    if (pdfErr || !pdfBlob) {
      return new Response(
        JSON.stringify({
          error: `Impossible de récupérer le PDF signé: ${pdfErr?.message ?? "inconnu"}`,
        }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }
    const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());
    const pdfBase64 = uint8ToBase64(pdfBytes);
    const pdfFilename = `mandat_${mandat.id}.pdf`;

    // -- Resolve client/cabinet display fields -------------------------
    const payload = mandat.payload ?? {};
    const clientFullName =
      payload.clientName ??
      [payload.clientFirstName, payload.clientLastName]
        .filter(Boolean)
        .join(" ")
        .trim() ??
      "Client";
    const cabinetName = payload.cabinetName ?? "Cabinet";
    const brokerSignerName = payload.brokerName ?? cabinetName;
    const replyTo = payload.brokerEmail ?? undefined;
    const clientAddressLine = [
      payload.clientAddress,
      [payload.clientPostalCode, payload.clientCity].filter(Boolean).join(" "),
    ]
      .filter(Boolean)
      .join(", ");

    // -- Process each company -----------------------------------------
    const details: DispatchDetail[] = [];
    let dispatched = 0;
    let manualRequired = 0;

    for (const rawName of uniqueNames) {
      const matched = pickBestCompanyMatch(rawName, companyList);
      const company_id = matched?.id ?? null;
      const company_name = rawName;

      // Idempotency: if we already have a successful row for this
      // (signature_request, company_name) — skip and surface it.
      const { data: existingLog } = await admin
        .from("mandat_dispatch_log")
        .select("id, status, recipient_email")
        .eq("signature_request_id", mandat.id)
        .eq("insurance_company_name", company_name)
        .eq("status", "sent")
        .limit(1);

      if (existingLog && existingLog.length > 0) {
        details.push({
          company_name,
          company_id,
          status: "sent",
          recipient_email: existingLog[0].recipient_email,
          error: null,
          log_id: existingLog[0].id,
        });
        continue;
      }

      const candidateContacts = company_id
        ? contactsByCompany.get(company_id) ?? []
        : [];
      const bestContact = pickBestEmail(candidateContacts);

      // No email known → log manual_required and move on.
      if (!bestContact) {
        const { data: logRow, error: logErr } = await admin
          .from("mandat_dispatch_log")
          .insert({
            tenant_id: mandat.tenant_id,
            signature_request_id: mandat.id,
            client_id: mandat.client_id,
            insurance_company_id: company_id,
            insurance_company_name: company_name,
            recipient_email: null,
            status: "manual_required",
            error_message: company_id
              ? "Aucun email courtier configuré pour cette compagnie"
              : "Compagnie non reconnue dans le catalogue",
            triggered_by: triggeredBy,
            attempts: 0,
          })
          .select("id")
          .single();

        manualRequired += 1;
        details.push({
          company_name,
          company_id,
          status: "manual_required",
          recipient_email: null,
          error: logErr?.message ?? null,
          log_id: logRow?.id ?? "",
        });
        continue;
      }

      // -- Send email --------------------------------------------------
      const html = renderEmailHtml({
        cabinetName,
        clientFullName,
        clientBirthDate: payload.clientBirthDate,
        clientAddress: clientAddressLine || undefined,
        brokerSignerName,
        insuranceCompanyName: company_name,
      });
      const subject = `Mandat de gestion — ${clientFullName} — ${cabinetName}`;

      let resendId: string | undefined;
      let sendError: string | null = null;
      try {
        const r = await sendResendWithAttachment({
          to: bestContact.value,
          subject,
          html,
          replyTo,
          attachment: { filename: pdfFilename, contentBase64: pdfBase64 },
        });
        resendId = r.id;
      } catch (e) {
        sendError = e instanceof Error ? e.message : String(e);
      }

      const success = !sendError;
      const { data: logRow } = await admin
        .from("mandat_dispatch_log")
        .insert({
          tenant_id: mandat.tenant_id,
          signature_request_id: mandat.id,
          client_id: mandat.client_id,
          insurance_company_id: company_id,
          insurance_company_name: company_name,
          company_contact_id: bestContact.id,
          recipient_email: bestContact.value,
          status: success ? "sent" : "failed",
          error_message: sendError,
          resend_message_id: resendId ?? null,
          attempts: 1,
          triggered_by: triggeredBy,
          sent_at: success ? new Date().toISOString() : null,
        })
        .select("id")
        .single();

      if (success) dispatched += 1;
      details.push({
        company_name,
        company_id,
        status: success ? "sent" : "failed",
        recipient_email: bestContact.value,
        error: sendError,
        log_id: logRow?.id ?? "",
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        dispatched,
        manual_required: manualRequired,
        failed: details.filter((d) => d.status === "failed").length,
        details,
      }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : String(e),
      }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    );
  }
});
