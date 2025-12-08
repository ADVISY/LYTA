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
    const { email } = await req.json()

    if (!email || typeof email !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Create Supabase client with service role key to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // First, check if email exists as collaborateur in clients table
    const { data: collaborateur, error: collabError } = await supabaseAdmin
      .from('clients')
      .select('id, first_name, last_name, company_name')
      .eq('email', normalizedEmail)
      .eq('type_adresse', 'collaborateur')
      .maybeSingle()

    if (collabError) {
      console.error('Database error (collaborateur):', collabError)
    }

    if (collaborateur) {
      console.log('Found collaborateur:', collaborateur.first_name, collaborateur.last_name)
      return new Response(
        JSON.stringify({
          success: true,
          partner: {
            id: collaborateur.id,
            name: collaborateur.company_name || `${collaborateur.first_name || ''} ${collaborateur.last_name || ''}`.trim(),
            firstName: collaborateur.first_name,
            lastName: collaborateur.last_name
          }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // If not found as collaborateur, check if user is an admin via profiles + user_roles
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, email')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (profileError) {
      console.error('Database error (profile):', profileError)
    }

    if (profile) {
      // Check if this user has admin, manager, or agent role
      const { data: roles, error: rolesError } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', profile.id)
        .in('role', ['admin', 'manager', 'agent'])

      if (rolesError) {
        console.error('Database error (roles):', rolesError)
      }

      if (roles && roles.length > 0) {
        console.log('Found user with role:', roles[0].role)
        return new Response(
          JSON.stringify({
            success: true,
            partner: {
              id: profile.id,
              name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email,
              firstName: profile.first_name,
              lastName: profile.last_name
            }
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
    }

    // Not found in either table
    console.log('Email not found:', normalizedEmail)
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Email not found as collaborateur or admin'
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
