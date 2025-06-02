
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

    // Search for relevant knowledge base entries with higher threshold
    const { data: similarEntries, error: searchError } = await supabaseClient
      .rpc('similarity_search_knowledge_base', {
        query_embedding: queryEmbedding,
        match_threshold: 0.8, // Increased threshold for better relevance
        match_count: 5
      });

    if (searchError) {
      console.error('Knowledge base search error:', searchError);
    }

    let contextChunks = '';
    let knowledgeBaseId = null;
    const fallbackResponse = "I am unable to answer this question with the available information.";

    if (similarEntries && similarEntries.length > 0) {
      // Format as numbered chunks for AI reference
      contextChunks = similarEntries
        .map((entry, index) => `Chunk ${index + 1}:\nTitle: ${entry.title}\nContent: ${entry.content}\nCategory: ${entry.category}`)
        .join('\n\n');
      knowledgeBaseId = similarEntries[0].id;
    }

    // If no relevant chunks found, return fallback immediately
    if (!contextChunks.trim()) {
      // Store the interaction with fallback response
      await supabaseClient
        .from('ai_interactions')
        .insert({
          user_id: userId,
          session_id: sessionId,
          interaction_type: 'answer_bot',
          input_text: question,
          ai_response: fallbackResponse,
          confidence_score: 0,
          knowledge_base_id: null,
          metadata: {
            similar_entries_count: 0,
            fallback_used: true
          }
        });

      return new Response(
        JSON.stringify({
          answer: fallbackResponse,
          confidence: 0,
          sources: [],
          sessionId,
          usedFallback: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Restrictive system prompt
    const systemPrompt = `You are an information retrieval assistant. Your primary role is to answer user questions strictly and exclusively using the information provided in the given context chunks. Your instructions are as follows:

Respond only and exclusively using the information contained in the provided chunks. Do not introduce any information that is not present in the chunks.

If the provided chunks do not contain sufficient information to answer the question, or if the chunks do not directly address the user's query, respond with: "I am unable to answer this question with the available information."

Do not explain your answer or provide any additional commentary. Your responses should be concise and focused on addressing the user's query using only the provided information.

Adhere to the context and limitations at all times. If any part of the question cannot be answered with the provided chunks, you must refrain from speculation or the use of external knowledge.

If there are multiple chunks provided, integrate the information cohesively, but do not infer or create connections beyond what is explicitly stated in the chunks.

If no chunks are provided or if they are insufficient, immediately default to the response outlined in instruction 2.

Final Reminder: Your responses must be anchored solely in the content of the provided chunks. Any deviation from this rule should result in the default response.

Context Chunks:
${contextChunks}`;

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
        temperature: 0.3, // Lower temperature for more consistent responses
        max_tokens: 500,
      }),
    });

    const chatData = await chatResponse.json();
    const aiResponse = chatData.choices[0].message.content;

    // Calculate confidence score based on similarity
    const confidenceScore = similarEntries && similarEntries.length > 0 
      ? similarEntries[0].similarity 
      : 0;

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
          top_similarity: similarEntries?.[0]?.similarity || 0,
          chunks_provided: similarEntries?.length || 0
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
        sessionId,
        usedFallback: aiResponse === fallbackResponse
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
