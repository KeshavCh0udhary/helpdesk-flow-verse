
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

    // Search for relevant knowledge base entries with improved threshold
    const { data: similarEntries, error: searchError } = await supabaseClient
      .rpc('similarity_search_knowledge_base', {
        query_embedding: queryEmbedding,
        match_threshold: 0.6, // Lowered from 0.7 to 0.6 for better matching
        match_count: 8 // Increased from 5 to 8 for more context
      });

    if (searchError) {
      console.error('Knowledge base search error:', searchError);
    }

    // Enhanced debugging - log similarity scores with more detail
    console.log(`Found ${similarEntries?.length || 0} potential matches for question: "${question}"`);
    if (similarEntries && similarEntries.length > 0) {
      similarEntries.forEach((entry, index) => {
        console.log(`Match ${index + 1}: Title="${entry.title}", Similarity=${entry.similarity}, Category=${entry.category}, Tags=${entry.tags || 'none'}`);
      });
    } else {
      console.log('No matches found above threshold 0.6');
    }

    let contextChunksText = '';
    let knowledgeBaseIdForLogging = null;
    const fallbackResponse = "I am unable to answer this question with the available information.";

    if (similarEntries && similarEntries.length > 0) {
      // Filter for higher quality matches (above 0.65) if available
      const highQualityMatches = similarEntries.filter(entry => entry.similarity > 0.65);
      const matchesToUse = highQualityMatches.length > 0 ? highQualityMatches : similarEntries.slice(0, 5);
      
      contextChunksText = matchesToUse
        .map((entry, index) => `Knowledge Entry ${index + 1}:\nTitle: ${entry.title || 'N/A'}\nContent: ${entry.content}\nCategory: ${entry.category || 'N/A'}\nRelevance: ${Math.round(entry.similarity * 100)}%`)
        .join('\n\n---\n\n');
      knowledgeBaseIdForLogging = matchesToUse[0].id;
      
      console.log(`Using ${matchesToUse.length} knowledge entries for context`);
    }

    // Fetch conversation history
    const conversationHistory = await getFormattedConversationHistory(supabaseClient, sessionId);

    // Only use fallback if we have no relevant matches above 0.6 threshold
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
            history_length: conversationHistory.length,
            threshold_used: 0.6
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

    // Enhanced system prompt with better instructions for knowledge base usage
    const systemPrompt = `You are a knowledgeable support assistant. Your primary role is to answer user questions using ONLY the information provided in the Knowledge Base entries below.

CRITICAL INSTRUCTIONS:
1. Base your answer EXCLUSIVELY on the Knowledge Base entries provided below
2. If the Knowledge Base entries contain information that answers the user's question, provide a clear, helpful response
3. DO NOT say you cannot answer if relevant information exists in the Knowledge Base
4. Synthesize information from multiple entries if needed to provide a complete answer
5. Be conversational and helpful, not robotic
6. If the Knowledge Base truly lacks sufficient information to answer the question, then respond with: "${fallbackResponse}"

Previous Conversation History:
${conversationHistory.length > 0 ? conversationHistory.map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join('\n') : 'No previous conversation history.'}

Knowledge Base Entries:
${contextChunksText}

User Question: ${question}

Instructions: Answer the user's question based on the Knowledge Base entries above. Be helpful and conversational. Only use the fallback response if the Knowledge Base truly cannot help answer their question.`;

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
        temperature: 0.2, // Lowered for more consistent responses
        max_tokens: 400, // Increased for more detailed responses
      }),
    });

    if (!chatResponse.ok) {
      const errorBody = await chatResponse.json();
      console.error('OpenAI Chat API error:', errorBody);
      throw new Error(`OpenAI Chat API request failed: ${chatResponse.statusText}`);
    }

    const chatData = await chatResponse.json();
    let aiResponse = chatData.choices[0].message.content.trim();

    // Enhanced fallback detection - only trigger if response is exactly the fallback
    const isFallbackResponse = aiResponse === fallbackResponse;
    
    console.log(`AI Response generated: ${isFallbackResponse ? 'FALLBACK' : 'KNOWLEDGE-BASED'}`);

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
          model_used: 'gpt-4o-mini',
          threshold_used: 0.6,
          fallback_used: isFallbackResponse
        }
      });

    if (interactionError) {
      console.error('Error storing interaction:', interactionError);
    }

    // Update usage count for the top chunk if KB was actually used
    if (knowledgeBaseIdForLogging && !isFallbackResponse) {
      const { error: updateError } = await supabaseClient
        .rpc('increment_kb_usage_count', { row_id: knowledgeBaseIdForLogging });
      if (updateError) console.error("Error updating KB usage count:", updateError);
    }

    return new Response(
      JSON.stringify({
        answer: aiResponse,
        confidence: confidenceScore,
        sources: (!isFallbackResponse && similarEntries) 
          ? similarEntries.slice(0, 3).map(e => ({
              id: e.id, 
              title: e.title, 
              similarity: e.similarity,
              category: e.category
            })) 
          : [],
        sessionId,
        usedFallback: isFallbackResponse
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
