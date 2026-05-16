/**
 * Smartflow Décomptes — edge function scan-commission-statement
 * ============================================================
 * Reçoit un commission_statement_id, lit le PDF stocké, le donne à gpt-5
 * avec un prompt structuré, parse la sortie en lignes, et insère chaque
 * ligne dans commission_statement_lines avec un match client/police auto
 * via la RPC match_commission_line.
 *
 * Le broker valide ensuite chaque ligne une par une depuis CRMCommissions
 * (bannière "X commissions à valider") qui ouvre CommissionForm pré-rempli.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAuth, requireTenantAccess, AuthError } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logger.ts";
import { fetchAiChatCompletions, getAiModel, isAiTimeoutError } from "../_shared/ai.ts";
import { buildChatDocumentContent, normalizeDocumentMimeType } from "../_shared/document-inputs.ts";

const log = createLogger("scan-commission-statement");

interface ScanLine {
  line_number?: number;
  page_number?: number;
  client_first_name?: string | null;
  client_last_name?: string | null;
  client_full_name?: string | null;
  policy_number?: string | null;
  product_name?: string | null;
  period_label?: string | null;
  period_year?: number | null;
  period_month?: number | null;
  gross_amount?: number | null;
  net_amount?: number | null;
  commission_rate?: number | null;
  currency?: string | null;
}

interface ScanOutput {
  company_name?: string | null;
  statement_date?: string | null;   // ISO YYYY-MM-DD
  period_year?: number | null;
  period_month?: number | null;
  currency?: string | null;
  total_amount?: number | null;
  lines?: ScanLine[];
}

const SYSTEM_PROMPT = `Tu es l'IA Smartflow LYTA, spécialisée dans l'extraction de décomptes de commissions d'assurance suisse.

Tu reçois un PDF envoyé par une compagnie (Helsana, AXA, Mobilière, Vaudoise, Swica, CSS, Concordia, Sanitas, Visana, etc.) à un courtier.

OBJECTIF : extraire CHAQUE ligne de commission (1 ligne du PDF = 1 entrée du tableau lines) et structurer.

RETOURNE STRICTEMENT un objet JSON conforme à ce schéma — pas de texte autour, pas de markdown :
{
  "company_name": "<nom de la compagnie qui émet le décompte, tel qu'écrit>",
  "statement_date": "<date imprimée sur le décompte au format YYYY-MM-DD ou null>",
  "period_year": <année de la période couverte, ex 2026>,
  "period_month": <mois de la période, 1-12, ou null si trimestriel ou annuel>,
  "currency": "<CHF | EUR>",
  "total_amount": <total déclaré dans le PDF en numérique, ou null>,
  "lines": [
    {
      "line_number": <ordre dans le PDF, 1-N>,
      "page_number": <numéro de page>,
      "client_first_name": "<prénom>",
      "client_last_name": "<nom de famille>",
      "client_full_name": "<nom complet tel qu'écrit si tu n'arrives pas à séparer>",
      "policy_number": "<numéro de police/contrat tel qu'écrit, ou null>",
      "product_name": "<nom du produit / formule, ou null>",
      "period_label": "<période brute telle qu'écrite, ex '01.05.2026 - 31.05.2026' ou 'Mai 2026'>",
      "period_year": <année, ou null>,
      "period_month": <mois 1-12, ou null>,
      "gross_amount": <montant brut en numérique, ou null>,
      "net_amount": <montant net en numérique, ou null>,
      "commission_rate": <taux en %, ex 12.5 pour 12.5%, ou null>,
      "currency": "CHF"
    }
  ]
}

RÈGLES STRICTES :
1. JAMAIS de texte hors-JSON. Retourne UNIQUEMENT l'objet JSON.
2. Montants en NUMÉRIQUE pas en string. "CHF 42.50" → 42.50. "42'500.-" → 42500.
3. Si tu ne trouves pas une info, mets null. Ne devine PAS.
4. Sépare first_name et last_name dès que possible (Suisse : prénom puis nom le plus souvent).
5. Si le PDF a des sous-totaux, ignore-les. Ne capture que les lignes de COMMISSION RÉELLE.
6. Si le PDF a des lignes négatives (clawback, retenue), garde-les avec montants négatifs.
7. Si le PDF n'est pas un décompte de commissions → retourne { "lines": [], "company_name": null }.`;

interface ReqBody {
  statementId: string;
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Partial<ReqBody>;
    const statementId = body.statementId;
    if (!statementId) {
      return new Response(JSON.stringify({ error: "statementId required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Auth + ownership check
    const { user } = await requireAuth(req);

    // Fetch statement
    const { data: stmt, error: stmtErr } = await supabase
      .from("commission_statements")
      .select("*")
      .eq("id", statementId)
      .maybeSingle();
    if (stmtErr || !stmt) {
      return new Response(JSON.stringify({ error: "Statement introuvable" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    await requireTenantAccess(user.id, stmt.tenant_id);

    // Mark as processing
    await supabase.from("commission_statements").update({
      status: "processing",
    }).eq("id", statementId);

    const startedAt = Date.now();

    // Download the PDF
    const { data: fileBlob, error: dlErr } = await supabase
      .storage.from("documents").download(stmt.original_file_key);
    if (dlErr || !fileBlob) {
      await supabase.from("commission_statements").update({
        status: "failed",
        error_message: dlErr?.message || "Could not download PDF",
      }).eq("id", statementId);
      return new Response(JSON.stringify({ error: "Download error", details: dlErr?.message }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const arrayBuffer = await fileBlob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    // Build the multimodal message
    const fileContent = buildChatDocumentContent({
      fileName: stmt.original_file_name,
      mimeType: normalizeDocumentMimeType(stmt.original_file_name, stmt.mime_type),
      base64,
    });

    const aiModel = getAiModel();
    log.info(`Scanning commission statement ${statementId} with ${aiModel}`);

    let aiJson: any;
    try {
      const aiResponse = await fetchAiChatCompletions({
        model: aiModel,
        max_completion_tokens: 16000,  // décompte peut faire 200+ lignes
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: [
            { type: "text", text: "Extrais toutes les lignes de commission de ce décompte. Réponds en JSON strict, sans markdown." },
            fileContent,
          ] as any },
        ],
        response_format: { type: "json_object" },
      }, 120_000);
      if (!aiResponse.ok) {
        const errBody = await aiResponse.text();
        throw new Error(`AI HTTP ${aiResponse.status}: ${errBody}`);
      }
      aiJson = await aiResponse.json();
    } catch (aiErr) {
      const errMsg = isAiTimeoutError(aiErr) ? "AI timeout" : (aiErr as any)?.message || String(aiErr);
      log.error("AI call failed", { errMsg });
      await supabase.from("commission_statements").update({
        status: "failed",
        error_message: errMsg,
        processing_time_ms: Date.now() - startedAt,
        ai_model_used: aiModel,
      }).eq("id", statementId);
      return new Response(JSON.stringify({ error: "AI error", details: errMsg }), {
        status: 502, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const rawContent = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let parsed: ScanOutput;
    try {
      parsed = typeof rawContent === "string" ? JSON.parse(rawContent) : rawContent;
    } catch (parseErr) {
      log.error("AI returned non-JSON", { rawContent });
      await supabase.from("commission_statements").update({
        status: "failed",
        error_message: "AI returned non-JSON",
        processing_time_ms: Date.now() - startedAt,
        ai_model_used: aiModel,
      }).eq("id", statementId);
      return new Response(JSON.stringify({ error: "Parse error", raw: rawContent }), {
        status: 502, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const lines = Array.isArray(parsed.lines) ? parsed.lines : [];
    log.info(`Extracted ${lines.length} lines from statement ${statementId}`);

    // Update statement metadata
    let companyId: string | null = null;
    if (parsed.company_name) {
      // Try to resolve company from existing catalog (tenant scope + system fallback)
      const { data: companyMatch } = await supabase
        .from("insurance_companies")
        .select("id")
        .or(`tenant_id.eq.${stmt.tenant_id},tenant_id.is.null`)
        .ilike("name", parsed.company_name.trim())
        .limit(1)
        .maybeSingle();
      if (companyMatch?.id) companyId = companyMatch.id;
    }

    await supabase.from("commission_statements").update({
      company_id: companyId,
      detected_company_name: parsed.company_name || null,
      statement_date: parsed.statement_date || null,
      period_year: parsed.period_year ?? stmt.period_year ?? null,
      period_month: parsed.period_month ?? stmt.period_month ?? null,
      currency: parsed.currency || "CHF",
      total_amount_detected: parsed.total_amount ?? null,
      ai_model_used: aiModel,
      processing_time_ms: Date.now() - startedAt,
    }).eq("id", statementId);

    // Insert all lines, then match each one
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];

      // Split full_name if first/last missing
      let firstName = ln.client_first_name || "";
      let lastName  = ln.client_last_name  || "";
      if ((!firstName || !lastName) && ln.client_full_name) {
        const parts = ln.client_full_name.trim().split(/\s+/);
        if (parts.length >= 2) {
          firstName = firstName || parts[0];
          lastName  = lastName  || parts.slice(1).join(" ");
        }
      }

      // Insert raw line first
      const { data: insertedLine, error: insertErr } = await supabase
        .from("commission_statement_lines")
        .insert({
          statement_id: statementId,
          tenant_id: stmt.tenant_id,
          line_number: ln.line_number ?? i + 1,
          page_number: ln.page_number ?? null,
          raw_client_first_name: firstName || null,
          raw_client_last_name: lastName || null,
          raw_client_full_name: ln.client_full_name || null,
          raw_policy_number: ln.policy_number || null,
          raw_product_name: ln.product_name || null,
          raw_period_label: ln.period_label || null,
          gross_amount: ln.gross_amount ?? null,
          net_amount: ln.net_amount ?? null,
          commission_rate: ln.commission_rate ?? null,
          currency: ln.currency || "CHF",
          period_year: ln.period_year ?? parsed.period_year ?? null,
          period_month: ln.period_month ?? parsed.period_month ?? null,
          match_status: "pending",
        })
        .select("id")
        .single();

      if (insertErr || !insertedLine) {
        log.warn(`Failed to insert line ${i}`, { insertErr });
        continue;
      }

      // Match client / policy via RPC
      const { data: matches } = await supabase.rpc("match_commission_line", {
        p_tenant_id: stmt.tenant_id,
        p_first_name: firstName || null,
        p_last_name: lastName || null,
        p_policy_number: ln.policy_number || null,
      });

      if (Array.isArray(matches) && matches.length > 0) {
        const best = matches[0];
        const second = matches[1];
        // Status :
        //  - 'matched' si le top-1 a score > 0.9 ET (pas de second OU large marge)
        //  - 'ambiguous' si plusieurs candidats proches
        let status: string = "matched";
        if (best.match_score < 0.9) status = "ambiguous";
        if (second && (Number(best.match_score) - Number(second.match_score)) < 0.1) {
          status = "ambiguous";
        }
        await supabase
          .from("commission_statement_lines")
          .update({
            matched_client_id: best.client_id,
            matched_policy_id: best.policy_id,
            match_score: best.match_score,
            match_status: status,
            match_candidates: matches.slice(0, 3),
          })
          .eq("id", insertedLine.id);
      } else {
        await supabase
          .from("commission_statement_lines")
          .update({ match_status: "no_match" })
          .eq("id", insertedLine.id);
      }
    }

    // Final status
    await supabase.from("commission_statements").update({
      status: "extracted",
    }).eq("id", statementId);

    return new Response(JSON.stringify({
      ok: true,
      statement_id: statementId,
      lines_count: lines.length,
      company_name: parsed.company_name || null,
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: err.status, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    log.error("Unexpected error in scan-commission-statement", { err: (err as any)?.message });
    return new Response(JSON.stringify({ error: "Internal error", details: (err as any)?.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
