
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not found');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { ticketId, title, description } = await req.json();

    console.log(`AI Ticket Routing - Processing ticket: ${ticketId}`);

    // Get all departments for routing analysis
    const { data: departments, error: deptError } = await supabaseClient
      .from('departments')
      .select('id, name, description');

    if (deptError) {
      throw new Error(`Error fetching departments: ${deptError.message}`);
    }

    // Create prompt for AI routing
    const departmentContext = departments
      .map(dept => `${dept.name}: ${dept.description || 'No description'}`)
      .join('\n');

    const routingPrompt = `Analyze this support ticket and determine the best department for routing.

Available Departments:
${departmentContext}

Ticket Details:
Title: ${title}
Description: ${description}

Respond with JSON in this exact format:
{
  "recommended_department": "department_name",
  "confidence": 0.85,
  "reasoning": "Brief explanation of why this department is recommended",
  "priority_suggestion": "low|medium|high|urgent",
  "tags": ["tag1", "tag2"]
}`;

    const routingResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an expert support ticket routing system. Always respond with valid JSON only.' },
          { role: 'user', content: routingPrompt }
        ],
        temperature: 0.3,
        max_tokens: 300,
      }),
    });

    const routingData = await routingResponse.json();
    const routingResult = JSON.parse(routingData.choices[0].message.content);

    // Find the recommended department ID
    const recommendedDept = departments.find(
      dept => dept.name.toLowerCase() === routingResult.recommended_department.toLowerCase()
    );

    if (!recommendedDept) {
      throw new Error(`Recommended department "${routingResult.recommended_department}" not found`);
    }

    // Generate embedding for the ticket
    const ticketText = `${title} ${description}`;
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: ticketText,
      }),
    });

    const embeddingData = await embeddingResponse.json();
    const embedding = embeddingData.data[0].embedding;

    // Update ticket with AI routing metadata and embedding
    const { error: updateError } = await supabaseClient
      .from('tickets')
      .update({
        department_id: recommendedDept.id,
        priority: routingResult.priority_suggestion,
        routing_confidence: routingResult.confidence,
        embedding: embedding,
        ai_routing_metadata: {
          recommended_department: routingResult.recommended_department,
          reasoning: routingResult.reasoning,
          tags: routingResult.tags,
          routed_at: new Date().toISOString()
        }
      })
      .eq('id', ticketId);

    if (updateError) {
      throw new Error(`Error updating ticket: ${updateError.message}`);
    }

    // Store AI interaction
    await supabaseClient
      .from('ai_interactions')
      .insert({
        session_id: `routing_${ticketId}`,
        interaction_type: 'auto_routing',
        input_text: ticketText,
        ai_response: JSON.stringify(routingResult),
        confidence_score: routingResult.confidence,
        ticket_id: ticketId,
        metadata: {
          recommended_department_id: recommendedDept.id,
          priority_suggestion: routingResult.priority_suggestion
        }
      });

    console.log(`Successfully routed ticket ${ticketId} to ${routingResult.recommended_department}`);

    return new Response(
      JSON.stringify({
        success: true,
        routing: {
          department_id: recommendedDept.id,
          department_name: routingResult.recommended_department,
          confidence: routingResult.confidence,
          reasoning: routingResult.reasoning,
          priority: routingResult.priority_suggestion,
          tags: routingResult.tags
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ai-ticket-routing function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
