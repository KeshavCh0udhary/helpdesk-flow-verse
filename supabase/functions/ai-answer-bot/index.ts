
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper Function to Fetch and Format History
async function getFormattedConversationHistory(
  supabaseClient: SupabaseClient,
  sessionId: string,
  limit: number = 5
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  if (!sessionId) {
    return [];
  }

  const { data, error } = await supabaseClient
    .from('ai_interactions')
    .select('input_text, ai_response, interaction_type')
    .eq('session_id', sessionId)
    .eq('interaction_type', 'answer_bot')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching conversation history:', error);
    return [];
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Format for OpenAI messages array, in chronological order (oldest first)
  const historyMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  // Data is fetched newest first, so reverse it for chronological order
  for (let i = data.length - 1; i >= 0; i--) {
    const interaction = data[i];
    if (interaction.input_text) {
      historyMessages.push({ role: 'user', content: interaction.input_text });
    }
    if (interaction.ai_response) {
      historyMessages.push({ role: 'assistant', content: interaction.ai_response });
    }
  }
  return historyMessages;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not found in environment variables.');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Supabase URL or Service Role Key not found in environment variables.');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { question, sessionId, userId } = await req.json();

    if (!question || typeof question !== 'string' || question.trim() === "") {
        return new Response(JSON.stringify({ error: "Question is missing or empty." }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    console.log(`AI Answer Bot - Session: ${sessionId}, User: ${userId} - Processing question: ${question}`);

    // Generate embedding for the current question
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

    if (!embeddingResponse.ok) {
      const errorBody = await embeddingResponse.json();
      console.error('OpenAI Embedding API error:', errorBody);
      throw new Error(`OpenAI Embedding API request failed: ${embeddingResponse.statusText}`);
    }
    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    // Search for relevant knowledge base entries
    const { data: similarEntries, error: searchError } = await supabaseClient
      .rpc('similarity_search_knowledge_base', {
        query_embedding: queryEmbedding,
        match_threshold: 0.78,
        match_count: 5
      });

    if (searchError) {
      console.error('Knowledge base search error:', searchError);
    }

    let contextChunksText = '';
    let knowledgeBaseIdForLogging = null;
    const fallbackResponse = "I am unable to answer this question with the available information.";

    if (similarEntries && similarEntries.length > 0) {
      contextChunksText = similarEntries
        .map((entry, index) => `Chunk ${index + 1} (Source ID: ${entry.id || 'N/A'}):\nTitle: ${entry.title || 'N/A'}\nContent: ${entry.content}\nCategory: ${entry.category || 'N/A'}`)
        .join('\n\n---\n\n');
      knowledgeBaseIdForLogging = similarEntries[0].id;
    }

    // Fetch conversation history
    const conversationHistory = await getFormattedConversationHistory(supabaseClient, sessionId);

    // If no relevant KB chunks found for the current question, return fallback
    if (!contextChunksText.trim()) {
      console.log("No relevant knowledge base chunks found for the question. Using fallback.");
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
            fallback_used: true,
            history_length: conversationHistory.length
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

    // Construct messages for OpenAI Chat API, including history
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    // Enhanced system prompt with conversation history awareness
    const systemPrompt = `You are an information retrieval assistant. Your primary role is to answer the LATEST user question strictly and exclusively using the information provided in the "Knowledge Base Context Chunks" section.

General Instructions:
1. Base your answer ONLY on the "Knowledge Base Context Chunks" provided for the LATEST user question.
2. If the "Knowledge Base Context Chunks" do not contain sufficient information to answer the LATEST user question, or if they do not directly address it, respond with: "${fallbackResponse}"
3. Do NOT use any information from the "Previous Conversation History" to form your answer, unless that information is also present in the "Knowledge Base Context Chunks" for the current question. The history is for contextual understanding of the LATEST user question only.
4. Do not introduce any information, infer, or create connections beyond what is explicitly stated in the "Knowledge Base Context Chunks".
5. Your responses should be concise. Do not explain that you are an AI or that you are using chunks. Just provide the answer or the fallback statement.
6. If multiple chunks are relevant, synthesize the information cohesively.
7. If asked about your capabilities or to do something outside of answering based on the provided chunks (e.g., "tell me a joke", "what's the weather"), respond with: "${fallbackResponse}"

Format of Information:
You will be provided with:
- (Optional) "Previous Conversation History": For understanding the flow of dialogue.
- "Knowledge Base Context Chunks": This is the ONLY source for your answers.
- The "LATEST User Question".

Previous Conversation History:
${conversationHistory.length > 0 ? conversationHistory.map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join('\n') : 'No previous conversation history.'}

Knowledge Base Context Chunks for the LATEST User Question:
${contextChunksText}
---
Respond to the LATEST User Question based ONLY on the "Knowledge Base Context Chunks" above.`;

    messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: question });

    // Call OpenAI Chat Completions API
    const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0.1,
        max_tokens: 300,
      }),
    });

    if (!chatResponse.ok) {
      const errorBody = await chatResponse.json();
      console.error('OpenAI Chat API error:', errorBody);
      throw new Error(`OpenAI Chat API request failed: ${chatResponse.statusText}`);
    }

    const chatData = await chatResponse.json();
    let aiResponse = chatData.choices[0].message.content.trim();

    // Fallback safety check
    if (!aiResponse || (similarEntries && similarEntries.length === 0 && aiResponse !== fallbackResponse)) {
      aiResponse = fallbackResponse;
    }

    // Store interaction and update usage
    const confidenceScore = (similarEntries && similarEntries.length > 0)
      ? (similarEntries[0].similarity || 0)
      : 0;

    const { error: interactionError } = await supabaseClient
      .from('ai_interactions')
      .insert({
        user_id: userId,
        session_id: sessionId,
        interaction_type: 'answer_bot',
        input_text: question,
        ai_response: aiResponse,
        confidence_score: confidenceScore,
        knowledge_base_id: knowledgeBaseIdForLogging,
        metadata: {
          similar_entries_count: similarEntries?.length || 0,
          top_similarity: confidenceScore,
          chunks_provided_count: similarEntries?.length || 0,
          history_length: conversationHistory.length,
          model_used: 'gpt-4o-mini'
        }
      });

    if (interactionError) {
      console.error('Error storing interaction:', interactionError);
    }

    // Update usage count for the top chunk if KB was actually used
    if (knowledgeBaseIdForLogging && aiResponse !== fallbackResponse) {
      const { error: updateError } = await supabaseClient
        .rpc('increment_kb_usage_count', { row_id: knowledgeBaseIdForLogging });
      if (updateError) console.error("Error updating KB usage count:", updateError);
    }

    return new Response(
      JSON.stringify({
        answer: aiResponse,
        confidence: confidenceScore,
        sources: (aiResponse !== fallbackResponse && similarEntries) 
          ? similarEntries.slice(0, 3).map(e => ({
              id: e.id, 
              title: e.title, 
              similarity: e.similarity,
              category: e.category
            })) 
          : [],
        sessionId,
        usedFallback: aiResponse === fallbackResponse
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ai-answer-bot function:', error.message, error.stack);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
