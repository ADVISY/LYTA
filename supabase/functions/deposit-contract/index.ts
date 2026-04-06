import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { createLogger } from "../_shared/logger.ts";
import { resolvePartnerAccessByEmail } from "../_shared/partner-access.ts";

const log = createLogger("deposit-contract");

serve(async (req) => {
  // Handle CORS preflight requests
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    await checkRateLimit(req, "deposit-contract", 10);

    const { 
      partnerEmail, 
      formType, 
      formData, 
      startDate,
      premiumMonthly,
      productType
    } = await req.json()

    if (!partnerEmail || !formType) {
      return new Response(
        JSON.stringify({ error: 'partnerEmail and formType are required' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    const normalizedEmail = partnerEmail.toLowerCase().trim()

    // Create Supabase client with service role key to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const access = await resolvePartnerAccessByEmail(normalizedEmail)

    if (!access.authorized || !access.tenantId) {
      return new Response(
        JSON.stringify({ error: access.message || 'Partner not authorized or no tenant associated' }),
        { status: 403, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }
    const tenantId = access.tenantId
    const partnerId = access.partnerId

    // Resolve product ID dynamically — upsert placeholder company & product if needed
    const categoryMap: Record<string, string> = {
      'sana': 'health',
      'vita': 'life',
      'medio': 'home',
      'business': 'rcpro',
    }
    const productName = (formType || 'sana').charAt(0).toUpperCase() + (formType || 'sana').slice(1)
    const productCategory = categoryMap[formType] || 'health'

    // Ensure placeholder company exists
    const { data: company } = await supabaseAdmin
      .from('insurance_companies')
      .upsert({ name: 'Dépôt générique' }, { onConflict: 'name' })
      .select('id')
      .single()

    if (!company) {
      return new Response(
        JSON.stringify({ error: 'Could not resolve placeholder company' }),
        { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    // Ensure product exists for this form type
    const { data: product } = await supabaseAdmin
      .from('insurance_products')
      .upsert(
        { company_id: company.id, name: productName, category: productCategory, source: 'manual' },
        { onConflict: 'company_id,name' }
      )
      .select('id')
      .single()

    if (!product) {
      return new Response(
        JSON.stringify({ error: 'Could not resolve product for form type: ' + formType }),
        { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    const productId = product.id

    // Insert the policy with proper tenant_id
    const { data: policy, error: insertError } = await supabaseAdmin
      .from('policies')
      .insert({
        client_id: null,
        product_id: productId,
        start_date: startDate || new Date().toISOString().split('T')[0],
        premium_monthly: premiumMonthly || null,
        status: 'pending',
        notes: JSON.stringify({ formType, ...formData, agentEmail: partnerEmail }),
        product_type: productType || formType,
        tenant_id: tenantId,
        partner_id: partnerId,
      })
      .select('id')
      .single()

    if (insertError) {
      log.error('Insert error', { error: insertError })
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    log.info('Policy created successfully', { policyId: policy?.id })

    return new Response(
      JSON.stringify({ 
        success: true, 
        policyId: policy?.id,
        message: 'Contract deposited successfully' 
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    if (error instanceof RateLimitError) {
      return new Response(
        JSON.stringify({ error: "Trop de requetes, reessayez plus tard" }),
        {
          status: 429,
          headers: {
            ...getCorsHeaders(req),
            'Content-Type': 'application/json',
            'Retry-After': String(error.retryAfter),
          },
        }
      );
    }
    log.error('Error', { error: error instanceof Error ? error.message : error })
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  }
})
