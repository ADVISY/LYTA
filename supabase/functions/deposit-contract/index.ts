import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
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
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const normalizedEmail = partnerEmail.toLowerCase().trim()

    // Create Supabase client with service role key to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify that the partner email is valid (collaborateur or admin)
    let partnerId: string | null = null
    let tenantId: string | null = null

    // Check if email exists as collaborateur in clients table
    const { data: collaborateur, error: collabError } = await supabaseAdmin
      .from('clients')
      .select('id, tenant_id')
      .eq('email', normalizedEmail)
      .eq('type_adresse', 'collaborateur')
      .maybeSingle()

    if (collabError) {
      console.error('Database error (collaborateur):', collabError)
    }

    if (collaborateur) {
      // Check if this collaborateur has an associated partner record
      const { data: partnerRecord } = await supabaseAdmin
        .from('partners')
        .select('id')
        .eq('user_id', collaborateur.id)
        .maybeSingle()
      
      partnerId = partnerRecord?.id || null
      tenantId = collaborateur.tenant_id
    } else {
      // Check if user is an admin/agent via profiles + user_tenant_assignments
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', normalizedEmail)
        .maybeSingle()

      if (profileError) {
        console.error('Database error (profile):', profileError)
      }

      if (profile) {
        // Get tenant via user_tenant_assignments
        const { data: assignment, error: assignmentError } = await supabaseAdmin
          .from('user_tenant_assignments')
          .select('tenant_id')
          .eq('user_id', profile.id)
          .maybeSingle()

        if (assignmentError) {
          console.error('Database error (assignment):', assignmentError)
        }

        if (assignment?.tenant_id) {
          tenantId = assignment.tenant_id

          // Check if this user has admin/partner role
          const { data: rolesRows, error: rolesError } = await supabaseAdmin
            .from('user_roles')
            .select('role')
            .eq('user_id', profile.id)
            .in('role', ['admin', 'manager', 'agent', 'partner'])

          if (rolesError) {
            console.error('Database error (roles):', rolesError)
          }

          // Check if this user has a partner record
          const { data: partnerRecord, error: partnerError } = await supabaseAdmin
            .from('partners')
            .select('id')
            .eq('user_id', profile.id)
            .maybeSingle()

          if (partnerError) {
            console.error('Database error (partner):', partnerError)
          }

          partnerId = partnerRecord?.id || null
        }
      }
    }

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'Partner not authorized or no tenant associated' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Map form type to product ID
    const productIdMap: Record<string, string> = {
      'sana': '00000000-0000-0000-0000-000000000001',
      'vita': '00000000-0000-0000-0000-000000000002',
      'medio': '00000000-0000-0000-0000-000000000003',
      'business': '00000000-0000-0000-0000-000000000004',
    }

    const productId = productIdMap[formType] || productIdMap['sana']

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
      console.error('Insert error:', insertError)
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Policy created successfully:', policy?.id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        policyId: policy?.id,
        message: 'Contract deposited successfully' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
