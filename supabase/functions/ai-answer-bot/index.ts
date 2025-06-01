
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

    const { question, sessionId, userId } = await req.json();

    console.log(`AI Answer Bot - Processing question: ${question}`);

    // Generate embedding for the question
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: question,
      }),
    });

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    // Search for relevant knowledge base entries
    const { data: similarEntries, error: searchError } = await supabaseClient
      .rpc('similarity_search_knowledge_base', {
        query_embedding: queryEmbedding,
        match_threshold: 0.7,
        match_count: 5
      });

    if (searchError) {
      console.error('Knowledge base search error:', searchError);
    }

    let context = '';
    let knowledgeBaseId = null;

    if (similarEntries && similarEntries.length > 0) {
      context = similarEntries
        .map(entry => `Title: ${entry.title}\nContent: ${entry.content}`)
        .join('\n\n');
      knowledgeBaseId = similarEntries[0].id;
    }

    // Generate AI response
    const systemPrompt = `You are a helpful customer support AI assistant. Use the following knowledge base context to answer the user's question. If the context doesn't contain relevant information, provide a helpful general response and suggest the user contact support.

Knowledge Base Context:
${context}

Instructions:
- Be concise but comprehensive
- If you can't answer from the context, be honest about it
- Always be polite and professional
- Suggest next steps when appropriate`;

    const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question }
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    const chatData = await chatResponse.json();
    const aiResponse = chatData.choices[0].message.content;

    // Calculate confidence score based on similarity
    const confidenceScore = similarEntries && similarEntries.length > 0 
      ? similarEntries[0].similarity 
      : 0.3;

    // Store the interaction
    const { error: interactionError } = await supabaseClient
      .from('ai_interactions')
      .insert({
        user_id: userId,
        session_id: sessionId,
        interaction_type: 'answer_bot',
        input_text: question,
        ai_response: aiResponse,
        confidence_score: confidenceScore,
        knowledge_base_id: knowledgeBaseId,
        metadata: {
          similar_entries_count: similarEntries?.length || 0,
          top_similarity: similarEntries?.[0]?.similarity || 0
        }
      });

    if (interactionError) {
      console.error('Error storing interaction:', interactionError);
    }

    // Update knowledge base usage count
    if (knowledgeBaseId) {
      await supabaseClient
        .from('knowledge_base')
        .update({ usage_count: supabaseClient.raw('usage_count + 1') })
        .eq('id', knowledgeBaseId);
    }

    return new Response(
      JSON.stringify({
        answer: aiResponse,
        confidence: confidenceScore,
        sources: similarEntries?.slice(0, 3) || [],
        sessionId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ai-answer-bot function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
