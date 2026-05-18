import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { createLogger } from "../_shared/logger.ts";
import { resolvePartnerAccessByEmail } from "../_shared/partner-access.ts";

const log = createLogger("deposit-contract");

type SelectedProductInput = {
  productId?: unknown;
  id?: unknown;
  name?: unknown;
  category?: unknown;
  premium?: unknown;
  deductible?: unknown;
  durationYears?: unknown;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function uniqueStrings(values: unknown[]): string[] {
  return [...new Set(values.map(asString).filter((value): value is string => Boolean(value)))];
}

function selectedProductId(product: SelectedProductInput): string | null {
  return asString(product.productId) || asString(product.id);
}

async function resolveCatalogProductSelection(
  supabaseAdmin: ReturnType<typeof createClient>,
  companyId: string | null,
  productId: string | null,
  productIds: unknown,
  selectedProducts: unknown,
) {
  const selectedProductInputs = Array.isArray(selectedProducts)
    ? selectedProducts.filter((product): product is SelectedProductInput => product && typeof product === "object")
    : [];

  const requestedProductIds = uniqueStrings([
    productId,
    ...(Array.isArray(productIds) ? productIds : []),
    ...selectedProductInputs.map(selectedProductId),
  ]);

  if (requestedProductIds.length === 0) {
    return null;
  }

  let query = supabaseAdmin
    .from("insurance_products")
    .select(`
      id,
      name,
      category,
      company_id,
      company:insurance_companies!company_id (
        name
      )
    `)
    .in("id", requestedProductIds);

  if (companyId) {
    query = query.eq("company_id", companyId);
  }

  const { data: catalogProducts, error } = await query;

  if (error) {
    throw new Error(`Could not resolve selected products: ${error.message}`);
  }

  if (!catalogProducts || catalogProducts.length !== requestedProductIds.length) {
    throw new Error("Selected company or products are invalid");
  }

  const distinctCompanyIds = new Set(catalogProducts.map((product: any) => product.company_id));
  if (distinctCompanyIds.size !== 1) {
    throw new Error("Selected products must belong to the same company");
  }

  const productInputById = new Map(
    selectedProductInputs
      .map(input => [selectedProductId(input), input] as const)
      .filter(([id]) => Boolean(id)),
  );

  const productsById = new Map(catalogProducts.map((product: any) => [product.id, product]));
  const orderedProducts = requestedProductIds
    .map(id => productsById.get(id))
    .filter(Boolean);

  const companyName = orderedProducts[0]?.company?.name ?? null;
  const productsData = orderedProducts.map((product: any) => {
    const input = productInputById.get(product.id);
    return {
      productId: product.id,
      name: product.name,
      category: product.category || "other",
      premium: input ? asNumber(input.premium) : null,
      deductible: input ? asNumber(input.deductible) : null,
      durationYears: input ? asNumber(input.durationYears) : null,
    };
  });

  return {
    productId: orderedProducts[0].id,
    companyName,
    productsData,
  };
}

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
      productType,
      companyId,
      productId: requestedProductId,
      productIds,
      selectedProducts,
      companyName: requestedCompanyName,
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

    const catalogSelection = await resolveCatalogProductSelection(
      supabaseAdmin,
      asString(companyId),
      asString(requestedProductId),
      productIds,
      selectedProducts,
    )

    // Resolve product ID dynamically — upsert placeholder company & product if needed
    const categoryMap: Record<string, string> = {
      'sana': 'health',
      'vita': 'life',
      'medio': 'home',
      'business': 'rcpro',
      'lpp': 'life',  // LPP est dans la catégorie vie (prévoyance 2e pilier)
    }
    const productName = (formType || 'sana').charAt(0).toUpperCase() + (formType || 'sana').slice(1)
    const productCategory = categoryMap[formType] || 'health'

    // Ensure placeholder company exists
    const { data: company } = catalogSelection?.productId
      ? { data: { id: null } }
      : await supabaseAdmin
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
    const { data: product } = catalogSelection?.productId
      ? { data: { id: catalogSelection.productId } }
      : await supabaseAdmin
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

    const productId = catalogSelection?.productId ?? product.id
    const resolvedCompanyName = catalogSelection?.companyName ?? asString(requestedCompanyName) ?? 'Depot generique'
    const productsData = catalogSelection?.productsData ?? [{
      productId: product.id,
      name: productName,
      category: productCategory,
      premium: asNumber(premiumMonthly),
      deductible: null,
      durationYears: null,
    }]

    // Insert the policy with proper tenant_id
    const { data: policy, error: insertError } = await supabaseAdmin
      .from('policies')
      .insert({
        client_id: null,
        product_id: productId,
        start_date: startDate || new Date().toISOString().split('T')[0],
        premium_monthly: premiumMonthly || null,
        status: 'pending',
        notes: JSON.stringify({
          formType,
          ...formData,
          agentEmail: partnerEmail,
          companyName: resolvedCompanyName,
          products: productsData,
        }),
        company_name: resolvedCompanyName,
        product_type: productType || formType,
        products_data: productsData,
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
