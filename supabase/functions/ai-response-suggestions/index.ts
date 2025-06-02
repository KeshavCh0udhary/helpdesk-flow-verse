
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

    // Search for relevant response templates with higher threshold
    const { data: templates, error: templateError } = await supabaseClient
      .rpc('similarity_search_response_templates', {
        query_embedding: queryEmbedding,
        dept_id: ticket.department_id,
        match_threshold: 0.75, // Increased threshold
        match_count: 3
      });

    if (templateError) {
      console.error('Template search error:', templateError);
    }

    // Search knowledge base for context with higher threshold
    const { data: knowledgeEntries, error: kbError } = await supabaseClient
      .rpc('similarity_search_knowledge_base', {
        query_embedding: queryEmbedding,
        match_threshold: 0.8, // Increased threshold
        match_count: 3
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
        contextChunks += `Chunk ${chunkCount}:\nType: Response Template\nName: ${template.name}\nContent: ${template.content}\nCategory: ${template.category}\n\n`;
      });
    }

    if (knowledgeEntries && knowledgeEntries.length > 0) {
      knowledgeEntries.forEach((entry, index) => {
        chunkCount++;
        contextChunks += `Chunk ${chunkCount}:\nType: Knowledge Base\nTitle: ${entry.title}\nContent: ${entry.content}\nCategory: ${entry.category}\n\n`;
      });
    }

    const conversationHistory = ticket.comments && ticket.comments.length > 0
      ? ticket.comments
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          .map(c => `Comment: ${c.content}`)
          .join('\n')
      : 'No previous comments.';

    // If no relevant chunks found, return empty suggestions
    if (!contextChunks.trim()) {
      console.log(`No relevant chunks found for ticket ${ticketId}`);
      
      await supabaseClient
        .from('ai_interactions')
        .insert({
          session_id: `suggestions_${ticketId}_${agentId}`,
          interaction_type: 'response_suggestion',
          input_text: ticketText,
          ai_response: 'No suggestions available - insufficient context',
          confidence_score: 0,
          ticket_id: ticketId,
          metadata: {
            agent_id: agentId,
            templates_found: 0,
            knowledge_entries_found: 0,
            insufficient_context: true
          }
        });

      return new Response(
        JSON.stringify({
          suggestions: [],
          sources: {
            templates: [],
            knowledge: []
          },
          message: "No relevant information found to generate suggestions for this ticket."
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Restrictive system prompt for suggestions
    const suggestionPrompt = `You are an information retrieval assistant. Your primary role is to generate response suggestions strictly and exclusively using the information provided in the given context chunks. Your instructions are as follows:

Respond only and exclusively using the information contained in the provided chunks. Do not introduce any information that is not present in the chunks.

If the provided chunks do not contain sufficient information to generate appropriate response suggestions, or if the chunks do not directly address the ticket's issues, respond with a JSON object containing an empty suggestions array and indicate insufficient information.

Do not explain your suggestions or provide any additional commentary. Your suggestions should be concise and focused on addressing the ticket using only the provided information.

Adhere to the context and limitations at all times. If any part of the ticket cannot be addressed with the provided chunks, you must refrain from speculation or the use of external knowledge.

If there are multiple chunks provided, integrate the information cohesively, but do not infer or create connections beyond what is explicitly stated in the chunks.

If no chunks are provided or if they are insufficient, immediately return empty suggestions.

Final Reminder: Your response suggestions must be anchored solely in the content of the provided chunks. Any deviation from this rule should result in empty suggestions.

Ticket Information:
Title: ${ticket.title}
Description: ${ticket.description}
Status: ${ticket.status}
Priority: ${ticket.priority}

Conversation History:
${conversationHistory}

Context Chunks:
${contextChunks}

Generate up to 3 response suggestions that are based ONLY on the provided chunks. Respond with JSON in this exact format:
{
  "suggestions": [
    {
      "title": "Solution from Available Information",
      "content": "Response text based only on provided chunks...",
      "tone": "professional",
      "confidence": 0.85
    }
  ]
}

If the chunks do not contain adequate information for the ticket, respond with:
{
  "suggestions": []
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
          { role: 'system', content: 'You are an expert customer support AI. Always respond with valid JSON only. Follow the restrictive guidelines exactly.' },
          { role: 'user', content: suggestionPrompt }
        ],
        temperature: 0.1, // Lower temperature for consistency
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
        confidence_score: suggestions.suggestions?.[0]?.confidence || 0,
        ticket_id: ticketId,
        metadata: {
          agent_id: agentId,
          templates_found: templates?.length || 0,
          knowledge_entries_found: knowledgeEntries?.length || 0,
          chunks_provided: chunkCount
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
