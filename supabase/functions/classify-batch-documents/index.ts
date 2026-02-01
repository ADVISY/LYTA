import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const body = await req.json();
    const { batchId, tenantId } = body;

    if (!batchId) {
      throw new Error("Missing required parameter: batchId");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    console.log(`Classifying ${batchDocs.length} documents in batch ${batchId}`);

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
        console.error(`Failed to download ${doc.file_name}:`, downloadError);
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

    // Call Lovable AI Gateway
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: buildClassificationPrompt(fileContents.length) },
          { role: "user", content: userContent },
        ],
        max_tokens: 4000,
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        throw new Error("Trop de requêtes. Réessayez dans quelques instants.");
      }
      if (aiResponse.status === 402) {
        throw new Error("Crédits IA insuffisants. Contactez l'administrateur.");
      }
      throw new Error(`AI classification failed: ${aiResponse.status}`);
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
      console.error("Failed to parse AI response:", aiContent);
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
          console.error(`Failed to update doc ${fileInfo.docId}:`, updateError);
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
      console.error("Failed to update batch:", batchUpdateError);
    }

    // Increment tenant consumption
    if (tenantId) {
      await supabase.rpc("increment_tenant_consumption", {
        p_tenant_id: tenantId,
        p_type: "ai_docs",
        p_amount: fileContents.length,
      });
    }

    const processingTime = Date.now() - startTime;
    console.log(`Classification completed in ${processingTime}ms: ${classifiedCount}/${fileContents.length} docs`);

    return new Response(
      JSON.stringify({
        success: true,
        batchId,
        documentsProcessed: fileContents.length,
        documentsClassified: classifiedCount,
        consolidationHints: classificationResult.consolidation_hints,
        processingTimeMs: processingTime,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Classification error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
