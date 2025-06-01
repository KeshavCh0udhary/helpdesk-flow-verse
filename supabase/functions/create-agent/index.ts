
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create a Supabase client with service role privileges
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')!
    
    // Create a regular Supabase client to verify the requesting user
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { 
        global: { 
          headers: { Authorization: authHeader } 
        } 
      }
    )

    // Verify the user is authenticated and is an admin
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get request body
    const { email, fullName, departmentId } = await req.json()

    if (!email || !fullName || !departmentId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Creating agent:', { email, fullName, departmentId })

    // Create user using admin client with a secure random password they'll never use
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: crypto.randomUUID() + crypto.randomUUID(), // Secure random password
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    })

    if (authError) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: authError.message }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!authData.user) {
      return new Response(
        JSON.stringify({ error: 'Failed to create user' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Update profile with agent role and department using admin client
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        role: 'support_agent',
        department_id: departmentId,
      })
      .eq('id', authData.user.id)

    if (profileError) {
      console.error('Profile error:', profileError)
      // Try to clean up the created user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      
      return new Response(
        JSON.stringify({ error: profileError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Generate password reset link for the new agent
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.supabase.co')}/auth/v1/verify?redirect_to=${encodeURIComponent(new URL(req.url).origin + '/login')}`
      }
    })

    if (linkError) {
      console.error('Link generation error:', linkError)
      // Don't fail the entire operation, but log the error
      console.log('Agent created but password link failed to generate')
    }

    // Send welcome email with password creation link
    if (linkData?.properties?.action_link) {
      try {
        const { error: notificationError } = await supabase.functions.invoke('send-notification', {
          body: {
            type: 'agent_created',
            recipientEmail: email,
            recipientName: fullName,
            passwordResetLink: linkData.properties.action_link,
          },
        })

        if (notificationError) {
          console.error('Notification error:', notificationError)
          // Don't fail the operation, just log
        }
      } catch (emailError) {
        console.error('Email sending error:', emailError)
        // Don't fail the operation, just log
      }
    }

    console.log('Agent created successfully:', authData.user.id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: {
          id: authData.user.id,
          email: authData.user.email,
          full_name: fullName
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
