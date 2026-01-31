import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Document types we can detect
const DOC_TYPES = ['police', 'offre', 'avenant', 'resiliation', 'attestation', 'autre'] as const;

// Fields to extract based on form type
const EXTRACTION_FIELDS = {
  client: ['nom', 'prenom', 'date_naissance', 'email', 'telephone', 'adresse', 'npa', 'localite', 'canton', 'nationalite'],
  contract: ['compagnie', 'numero_police', 'type_produit', 'categorie', 'date_debut', 'date_fin', 'duree_contrat'],
  premium: ['prime_mensuelle', 'prime_annuelle', 'franchise'],
  guarantees: ['garanties_principales'],
};

interface ExtractionResult {
  field_category: string;
  field_name: string;
  extracted_value: string | null;
  confidence: 'high' | 'medium' | 'low';
  confidence_score: number;
  extraction_notes?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { scanId, fileKey, fileName, mimeType, formType, tenantId } = await req.json();

    if (!scanId || !fileKey) {
      throw new Error("Missing required parameters: scanId and fileKey");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Update scan status to processing
    await supabase
      .from("document_scans")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", scanId);

    // Download the file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("documents")
      .download(fileKey);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    // Convert to base64 for vision API
    const arrayBuffer = await fileData.arrayBuffer();
    const base64File = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const isImage = mimeType?.startsWith("image/");
    const isPdf = mimeType === "application/pdf";

    // Determine if OCR is needed
    const ocrRequired = isImage || isPdf;

    // Build the prompt for document analysis
    const systemPrompt = `Tu es un expert en analyse de documents d'assurance suisses. Tu dois:
1. Classifier le type de document parmi: ${DOC_TYPES.join(', ')}
2. Extraire les informations clés avec un niveau de confiance (high/medium/low)
3. Retourner les données dans un format JSON structuré

Pour chaque champ extrait, indique:
- La valeur trouvée
- Le niveau de confiance (high si clairement lisible, medium si partiellement visible, low si incertain)
- Une note explicative si nécessaire

Types de produits d'assurance suisses:
- LAMal: Assurance maladie obligatoire
- LCA: Assurance complémentaire
- VIE: Assurance vie/prévoyance/3e pilier
- NON-VIE: RC, ménage, auto, etc.
- LAA: Assurance accidents
- LPP: Prévoyance professionnelle

Réponds UNIQUEMENT en JSON valide avec cette structure:
{
  "document_type": "police|offre|avenant|resiliation|attestation|autre",
  "document_type_confidence": 0.95,
  "quality_score": 0.9,
  "fields": [
    {
      "category": "client|contract|premium|guarantees",
      "name": "nom",
      "value": "Dupont",
      "confidence": "high",
      "confidence_score": 0.95,
      "notes": "Clairement visible en haut du document"
    }
  ]
}`;

    const userPrompt = `Analyse ce document d'assurance${formType ? ` (formulaire ${formType.toUpperCase()})` : ''} et extrait toutes les informations pertinentes.

Fichier: ${fileName}
Type MIME: ${mimeType}

Champs à extraire:
- Client: nom, prénom, date de naissance, email, téléphone, adresse, NPA, localité, canton, nationalité
- Contrat: compagnie d'assurance, numéro de police, type de produit (LAMal/LCA/VIE/NON-VIE/LAA/LPP), date début, date fin
- Primes: prime mensuelle, prime annuelle, franchise
- Garanties: liste des garanties principales

Retourne UNIQUEMENT le JSON, sans texte additionnel.`;

    // Call Lovable AI Gateway with vision
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType || 'application/pdf'};base64,${base64File}`,
                },
              },
            ],
          },
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
      throw new Error(`AI analysis failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;

    if (!aiContent) {
      throw new Error("No response from AI");
    }

    // Parse AI response
    let parsedResult: {
      document_type: string;
      document_type_confidence: number;
      quality_score: number;
      fields: Array<{
        category: string;
        name: string;
        value: string;
        confidence: 'high' | 'medium' | 'low';
        confidence_score: number;
        notes?: string;
      }>;
    };

    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = aiContent;
      const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }
      parsedResult = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response:", aiContent);
      throw new Error("Failed to parse AI analysis result");
    }

    // Calculate overall confidence
    const confidenceScores = parsedResult.fields.map(f => f.confidence_score);
    const overallConfidence = confidenceScores.length > 0
      ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length
      : 0;

    const processingTime = Date.now() - startTime;

    // Update scan record with results
    const { error: updateError } = await supabase
      .from("document_scans")
      .update({
        status: "completed",
        detected_doc_type: parsedResult.document_type,
        doc_type_confidence: parsedResult.document_type_confidence,
        quality_score: parsedResult.quality_score,
        overall_confidence: overallConfidence,
        ocr_required: ocrRequired,
        processing_time_ms: processingTime,
        ai_model_used: "google/gemini-2.5-flash",
        updated_at: new Date().toISOString(),
      })
      .eq("id", scanId);

    if (updateError) {
      console.error("Failed to update scan:", updateError);
    }

    // Insert extracted fields
    const fieldsToInsert = parsedResult.fields.map(field => ({
      scan_id: scanId,
      field_category: field.category,
      field_name: field.name,
      extracted_value: field.value,
      confidence: field.confidence,
      confidence_score: field.confidence_score,
      extraction_notes: field.notes || null,
    }));

    if (fieldsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("document_scan_results")
        .insert(fieldsToInsert);

      if (insertError) {
        console.error("Failed to insert results:", insertError);
      }
    }

    // Create audit log
    await supabase.rpc("create_scan_audit_log", {
      p_scan_id: scanId,
      p_action: "extracted",
      p_ai_snapshot: parsedResult,
    });

    // Increment tenant AI docs usage
    if (tenantId) {
      await supabase.rpc("increment_tenant_consumption", {
        p_tenant_id: tenantId,
        p_type: "ai_docs",
        p_amount: 1,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        scanId,
        documentType: parsedResult.document_type,
        documentTypeConfidence: parsedResult.document_type_confidence,
        qualityScore: parsedResult.quality_score,
        overallConfidence,
        fieldsExtracted: fieldsToInsert.length,
        processingTimeMs: processingTime,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Scan document error:", error);

    // Try to update scan status to failed
    try {
      const { scanId } = await req.clone().json();
      if (scanId) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        await supabase
          .from("document_scans")
          .update({
            status: "failed",
            error_message: error instanceof Error ? error.message : "Unknown error",
            updated_at: new Date().toISOString(),
          })
          .eq("id", scanId);
      }
    } catch (e) {
      console.error("Failed to update scan status:", e);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
