import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Document types we can detect with back-office logic
const DOC_TYPES = [
  'police_active',           // Current active policy
  'ancienne_police',         // Old/previous policy (to replace)
  'nouvelle_police',         // New policy proposal
  'offre',                   // Offer/quote
  'avenant',                 // Policy amendment
  'resiliation',             // Cancellation letter
  'attestation',             // Certificate/attestation
  'piece_identite',          // ID document (passport, ID card, permit)
  'justificatif_domicile',   // Proof of address
  'bulletin_salaire',        // Salary slip
  'autre'                    // Other document
] as const;

interface WorkflowAction {
  action_type: string;
  priority: 'high' | 'normal' | 'low';
  description: string;
  deadline?: string;
  details?: Record<string, any>;
}

interface DocumentDetected {
  file_name: string;
  doc_type: string;
  doc_type_confidence: number;
  description: string;
}

interface ParsedResult {
  dossier_summary?: string;
  documents_detected?: DocumentDetected[];
  has_old_policy?: boolean;
  has_new_policy?: boolean;
  has_termination?: boolean;
  has_identity_doc?: boolean;
  engagement_analysis?: {
    old_policy_end_date?: string;
    new_policy_start_date?: string;
    termination_deadline?: string;
    is_termination_on_time?: boolean;
    days_until_deadline?: number;
    warnings?: string[];
  };
  inconsistencies?: string[];
  missing_documents?: string[];
  workflow_actions?: WorkflowAction[];
  quality_score: number;
  fields: Array<{
    category: string;
    name: string;
    value: string;
    confidence: 'high' | 'medium' | 'low';
    confidence_score: number;
    source_document?: string;
    notes?: string;
  }>;
}

function buildSystemPrompt(fileCount: number): string {
  const today = new Date().toLocaleDateString('fr-CH');
  
  return `Tu es un RESPONSABLE BACK-OFFICE SENIOR d'une compagnie d'assurance suisse. Tu analyses des dossiers clients complets pour vérifier la conformité et extraire toutes les données.

Tu reçois un dossier de ${fileCount} document(s). Tu dois:

## 1. CLASSIFIER CHAQUE DOCUMENT
Pour chaque document, identifie son type parmi:
- police_active: Police d'assurance en cours (à garder)
- ancienne_police: Ancienne police (à résilier/remplacer)
- nouvelle_police: Nouvelle police ou proposition (à activer)
- offre: Offre/devis
- avenant: Avenant de modification
- resiliation: Lettre de résiliation (du client ou de l'assureur)
- attestation: Attestation d'affiliation/couverture
- piece_identite: Pièce d'identité (passeport, carte ID, permis de séjour)
- justificatif_domicile: Justificatif de domicile
- bulletin_salaire: Bulletin de salaire
- autre: Autre document

## 2. VÉRIFIER LES DATES D'ENGAGEMENT
Pour chaque police détectée, vérifie:
- Date de début de contrat
- Date de fin/renouvellement
- Durée d'engagement (notamment pour 3e pilier: durée en années)
- Délai de résiliation (généralement 3 mois avant fin)
- Date limite de résiliation
- Si une résiliation est présente: est-elle dans les délais?

## 3. DÉTECTER LES INCOHÉRENCES
- Comparer anciennes et nouvelles polices
- Vérifier les chevauchements de dates
- Signaler les doublons potentiels
- Alerter si résiliation hors délai

## 4. EXTRAIRE TOUTES LES INFORMATIONS CLIENT
Depuis TOUS les documents (polices ET pièces d'identité):
- Identité complète (nom, prénom, date naissance, nationalité)
- Coordonnées (adresse, téléphone, email)
- N° AVS si présent
- État civil
- Profession/Employeur si visible

## 5. EXTRAIRE LES INFORMATIONS CONTRAT
Pour CHAQUE police détectée:
- Compagnie d'assurance
- Numéro de police
- Type de produit (LAMal/LCA/VIE/NON-VIE/LAA/LPP)
- Catégorie détaillée
- Primes (mensuelle et annuelle)
- Franchise
- Garanties/couvertures
- Statut (active, résiliée, en attente)

## 6. CRÉER UN WORKFLOW BACK-OFFICE
Suggérer les actions à effectuer:
- Si résiliation: créer suivi de résiliation avec deadline
- Si nouvelle police: créer suivi d'activation
- Si ancienne + nouvelle: créer suivi de remplacement
- Si documents manquants: lister ce qu'il faut demander

Types de produits d'assurance suisses:
- LAMal: Assurance maladie obligatoire (résiliation au 30.11 pour 01.01)
- LCA: Assurance complémentaire (délais variables)
- VIE: Assurance vie/prévoyance/3e pilier (durée en années, engagement long)
- NON-VIE: RC, ménage, auto, etc. (généralement annuel)
- LAA: Assurance accidents
- LPP: Prévoyance professionnelle

IMPORTANT: Date du jour = ${today}

Réponds UNIQUEMENT en JSON valide avec cette structure:
{
  "dossier_summary": "Résumé du dossier en 1-2 phrases",
  "documents_detected": [
    {
      "file_name": "police.pdf",
      "doc_type": "police_active|ancienne_police|nouvelle_police|resiliation|piece_identite|...",
      "doc_type_confidence": 0.95,
      "description": "Police LAMal CSS active depuis 2023"
    }
  ],
  "has_old_policy": true,
  "has_new_policy": true,
  "has_termination": false,
  "has_identity_doc": true,
  "engagement_analysis": {
    "old_policy_end_date": "2024-12-31",
    "new_policy_start_date": "2025-01-01",
    "termination_deadline": "2024-09-30",
    "is_termination_on_time": true,
    "days_until_deadline": 45,
    "warnings": ["Résiliation doit être envoyée avant le 30.09.2024"]
  },
  "inconsistencies": ["Adresse différente sur pièce identité et police"],
  "missing_documents": ["Copie du permis de travail mentionné"],
  "workflow_actions": [
    {
      "action_type": "create_termination_suivi",
      "priority": "high",
      "description": "Créer suivi de résiliation pour ancienne police CSS",
      "deadline": "2024-09-30",
      "details": {
        "company": "CSS",
        "policy_number": "12345",
        "reason": "Changement de compagnie vers Groupe Mutuel"
      }
    },
    {
      "action_type": "create_activation_suivi",
      "priority": "normal",
      "description": "Activer nouvelle police Groupe Mutuel dès réception confirmation",
      "deadline": "2025-01-01"
    }
  ],
  "quality_score": 0.9,
  "fields": [
    {
      "category": "client|contract|premium|guarantees|identity|old_contract|new_contract",
      "name": "nom",
      "value": "Dupont",
      "confidence": "high",
      "confidence_score": 0.95,
      "source_document": "piece_identite.pdf",
      "notes": "Confirmé sur pièce identité"
    }
  ]
}`;
}

function buildUserPrompt(documentsDescription: string, formType?: string): string {
  return `Analyse ce dossier d'assurance complet${formType ? ` (formulaire ${formType.toUpperCase()})` : ''} et extrait TOUTES les informations.

DOCUMENTS DU DOSSIER:
${documentsDescription}

Champs à extraire et consolider depuis TOUS les documents:

INFORMATIONS CLIENT (priorité aux pièces d'identité):
- nom, prenom, date_naissance, nationalite, etat_civil
- adresse, npa, localite, canton, pays
- telephone, email
- numero_avs, profession, employeur

ANCIENNE POLICE (si présente):
- ancienne_compagnie, ancien_numero_police, ancien_type_produit
- ancienne_date_debut, ancienne_date_fin
- ancienne_prime_mensuelle, ancienne_prime_annuelle
- ancienne_franchise

NOUVELLE POLICE (si présente):
- nouvelle_compagnie, nouveau_numero_police, nouveau_type_produit
- nouvelle_date_debut, nouvelle_date_fin, duree_engagement
- nouvelle_prime_mensuelle, nouvelle_prime_annuelle
- nouvelle_franchise

RÉSILIATION (si présente):
- date_resiliation, motif_resiliation, compagnie_resiliee

IMPORTANT:
- Consolide les informations de TOUS les documents
- Signale les incohérences entre documents
- Vérifie les dates d'engagement et délais de résiliation
- Suggère les actions back-office nécessaires

Retourne UNIQUEMENT le JSON, sans texte additionnel.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const body = await req.json();
    const { scanId, formType, tenantId, batchMode, files, fileKey, fileName, mimeType } = body;

    if (!scanId) {
      throw new Error("Missing required parameter: scanId");
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

    // Determine files to process
    const filesToProcess: { path: string; fileName: string; mimeType: string }[] = batchMode && files 
      ? files 
      : [{ path: fileKey, fileName, mimeType }];

    console.log(`Processing ${filesToProcess.length} files in ${batchMode ? 'batch' : 'single'} mode`);

    // Download and encode all files
    const fileContents: { fileName: string; base64: string; mimeType: string }[] = [];
    
    for (const fileInfo of filesToProcess) {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("documents")
        .download(fileInfo.path);

      if (downloadError || !fileData) {
        console.error(`Failed to download ${fileInfo.fileName}:`, downloadError);
        continue;
      }

      const arrayBuffer = await fileData.arrayBuffer();
      const base64File = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
      fileContents.push({
        fileName: fileInfo.fileName,
        base64: base64File,
        mimeType: fileInfo.mimeType || 'application/pdf'
      });
    }

    if (fileContents.length === 0) {
      throw new Error("No files could be processed");
    }

    // Build prompts
    const systemPrompt = buildSystemPrompt(fileContents.length);
    const documentsDescription = fileContents.map((f, i) => 
      `Document ${i + 1}: ${f.fileName}`
    ).join('\n');
    const userPrompt = buildUserPrompt(documentsDescription, formType);

    // Build messages with all document images
    const userContent: any[] = [
      { type: "text", text: userPrompt }
    ];

    for (const fileContent of fileContents) {
      userContent.push({
        type: "image_url",
        image_url: {
          url: `data:${fileContent.mimeType};base64,${fileContent.base64}`,
        },
      });
    }

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
          { role: "user", content: userContent },
        ],
        max_tokens: 12000,
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
    let parsedResult: ParsedResult;

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

    // Determine main document type from detected documents
    const mainDocType = parsedResult.documents_detected?.[0]?.doc_type || 'autre';

    // Update scan record with results
    const { error: updateError } = await supabase
      .from("document_scans")
      .update({
        status: "completed",
        detected_doc_type: mainDocType,
        doc_type_confidence: parsedResult.documents_detected?.[0]?.doc_type_confidence || 0,
        quality_score: parsedResult.quality_score,
        overall_confidence: overallConfidence,
        ocr_required: true,
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
      extraction_notes: [
        field.source_document ? `Source: ${field.source_document}` : null,
        field.notes
      ].filter(Boolean).join(' | ') || null,
    }));

    if (fieldsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("document_scan_results")
        .insert(fieldsToInsert);

      if (insertError) {
        console.error("Failed to insert results:", insertError);
      }
    }

    // Create audit log with full analysis data
    await supabase.rpc("create_scan_audit_log", {
      p_scan_id: scanId,
      p_action: "extracted",
      p_ai_snapshot: {
        ...parsedResult,
        batch_mode: batchMode,
        files_count: fileContents.length
      },
    });

    // Increment tenant AI docs usage
    if (tenantId) {
      await supabase.rpc("increment_tenant_consumption", {
        p_tenant_id: tenantId,
        p_type: "ai_docs",
        p_amount: fileContents.length,
      });
    }

    // Get scan record to get partner email
    const { data: scanData } = await supabase
      .from("document_scans")
      .select("verified_partner_email, source_form_type")
      .eq("id", scanId)
      .single();

    // Send notification to tenant admins with enhanced info
    if (tenantId) {
      const { data: tenantAdmins } = await supabase
        .from("user_tenant_roles")
        .select("user_id")
        .eq("tenant_id", tenantId)
        .eq("role", "admin");

      const { data: globalAdmins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      const adminUserIds = new Set<string>();
      tenantAdmins?.forEach(a => adminUserIds.add(a.user_id));
      
      if (globalAdmins) {
        for (const admin of globalAdmins) {
          const { data: hasTenantAccess } = await supabase
            .from("user_tenant_roles")
            .select("id")
            .eq("user_id", admin.user_id)
            .eq("tenant_id", tenantId)
            .maybeSingle();
          
          if (hasTenantAccess) {
            adminUserIds.add(admin.user_id);
          }
        }
      }

      const adminUsers = Array.from(adminUserIds).map(user_id => ({ user_id }));

      if (adminUsers.length > 0) {
        const fieldsSummary = parsedResult.fields.map(f => ({
          name: f.name,
          value: f.value,
          confidence: f.confidence,
          category: f.category,
        }));

        const lowConfidenceCount = parsedResult.fields.filter(f => f.confidence === 'low').length;
        const mediumConfidenceCount = parsedResult.fields.filter(f => f.confidence === 'medium').length;
        const hasTermination = parsedResult.has_termination;
        const hasOldPolicy = parsedResult.has_old_policy;
        const hasNewPolicy = parsedResult.has_new_policy;
        const warnings = parsedResult.engagement_analysis?.warnings || [];

        // Build rich notification message
        let notifTitle = `📄 Nouveau dépôt à valider`;
        let notifMessage = `${fileContents.length} doc(s) - ${parsedResult.fields.length} champs extraits`;

        if (hasTermination) {
          notifTitle = `🚨 Dépôt avec RÉSILIATION à traiter`;
          notifMessage = `Résiliation détectée. ${warnings.length > 0 ? warnings[0] : 'Vérifier les délais.'}`;
        } else if (hasOldPolicy && hasNewPolicy) {
          notifTitle = `🔄 Changement de police à valider`;
          notifMessage = `Remplacement détecté: ancienne → nouvelle police. ${parsedResult.fields.length} champs.`;
        }

        const notifications = adminUsers.map(admin => ({
          user_id: admin.user_id,
          tenant_id: tenantId,
          kind: 'new_contract',
          priority: hasTermination || lowConfidenceCount > 2 ? 'high' : 'normal',
          title: notifTitle,
          message: notifMessage,
          payload: {
            scan_id: scanId,
            form_type: formType,
            partner_email: scanData?.verified_partner_email,
            dossier_summary: parsedResult.dossier_summary,
            documents_detected: parsedResult.documents_detected,
            has_old_policy: hasOldPolicy,
            has_new_policy: hasNewPolicy,
            has_termination: hasTermination,
            has_identity_doc: parsedResult.has_identity_doc,
            engagement_analysis: parsedResult.engagement_analysis,
            workflow_actions: parsedResult.workflow_actions,
            inconsistencies: parsedResult.inconsistencies || [],
            missing_documents: parsedResult.missing_documents || [],
            documents_count: fileContents.length,
            fields_count: parsedResult.fields.length,
            low_confidence_count: lowConfidenceCount,
            medium_confidence_count: mediumConfidenceCount,
            quality_score: parsedResult.quality_score,
            fields_preview: fieldsSummary.slice(0, 15),
          },
          action_url: `/crm/propositions?scan=${scanId}`,
          action_label: hasTermination ? 'Traiter la résiliation' : 'Valider le dépôt',
        }));

        const { error: notifError } = await supabase
          .from("notifications")
          .insert(notifications);

        if (notifError) {
          console.error("Failed to create admin notifications:", notifError);
        } else {
          console.log(`Sent notifications to ${adminUsers.length} admin(s) for scan ${scanId}`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        scanId,
        dossierSummary: parsedResult.dossier_summary,
        documentsDetected: parsedResult.documents_detected,
        hasOldPolicy: parsedResult.has_old_policy,
        hasNewPolicy: parsedResult.has_new_policy,
        hasTermination: parsedResult.has_termination,
        hasIdentityDoc: parsedResult.has_identity_doc,
        engagementAnalysis: parsedResult.engagement_analysis,
        workflowActions: parsedResult.workflow_actions,
        inconsistencies: parsedResult.inconsistencies || [],
        missingDocuments: parsedResult.missing_documents || [],
        qualityScore: parsedResult.quality_score,
        overallConfidence,
        documentsProcessed: fileContents.length,
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
