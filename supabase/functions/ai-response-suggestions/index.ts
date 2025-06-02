
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

    // Search for relevant response templates with lower threshold
    const { data: templates, error: templateError } = await supabaseClient
      .rpc('similarity_search_response_templates', {
        query_embedding: queryEmbedding,
        dept_id: ticket.department_id,
        match_threshold: 0.4, // Lowered threshold
        match_count: 5
      });

    if (templateError) {
      console.error('Template search error:', templateError);
    }

    // Search knowledge base for context with lower threshold
    const { data: knowledgeEntries, error: kbError } = await supabaseClient
      .rpc('similarity_search_knowledge_base', {
        query_embedding: queryEmbedding,
        match_threshold: 0.4, // Lowered threshold
        match_count: 5
      });

    if (kbError) {
      console.error('Knowledge base search error:', kbError);
    }

    // Format context as numbered chunks
    let contextChunks = '';
    let chunkCount = 0;

    if (templates && templates.length > 0) {
      templates.forEach((template, index) => {
        chunkCount++;
        contextChunks += `Chunk ${chunkCount}:\nType: Response Template\nName: ${template.name}\nContent: ${template.content}\nCategory: ${template.category}\nRelevance: ${Math.round(template.similarity * 100)}%\n\n`;
      });
    }

    if (knowledgeEntries && knowledgeEntries.length > 0) {
      knowledgeEntries.forEach((entry, index) => {
        chunkCount++;
        contextChunks += `Chunk ${chunkCount}:\nType: Knowledge Base\nTitle: ${entry.title}\nContent: ${entry.content}\nCategory: ${entry.category}\nRelevance: ${Math.round(entry.similarity * 100)}%\n\n`;
      });
    }

    const conversationHistory = ticket.comments && ticket.comments.length > 0
      ? ticket.comments
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          .map(c => `Comment: ${c.content}`)
          .join('\n')
      : 'No previous comments.';

    console.log(`Found ${chunkCount} context chunks for ticket ${ticketId}`);

    // Updated system prompt - more helpful and flexible
    const suggestionPrompt = `You are a helpful customer support assistant that generates response suggestions for tickets. Your goal is to provide useful, actionable suggestions that help support agents respond effectively.

INSTRUCTIONS:
1. Generate 2-3 practical response suggestions based on the ticket content and any available context
2. If relevant context is provided, prioritize it but don't be limited by it
3. Create suggestions with different tones (professional, friendly, detailed) when appropriate
4. If limited context is available, still provide helpful general guidance based on the ticket type
5. Each suggestion should be actionable and ready to use
6. Focus on being helpful rather than restrictive

Ticket Information:
Title: ${ticket.title}
Description: ${ticket.description}
Status: ${ticket.status}
Priority: ${ticket.priority}

Conversation History:
${conversationHistory}

${contextChunks ? `Available Context Information:\n${contextChunks}` : 'No specific context available - generate helpful general suggestions.'}

Generate 2-3 response suggestions in this exact JSON format:
{
  "suggestions": [
    {
      "title": "Professional Response",
      "content": "Thank you for contacting us regarding [issue]. [Provide helpful response based on available information or general best practices]",
      "tone": "professional", 
      "confidence": 0.85
    },
    {
      "title": "Friendly Approach",
      "content": "Hi! I'd be happy to help you with [issue]. [Provide helpful response]",
      "tone": "friendly",
      "confidence": 0.80
    }
  ]
}

Remember: Always aim to be helpful. If specific context is limited, provide general guidance that would be appropriate for this type of issue.`;

    const suggestionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful customer support AI. Always respond with valid JSON only. Be helpful and provide useful suggestions even when context is limited.' },
          { role: 'user', content: suggestionPrompt }
        ],
        temperature: 0.3, // Balanced temperature for helpful but consistent responses
        max_tokens: 1000,
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
        confidence_score: suggestions.suggestions?.[0]?.confidence || 0,
        ticket_id: ticketId,
        metadata: {
          agent_id: agentId,
          templates_found: templates?.length || 0,
          knowledge_entries_found: knowledgeEntries?.length || 0,
          chunks_provided: chunkCount,
          improved_system: true
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

    console.log(`Generated ${suggestions.suggestions?.length || 0} response suggestions for ticket ${ticketId}`);

    return new Response(
      JSON.stringify({
        suggestions: suggestions.suggestions || [],
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
