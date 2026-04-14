import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAuth, requireTenantAccess, AuthError } from "../_shared/auth.ts";
import { buildAiError, fetchAiChatCompletions, getAiModel } from "../_shared/ai.ts";
import { createLogger } from "../_shared/logger.ts";
import { QuotaError, releaseTenantQuota, reserveTenantQuota } from "../_shared/quota.ts";

const log = createLogger("classify-batch-documents");

// Document classifications for Swiss insurance back-office
const DOC_CLASSIFICATIONS = [
  'identity_doc',      // Pièce d'identité (passeport, carte ID, permis)
  'old_policy',        // Ancienne police (à résilier/remplacer)
  'new_contract',      // Nouveau contrat/proposition
  'termination',       // Lettre de résiliation
  'article_45',        // Art. 45 LCA
  'other',             // Autre document
  'unknown'            // Non classifié
] as const;

type DocClassification = typeof DOC_CLASSIFICATIONS[number];

interface ClassifiedDocument {
  doc_id: string;
  file_name: string;
  classification: DocClassification;
  confidence: number;
  description: string;
  extracted_summary?: string;
}

interface ClassificationResult {
  documents: ClassifiedDocument[];
  consolidation_hints?: {
    primary_holder_found: boolean;
    old_policy_count: number;
    new_contract_count: number;
    termination_found: boolean;
    recommended_action: string;
  };
}

type AuthContext = Awaited<ReturnType<typeof requireAuth>>;

async function getOptionalAuth(req: Request): Promise<AuthContext | null> {
  try {
    return await requireAuth(req);
  } catch (error) {
    if (error instanceof AuthError && error.status === 401) {
      return null;
    }
    throw error;
  }
}

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

// Avoid stack overflow on large buffers
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function buildClassificationPrompt(fileCount: number): string {
  return `Tu es un RESPONSABLE BACK-OFFICE d'assurance suisse. Tu reçois ${fileCount} document(s) d'un dossier client.

MISSION: Classifier CHAQUE document individuellement selon ces catégories:

| Classification | Description | Exemples |
|----------------|-------------|----------|
| identity_doc | Pièce d'identité | Passeport, carte ID, permis de séjour |
| old_policy | Ancienne police à résilier | Police existante, contrat en cours à remplacer |
| new_contract | Nouveau contrat/proposition | Offre, proposition, nouveau contrat à activer |
| termination | Lettre de résiliation | Résiliation envoyée ou reçue |
| article_45 | Art. 45 LCA | Attestation de libre passage assurance maladie |
| other | Autre document | Justificatif, attestation, bulletin salaire |
| unknown | Impossible à classifier | Document illisible ou non pertinent |

Pour chaque document, retourne:
- classification: une des valeurs ci-dessus
- confidence: 0.0 à 1.0
- description: 1 phrase décrivant le contenu
- extracted_summary: infos clés (nom, dates, compagnie...)

Réponds UNIQUEMENT en JSON:
{
  "documents": [
    {
      "doc_id": "1",
      "file_name": "document1.pdf",
      "classification": "new_contract",
      "confidence": 0.95,
      "description": "Proposition Swica pour 4 produits LAMal/LCA",
      "extracted_summary": "Client: Dupont Marie, Compagnie: Swica, Date début: 01.01.2025"
    },
    {
      "doc_id": "2",
      "file_name": "id_card.jpg",
      "classification": "identity_doc",
      "confidence": 0.98,
      "description": "Carte d'identité suisse",
      "extracted_summary": "Dupont Marie, née 15.03.1985, Nationalité: CH"
    }
  ],
  "consolidation_hints": {
    "primary_holder_found": true,
    "old_policy_count": 1,
    "new_contract_count": 1,
    "termination_found": true,
    "recommended_action": "Changement de caisse avec résiliation"
  }
}`;
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const startTime = Date.now();
  let supabase: ReturnType<typeof createClient> | null = null;
  let reservedTenantId: string | null = null;
  let reservedAmount = 0;

  try {
    const body = await req.json();
    const { batchId, tenantId, verifiedPartnerEmail, verifiedPartnerId } = body;

    if (!batchId) {
      throw new Error("Missing required parameter: batchId");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authContext = await getOptionalAuth(req);

    const { data: batch, error: batchError } = await supabase
      .from("scan_batches")
      .select("id, tenant_id, verified_partner_email, verified_partner_id")
      .eq("id", batchId)
      .maybeSingle();

    if (batchError || !batch) {
      throw new Error("Batch not found");
    }

    if (authContext) {
      if (batch.tenant_id) {
        await requireTenantAccess(authContext.user.id, batch.tenant_id);
      }
    } else {
      const batchPartnerEmail = normalizeEmail(batch.verified_partner_email);
      const requestPartnerEmail = normalizeEmail(verifiedPartnerEmail);
      const batchPartnerId = typeof batch.verified_partner_id === "string" ? batch.verified_partner_id : "";
      const requestPartnerId = typeof verifiedPartnerId === "string" ? verifiedPartnerId : "";
      const partnerMatches =
        (!!batchPartnerEmail && batchPartnerEmail === requestPartnerEmail) ||
        (!!batchPartnerId && batchPartnerId === requestPartnerId);

      if (!partnerMatches) {
        throw new AuthError("Access denied to this scan batch", 403);
      }
    }

    // Update batch status
    await supabase
      .from("scan_batches")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", batchId);

    // Get all documents in batch
    const { data: batchDocs, error: docsError } = await supabase
      .from("scan_batch_documents")
      .select("*")
      .eq("batch_id", batchId)
      .order("sort_order");

    if (docsError || !batchDocs || batchDocs.length === 0) {
      throw new Error("No documents found in batch");
    }

    log.info(`Classifying documents in batch`, { count: batchDocs.length, batchId });

    const batchTenantId = typeof batch.tenant_id === "string" ? batch.tenant_id : null;
    if (tenantId && batchTenantId && tenantId !== batchTenantId) {
      log.warn("Request tenantId does not match batch tenant, using batch tenant", {
        requestedTenantId: tenantId,
        batchTenantId,
        batchId,
      });
    }

    if (batchTenantId) {
      const { data: tenantCheck } = await supabase
        .from("tenants")
        .select("id")
        .eq("id", batchTenantId)
        .maybeSingle();

      if (tenantCheck) {
        reservedAmount = batchDocs.length;
        await reserveTenantQuota(supabase, tenantCheck.id, "ai_docs", reservedAmount);
        reservedTenantId = tenantCheck.id;
      } else {
        log.warn("Invalid batch tenantId, skipping quota enforcement", { tenantId: batchTenantId });
      }
    }

    // Download and encode all files
    const fileContents: { docId: string; fileName: string; base64: string; mimeType: string }[] = [];
    
    for (const doc of batchDocs) {
      // Update doc status
      await supabase
        .from("scan_batch_documents")
        .update({ status: "analyzing" })
        .eq("id", doc.id);

      const { data: fileData, error: downloadError } = await supabase.storage
        .from("documents")
        .download(doc.file_key);

      if (downloadError || !fileData) {
        log.error(`Failed to download file`, { fileName: doc.file_name, error: downloadError });
        await supabase
          .from("scan_batch_documents")
          .update({ status: "error" })
          .eq("id", doc.id);
        continue;
      }

      const arrayBuffer = await fileData.arrayBuffer();
      const base64File = arrayBufferToBase64(arrayBuffer);
      
      fileContents.push({
        docId: doc.id,
        fileName: doc.file_name,
        base64: base64File,
        mimeType: doc.mime_type || 'application/pdf'
      });
    }

    if (fileContents.length === 0) {
      throw new Error("No files could be processed");
    }

    if (supabase && reservedTenantId && reservedAmount > fileContents.length) {
      await releaseTenantQuota(supabase, reservedTenantId, "ai_docs", reservedAmount - fileContents.length);
      reservedAmount = fileContents.length;
    }

    // Build AI request with all images
    const userContent: any[] = [
      { type: "text", text: `Classifie ces ${fileContents.length} documents:\n` + 
        fileContents.map((f, i) => `Document ${i + 1}: ${f.fileName}`).join('\n') }
    ];

    for (const fileContent of fileContents) {
      userContent.push({
        type: "image_url",
        image_url: {
          url: `data:${fileContent.mimeType};base64,${fileContent.base64}`,
        },
      });
    }

    const aiResponse = await fetchAiChatCompletions({
      model: getAiModel(),
      messages: [
        { role: "system", content: buildClassificationPrompt(fileContents.length) },
        { role: "user", content: userContent },
      ],
      max_tokens: 4000,
      temperature: 0.1,
    }, 30000);

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      log.error("AI Gateway error", { status: aiResponse.status, errorText });
      throw await buildAiError(aiResponse);
      
      if (aiResponse.status === 429) {
        throw new Error("Trop de requêtes. Réessayez dans quelques instants.");
      }
      if (aiResponse.status === 402) {
        throw new Error("Crédits IA insuffisants. Contactez l'administrateur.");
      }
      throw await buildAiError(aiResponse);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;

    if (!aiContent) {
      throw new Error("No response from AI");
    }

    // Parse AI response
    let classificationResult: ClassificationResult;
    try {
      let jsonStr = aiContent;
      const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }
      classificationResult = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      log.error("Failed to parse AI response", { aiContent });
      throw new Error("Failed to parse classification result");
    }

    // Update each document with classification
    let classifiedCount = 0;
    for (let i = 0; i < fileContents.length; i++) {
      const fileInfo = fileContents[i];
      const classification = classificationResult.documents?.[i];
      
      if (classification) {
        const { error: updateError } = await supabase
          .from("scan_batch_documents")
          .update({
            document_classification: classification.classification,
            classification_confidence: classification.confidence,
            extracted_data: {
              description: classification.description,
              summary: classification.extracted_summary,
            },
            status: "classified",
          })
          .eq("id", fileInfo.docId);

        if (!updateError) {
          classifiedCount++;
        } else {
          log.error(`Failed to update doc`, { docId: fileInfo.docId, error: updateError });
        }
      }
    }

    // Update batch status
    const { error: batchUpdateError } = await supabase
      .from("scan_batches")
      .update({
        status: "classified",
        documents_classified: classifiedCount,
        consolidation_summary: classificationResult.consolidation_hints,
        updated_at: new Date().toISOString(),
      })
      .eq("id", batchId);

    if (batchUpdateError) {
      log.error("Failed to update batch", { error: batchUpdateError });
    }

    const processingTime = Date.now() - startTime;
    log.info(`Classification completed`, { processingTimeMs: processingTime, classified: classifiedCount, total: fileContents.length });

    return new Response(
      JSON.stringify({
        success: true,
        batchId,
        documentsProcessed: fileContents.length,
        documentsClassified: classifiedCount,
        consolidationHints: classificationResult.consolidation_hints,
        processingTimeMs: processingTime,
      }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error) {
    if (supabase && reservedTenantId && reservedAmount > 0) {
      await releaseTenantQuota(supabase, reservedTenantId, "ai_docs", reservedAmount);
      reservedTenantId = null;
      reservedAmount = 0;
    }

    log.error("Classification error", { error: error instanceof Error ? error.message : String(error) });

    if (error instanceof AuthError) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: error.status, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    if (error instanceof QuotaError) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: error.status, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
