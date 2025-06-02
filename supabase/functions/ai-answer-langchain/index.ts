
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// LangChain-style OpenAI Embeddings
class OpenAIEmbeddings {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async embedQuery(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.substring(0, 8000),
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  async findSimilarDocuments(queryEmbedding: number[], documents: any[], topK: number = 5) {
    const similarities = documents.map(doc => ({
      ...doc,
      similarity: this.cosineSimilarity(queryEmbedding, doc.embedding)
    }));

    similarities.sort((a, b) => b.similarity - a.similarity);
    return similarities.slice(0, topK);
  }
}

// LangChain-style Retrieval QA Chain
class RetrievalQA {
  private llm: any;
  private retriever: any;
  private embeddings: OpenAIEmbeddings;

  constructor(llm: any, retriever: any, embeddings: OpenAIEmbeddings) {
    this.llm = llm;
    this.retriever = retriever;
    this.embeddings = embeddings;
  }

  async call(input: { query: string; conversationHistory?: any[] }) {
    console.log('RetrievalQA: Processing query:', input.query);
    
    // Get relevant documents
    const relevantDocs = await this.retriever.getRelevantDocuments(input.query);
    console.log(`Found ${relevantDocs.length} relevant documents`);
    
    if (relevantDocs.length === 0) {
      return {
        text: "I don't have enough information in my knowledge base to answer that question. Could you please provide more context or rephrase your question?",
        sourceDocuments: [],
        confidence: 0.1,
        usedFallback: true
      };
    }

    // Build context from retrieved documents
    const context = relevantDocs
      .map((doc, index) => `Source ${index + 1}: ${doc.pageContent}`)
      .join('\n\n');

    // Include conversation history for context
    let conversationContext = '';
    if (input.conversationHistory && input.conversationHistory.length > 0) {
      conversationContext = '\n\nRecent conversation:\n' + 
        input.conversationHistory
          .slice(-3)
          .map(exchange => `Human: ${exchange.question}\nAssistant: ${exchange.answer}`)
          .join('\n');
    }

    // Generate answer using LLM
    const prompt = `You are a helpful AI assistant that answers questions based on the provided context. 
Use the context below to answer the question. If the context doesn't contain enough information to answer the question, say so clearly.

Context:
${context}${conversationContext}

Question: ${input.query}

Instructions:
- Provide a clear, accurate answer based on the context
- If the context is insufficient, explain what information is missing
- Be concise but thorough
- Use a professional but friendly tone

Answer:`;

    const response = await this.llm.call(prompt);
    
    // Calculate confidence based on relevance of sources
    const avgSimilarity = relevantDocs.reduce((sum, doc) => sum + (doc.metadata?.similarity || 0), 0) / relevantDocs.length;
    const confidence = Math.min(avgSimilarity * 1.2, 0.95); // Boost confidence slightly but cap at 95%

    return {
      text: response,
      sourceDocuments: relevantDocs,
      confidence,
      usedFallback: false
    };
  }
}

// Simple LLM wrapper for OpenAI
class OpenAI {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async call(prompt: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1000
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }
}

// Vector store retriever
class VectorStoreRetriever {
  private supabase: any;
  private embeddings: OpenAIEmbeddings;

  constructor(supabase: any, embeddings: OpenAIEmbeddings) {
    this.supabase = supabase;
    this.embeddings = embeddings;
  }

  async getRelevantDocuments(query: string) {
    console.log('Retrieving relevant documents for:', query);
    
    // Get query embedding
    const queryEmbedding = await this.embeddings.embedQuery(query);
    
    // Search in knowledge base using embedding similarity
    const { data: knowledgeEntries, error } = await this.supabase
      .from('knowledge_base')
      .select('*');

    if (error) {
      console.error('Error fetching knowledge base:', error);
      return [];
    }

    if (!knowledgeEntries || knowledgeEntries.length === 0) {
      console.log('No knowledge base entries found');
      return [];
    }

    // For each entry, calculate similarity if it has embeddings
    const documentsWithSimilarity = [];
    
    for (const entry of knowledgeEntries) {
      try {
        // Get embedding for this entry
        const { data: embeddingData } = await this.supabase
          .from('knowledge_base_embeddings')
          .select('embedding')
          .eq('knowledge_base_id', entry.id)
          .single();

        if (embeddingData && embeddingData.embedding) {
          const similarity = this.cosineSimilarity(queryEmbedding, embeddingData.embedding);
          
          if (similarity > 0.7) { // Only include relevant matches
            documentsWithSimilarity.push({
              pageContent: `${entry.title}\n${entry.content}`,
              metadata: {
                id: entry.id,
                title: entry.title,
                category: entry.category,
                similarity: similarity
              }
            });
          }
        }
      } catch (embeddingError) {
        console.log(`Could not get embedding for entry ${entry.id}:`, embeddingError.message);
        // Include without similarity score as fallback
        if (entry.title.toLowerCase().includes(query.toLowerCase()) || 
            entry.content.toLowerCase().includes(query.toLowerCase())) {
          documentsWithSimilarity.push({
            pageContent: `${entry.title}\n${entry.content}`,
            metadata: {
              id: entry.id,
              title: entry.title,
              category: entry.category,
              similarity: 0.5 // Default similarity for text matches
            }
          });
        }
      }
    }

    // Sort by similarity and return top results
    documentsWithSimilarity.sort((a, b) => (b.metadata.similarity || 0) - (a.metadata.similarity || 0));
    
    const topResults = documentsWithSimilarity.slice(0, 5);
    console.log(`Returning ${topResults.length} relevant documents`);
    
    return topResults;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing required Supabase environment variables');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { question, sessionId, userId, conversationHistory } = await req.json();

    if (!question || !userId) {
      throw new Error('Question and userId are required');
    }

    console.log(`Processing LangChain Q&A for user ${userId}: ${question}`);

    // Initialize LangChain components
    const embeddings = new OpenAIEmbeddings(openAIApiKey);
    const llm = new OpenAI(openAIApiKey);
    const retriever = new VectorStoreRetriever(supabaseClient, embeddings);
    
    // Create retrieval QA chain
    const qa = new RetrievalQA(llm, retriever, embeddings);
    
    // Process the question
    const result = await qa.call({ 
      query: question, 
      conversationHistory: conversationHistory || [] 
    });

    // Log the interaction
    const { error: logError } = await supabaseClient
      .from('ai_interactions')
      .insert({
        user_id: userId,
        question: question,
        answer: result.text,
        confidence: result.confidence,
        session_id: sessionId || `langchain_${Date.now()}`,
        sources_used: result.sourceDocuments.length,
        processing_method: 'langchain-retrieval-qa'
      });

    if (logError) {
      console.error('Error logging interaction:', logError);
    }

    // Format response
    const response = {
      answer: result.text,
      confidence: result.confidence,
      sources: result.sourceDocuments.map(doc => ({
        id: doc.metadata.id,
        title: doc.metadata.title,
        category: doc.metadata.category,
        similarity: doc.metadata.similarity
      })),
      sessionId: sessionId || `langchain_${Date.now()}`,
      usedFallback: result.usedFallback,
      reasoning: result.usedFallback ? 
        'Insufficient information in knowledge base' : 
        'Answer generated using LangChain retrieval-augmented generation'
    };

    console.log(`LangChain Q&A completed with confidence: ${result.confidence}`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in LangChain AI answer:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to process question with LangChain',
        details: error.stack
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
