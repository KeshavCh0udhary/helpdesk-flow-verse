
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

    const { ticketId, agentId } = await req.json();

    console.log(`AI Response Suggestions - Processing ticket: ${ticketId}`);

    // Get ticket details with comments
    const { data: ticket, error: ticketError } = await supabaseClient
      .from('tickets')
      .select(`
        *,
        comments (
          id,
          content,
          created_at,
          user_id
        )
      `)
      .eq('id', ticketId)
      .single();

    if (ticketError) {
      throw new Error(`Error fetching ticket: ${ticketError.message}`);
    }

    // Generate embedding for the ticket content
    const ticketText = `${ticket.title} ${ticket.description}`;
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
    const queryEmbedding = embeddingData.data[0].embedding;

    // Search for relevant response templates
    const { data: templates, error: templateError } = await supabaseClient
      .rpc('similarity_search_response_templates', {
        query_embedding: queryEmbedding,
        dept_id: ticket.department_id,
        match_threshold: 0.6,
        match_count: 3
      });

    if (templateError) {
      console.error('Template search error:', templateError);
    }

    // Search knowledge base for context
    const { data: knowledgeEntries, error: kbError } = await supabaseClient
      .rpc('similarity_search_knowledge_base', {
        query_embedding: queryEmbedding,
        match_threshold: 0.7,
        match_count: 3
      });

    if (kbError) {
      console.error('Knowledge base search error:', kbError);
    }

    // Prepare context for AI
    const templateContext = templates && templates.length > 0
      ? templates.map(t => `Template: ${t.name}\nContent: ${t.content}`).join('\n\n')
      : 'No relevant templates found.';

    const knowledgeContext = knowledgeEntries && knowledgeEntries.length > 0
      ? knowledgeEntries.map(k => `Knowledge: ${k.title}\nContent: ${k.content}`).join('\n\n')
      : 'No relevant knowledge base entries found.';

    const conversationHistory = ticket.comments && ticket.comments.length > 0
      ? ticket.comments
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          .map(c => `Comment: ${c.content}`)
          .join('\n')
      : 'No previous comments.';

    const suggestionPrompt = `As a customer support AI assistant, generate 3 helpful response suggestions for this ticket.

Ticket Details:
Title: ${ticket.title}
Description: ${ticket.description}
Status: ${ticket.status}
Priority: ${ticket.priority}

Conversation History:
${conversationHistory}

Available Templates:
${templateContext}

Knowledge Base Context:
${knowledgeContext}

Generate 3 response suggestions that are:
1. Professional and empathetic
2. Address the customer's specific issue
3. Provide actionable solutions
4. Vary in tone from formal to friendly

Respond with JSON in this format:
{
  "suggestions": [
    {
      "title": "Solution-focused Response",
      "content": "Response text here...",
      "tone": "professional",
      "confidence": 0.85
    },
    {
      "title": "Empathetic Response",
      "content": "Response text here...",
      "tone": "friendly",
      "confidence": 0.80
    },
    {
      "title": "Technical Response",
      "content": "Response text here...",
      "tone": "detailed",
      "confidence": 0.75
    }
  ]
}`;

    const suggestionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an expert customer support AI. Always respond with valid JSON only.' },
          { role: 'user', content: suggestionPrompt }
        ],
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    const suggestionData = await suggestionResponse.json();
    const suggestions = JSON.parse(suggestionData.choices[0].message.content);

    // Store AI interaction
    await supabaseClient
      .from('ai_interactions')
      .insert({
        session_id: `suggestions_${ticketId}_${agentId}`,
        interaction_type: 'response_suggestion',
        input_text: ticketText,
        ai_response: JSON.stringify(suggestions),
        confidence_score: suggestions.suggestions[0]?.confidence || 0.7,
        ticket_id: ticketId,
        metadata: {
          agent_id: agentId,
          templates_found: templates?.length || 0,
          knowledge_entries_found: knowledgeEntries?.length || 0
        }
      });

    // Update response template usage counts
    if (templates && templates.length > 0) {
      for (const template of templates) {
        await supabaseClient
          .from('response_templates')
          .update({ usage_count: supabaseClient.raw('usage_count + 1') })
          .eq('id', template.id);
      }
    }

    console.log(`Generated ${suggestions.suggestions.length} response suggestions for ticket ${ticketId}`);

    return new Response(
      JSON.stringify({
        suggestions: suggestions.suggestions,
        sources: {
          templates: templates || [],
          knowledge: knowledgeEntries || []
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ai-response-suggestions function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
