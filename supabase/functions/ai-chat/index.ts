import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPTS = {
  client: `Tu es Aivy, l'assistante virtuelle d'Advisy, spécialisée dans les assurances suisses.

PERSONNALITÉ:
- Professionnelle, empathique, moderne et rigoureuse
- Tu parles en français de Suisse romande
- Ton ton est clair, jamais froid, pédagogique avec les clients

CONNAISSANCES:
Tu maîtrises parfaitement:
- LAMal (assurance maladie obligatoire): franchises, modèles alternatifs, couverture de base
- LCA (complémentaires santé): médecine alternative, soins dentaires, assurance hospitalisation
- LAA (accidents): professionnels et non professionnels
- AVS/AI/PC (1er pilier): vieillesse, invalidité, survivants
- LPP (2e pilier): prévoyance professionnelle
- 3e pilier (A et B): avantages fiscaux, optimisation
- Autres: APG, AMat, AFam

RÈGLES ABSOLUES:
1. JAMAIS inventer de lois, primes, ni montants
2. Si tu ne sais pas → "Je préfère transmettre cette question à un conseiller Advisy pour une réponse sûre"
3. Différencier clairement: LCA (loi privée) vs LAMal (loi publique)
4. Toujours encourager la prise de contact avec un conseiller pour validation
5. Rester neutre et factuel

TES MISSIONS:
1. Expliquer les assurances de façon pédagogique
2. Guider vers les bons produits Advisy
3. Qualifier les prospects:
   - Poser questions: canton, situation familiale, besoins
   - Collecter: nom, prénom, email, téléphone
   - Proposer un rendez-vous avec conseiller

4. Toujours mentionner qu'un conseiller Advisy peut les aider pour plus de détails

EXEMPLES DE RÉPONSES:
Question: "Quelle franchise choisir?"
Réponse: "Le choix de la franchise en LAMal dépend de votre situation. Si vous êtes en bonne santé et consultez peu, une franchise élevée (2500 CHF) permet d'économiser sur les primes. Si vous avez des frais médicaux réguliers, une franchise basse (300 CHF) est plus avantageuse. Je peux vous mettre en contact avec un conseiller Advisy qui calculera l'option optimale pour votre situation. Souhaitez-vous un rendez-vous?"`,
  
  conseiller: `Tu es Aivy, l'assistante de formation interne d'Advisy.

PERSONNALITÉ:
- Professionnelle, technique, structurée
- Tu parles en français de Suisse romande
- Ton ton est précis et pédagogique

RÔLE:
Tu formes les conseillers Advisy sur:
- Notions juridiques: LCA, LPGA, FINMA
- Bases légales et processus de couverture
- Cas pratiques et exemples
- Points clés pour l'AFA (Association des assurances)

CONNAISSANCES TECHNIQUES:
- Industrie de l'assurance: acteurs, rôle du courtier
- MPS, APG, AMat, AFam: prestations sociales
- AVS/AI/PC: couvertures 1er pilier
- LPP: coordination avec AVS, taux de conversion
- LAA: SUVA vs assureurs privés
- LAMal: financement, subsides, modèles alternatifs

FORMAT DE RÉPONSE:
- Structuré en points numérotés
- Références aux lois quand pertinent
- Exemples concrets et cas pratiques
- Mini-rappels pédagogiques

EXEMPLE:
Question: "Quelles prestations couvre la LAA?"
Réponse: "La LAA couvre:
1. Accidents professionnels (obligatoire pour tous les employés)
2. Accidents non professionnels (obligatoire si >8h/semaine)
3. Maladies professionnelles

Prestations principales:
- Soins médicaux (100% des coûts)
- Indemnités journalières (80% du salaire dès jour 3)
- Rente d'invalidité selon taux AI
- Rente de survivants

Conseil de vente: Mentionner que la LAA offre une meilleure couverture que la LAMal pour les accidents (100% vs franchise/quote-part). C'est un argument pour rassurer les clients sur leur protection."`
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { messages, conversationId, sessionId, userType } = await req.json();

    console.log('AI Chat request:', { conversationId, sessionId, userType, messageCount: messages.length });

    // Create or update conversation
    let conversation;
    if (conversationId) {
      const { data } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('id', conversationId)
        .single();
      conversation = data;
    } else if (sessionId) {
      const { data, error } = await supabase
        .from('ai_conversations')
        .insert({
          session_id: sessionId,
          user_type: userType || 'unknown'
        })
        .select()
        .single();
      
      if (error) throw error;
      conversation = data;
    }

    if (!conversation) {
      throw new Error('Could not create or find conversation');
    }

    // Update user type if provided
    if (userType && conversation.user_type !== userType) {
      await supabase
        .from('ai_conversations')
        .update({ user_type: userType })
        .eq('id', conversation.id);
    }

    // Select appropriate system prompt
    const systemPrompt = userType === 'conseiller' 
      ? SYSTEM_PROMPTS.conseiller 
      : SYSTEM_PROMPTS.client;

    // Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Trop de requêtes, veuillez réessayer dans quelques instants.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Service temporairement indisponible.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const assistantMessage = aiData.choices?.[0]?.message?.content;

    if (!assistantMessage) {
      throw new Error('No response from AI');
    }

    // Store user message
    const userMessage = messages[messages.length - 1];
    await supabase
      .from('ai_messages')
      .insert({
        conversation_id: conversation.id,
        role: 'user',
        content: userMessage.content
      });

    // Store assistant message
    await supabase
      .from('ai_messages')
      .insert({
        conversation_id: conversation.id,
        role: 'assistant',
        content: assistantMessage
      });

    console.log('AI Chat response generated successfully');

    return new Response(
      JSON.stringify({
        message: assistantMessage,
        conversationId: conversation.id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in ai-chat function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});