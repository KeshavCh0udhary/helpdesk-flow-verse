
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// LangChain-style PDF loader implementation
class PDFLoader {
  private pdfBytes: Uint8Array;

  constructor(pdfBytes: Uint8Array) {
    this.pdfBytes = pdfBytes;
  }

  async load() {
    const text = await this.extractText();
    return [{
      pageContent: text,
      metadata: { source: 'pdf' }
    }];
  }

  private async extractText(): Promise<string> {
    // Try multiple extraction strategies
    const strategies = [
      () => this.extractFromTextObjects(),
      () => this.extractFromStreams(),
      () => this.extractFromStructure()
    ];

    for (const strategy of strategies) {
      try {
        const text = await strategy();
        if (text && text.length > 100 && this.isReadableText(text)) {
          console.log(`PDF extraction successful with strategy, got ${text.length} characters`);
          return this.cleanText(text);
        }
      } catch (error) {
        console.log(`Strategy failed: ${error.message}`);
        continue;
      }
    }

    throw new Error('All PDF extraction strategies failed to extract readable text');
  }

  private async extractFromTextObjects(): Promise<string> {
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const pdfContent = decoder.decode(this.pdfBytes);
    
    let extractedText = '';
    
    // Look for text between BT (Begin Text) and ET (End Text) operators
    const textBlockRegex = /BT\s+(.*?)\s+ET/gs;
    let match;
    
    while ((match = textBlockRegex.exec(pdfContent)) !== null) {
      const textCommands = match[1];
      
      // Extract text from Tj (show text) operators
      const tjRegex = /\(([^)]+)\)\s*Tj/g;
      let textMatch;
      
      while ((textMatch = tjRegex.exec(textCommands)) !== null) {
        let text = textMatch[1];
        text = text
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\\(/g, '(')
          .replace(/\\\)/g, ')')
          .replace(/\\\\/g, '\\');
        
        if (text.trim().length > 2) {
          extractedText += text + ' ';
        }
      }
    }
    
    return extractedText;
  }

  private async extractFromStreams(): Promise<string> {
    const decoder = new TextDecoder('latin1');
    const pdfContent = decoder.decode(this.pdfBytes);
    
    let extractedText = '';
    
    // Extract readable text from uncompressed streams
    const readableTextRegex = /[A-Za-z][A-Za-z0-9\s\.,!?;:'"(){}[\]\-+=%$@#&*]{10,}/g;
    const matches = pdfContent.match(readableTextRegex) || [];
    
    for (const match of matches) {
      if (this.isReadableText(match) && !match.includes('obj') && !match.includes('endobj')) {
        extractedText += match + ' ';
      }
    }
    
    return extractedText;
  }

  private async extractFromStructure(): Promise<string> {
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const pdfContent = decoder.decode(this.pdfBytes);
    
    let extractedText = '';
    
    // Extract text strings in parentheses
    const textStringRegex = /\(([^)]{5,})\)/g;
    let match;
    
    while ((match = textStringRegex.exec(pdfContent)) !== null) {
      const text = match[1];
      
      if (this.isReadableText(text) && !text.includes('obj')) {
        extractedText += text + ' ';
      }
    }
    
    return extractedText;
  }

  private isReadableText(text: string): boolean {
    if (!text || text.length < 5) return false;
    
    const alphaCount = (text.match(/[a-zA-Z]/g) || []).length;
    const alphaRatio = alphaCount / text.length;
    
    return alphaRatio > 0.6;
  }

  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  }
}

// LangChain-style text splitter
class RecursiveCharacterTextSplitter {
  private chunkSize: number;
  private chunkOverlap: number;

  constructor(options: { chunkSize: number; chunkOverlap: number }) {
    this.chunkSize = options.chunkSize;
    this.chunkOverlap = options.chunkOverlap;
  }

  splitText(text: string): string[] {
    const chunks = [];
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    let currentChunk = '';
    
    for (const paragraph of paragraphs) {
      if ((currentChunk + paragraph).length < this.chunkSize) {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      } else {
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = paragraph;
      }
    }
    
    if (currentChunk) chunks.push(currentChunk);
    
    return chunks;
  }
}

// LangChain-style OpenAI Embeddings
class OpenAIEmbeddings {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const embeddings = [];
    
    for (const text of texts) {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text.substring(0, 8000), // Limit input size
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      embeddings.push(data.data[0].embedding);
    }
    
    return embeddings;
  }

  async embedQuery(text: string): Promise<number[]> {
    const embeddings = await this.embedDocuments([text]);
    return embeddings[0];
  }
}

// LangChain-style Memory Vector Store
class MemoryVectorStore {
  private documents: Array<{ content: string; metadata: any; embedding: number[] }> = [];

  static async fromTexts(
    texts: string[],
    metadatas: any[],
    embeddings: OpenAIEmbeddings
  ): Promise<MemoryVectorStore> {
    const store = new MemoryVectorStore();
    const embeddingVectors = await embeddings.embedDocuments(texts);
    
    for (let i = 0; i < texts.length; i++) {
      store.documents.push({
        content: texts[i],
        metadata: metadatas[i] || {},
        embedding: embeddingVectors[i]
      });
    }
    
    return store;
  }

  async similaritySearch(query: string, k: number, embeddings: OpenAIEmbeddings) {
    const queryEmbedding = await embeddings.embedQuery(query);
    
    const similarities = this.documents.map(doc => ({
      doc,
      similarity: this.cosineSimilarity(queryEmbedding, doc.embedding)
    }));
    
    similarities.sort((a, b) => b.similarity - a.similarity);
    
    return similarities.slice(0, k).map(item => ({
      pageContent: item.doc.content,
      metadata: { ...item.doc.metadata, similarity: item.similarity }
    }));
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }
}

// Enhanced Q&A extraction with LangChain approach
function extractQAPairs(text: string): Array<{
  question: string;
  answer: string;
  confidence: number;
}> {
  const qaPairs = [];
  
  const patterns = [
    {
      regex: /(?:Q(?:uestion)?[:\.]?\s*)?([^?\n]*\?)\s*(?:A(?:nswer)?[:\.]?\s*)?([^Q?\n]*?)(?=(?:Q(?:uestion)?[:\.]?|$|\n\s*\n))/gi,
      confidence: 0.9
    },
    {
      regex: /(\d+[\.\)]\s*[^?]*\?)\s*([^0-9]*?)(?=\d+[\.\)]|$)/gi,
      confidence: 0.8
    },
    {
      regex: /(?:Question|Q):\s*([^A]*?)(?:Answer|A):\s*([^Q]*?)(?=(?:Question|Q):|$)/gi,
      confidence: 0.95
    }
  ];
  
  for (const pattern of patterns) {
    const matches = Array.from(text.matchAll(pattern.regex));
    
    for (const match of matches) {
      const question = (match[1] || '').trim();
      const answer = (match[2] || '').trim();
      
      if (question.length > 5 && question.length < 300 && 
          answer.length > 5 && answer.length < 1000) {
        
        let confidence = pattern.confidence;
        
        if (question.includes('?')) confidence += 0.05;
        if (answer.length > 20) confidence += 0.05;
        if (question.toLowerCase().includes('how') || 
            question.toLowerCase().includes('what') || 
            question.toLowerCase().includes('why')) confidence += 0.05;
        
        qaPairs.push({
          question: question.replace(/^\d+[\.\)]\s*/, ''),
          answer: answer,
          confidence: Math.min(confidence, 1.0)
        });
      }
    }
  }
  
  return qaPairs
    .filter(pair => pair.confidence > 0.7)
    .filter((pair, index, arr) => 
      arr.findIndex(p => 
        p.question.toLowerCase().substring(0, 20) === 
        pair.question.toLowerCase().substring(0, 20)
      ) === index
    )
    .slice(0, 20);
}

function determineCategory(text: string): string {
  const lowerText = text.toLowerCase();
  
  const categories = [
    { keywords: ['login', 'password', 'authentication', 'signin'], category: 'Authentication' },
    { keywords: ['technical', 'error', 'bug', 'system'], category: 'Technical' },
    { keywords: ['billing', 'payment', 'cost', 'price'], category: 'Billing' },
    { keywords: ['support', 'help', 'assistance'], category: 'Support' },
    { keywords: ['account', 'profile', 'settings'], category: 'Account' },
    { keywords: ['feature', 'functionality', 'tool'], category: 'Features' }
  ];
  
  for (const { keywords, category } of categories) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      return category;
    }
  }
  
  return 'General';
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

    const formData = await req.formData();
    const pdfFile = formData.get('pdf') as File;
    const userId = formData.get('userId') as string;

    if (!pdfFile) {
      throw new Error('No PDF file provided');
    }

    console.log(`Processing PDF with LangChain: ${pdfFile.name} (${pdfFile.size} bytes) for user: ${userId}`);

    // Initialize LangChain components
    const embeddings = new OpenAIEmbeddings(openAIApiKey);
    
    // Load PDF using LangChain-style PDFLoader
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdfBytes = new Uint8Array(arrayBuffer);
    const loader = new PDFLoader(pdfBytes);
    
    console.log('Loading PDF with LangChain PDFLoader...');
    const documents = await loader.load();
    
    if (!documents.length || documents[0].pageContent.length < 50) {
      throw new Error('Insufficient text extracted from PDF. The PDF may be image-based or corrupted.');
    }

    console.log(`Extracted ${documents[0].pageContent.length} characters of text`);

    // Split text using LangChain-style text splitter
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 2000,
      chunkOverlap: 200
    });
    
    const chunks = textSplitter.splitText(documents[0].pageContent);
    console.log(`Split text into ${chunks.length} chunks`);

    // Extract Q&A pairs from chunks
    let allQAPairs = [];
    for (const chunk of chunks) {
      const chunkPairs = extractQAPairs(chunk);
      allQAPairs = allQAPairs.concat(chunkPairs);
    }
    
    console.log(`Extracted ${allQAPairs.length} Q&A pairs`);
    
    if (allQAPairs.length === 0) {
      // Use AI to extract Q&A from unstructured text
      console.log('No Q&A pairs found, using AI extraction...');
      
      const aiExtractionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Extract question-answer pairs from the following text. Format each pair as "Q: [question]\\nA: [answer]\\n\\n". Only extract clear, complete Q&A pairs.'
            },
            {
              role: 'user',
              content: documents[0].pageContent.substring(0, 4000)
            }
          ],
          temperature: 0.3,
          max_tokens: 1500
        }),
      });

      if (aiExtractionResponse.ok) {
        const aiData = await aiExtractionResponse.json();
        const aiExtractedText = aiData.choices[0].message.content;
        const aiQAPairs = extractQAPairs(aiExtractedText);
        allQAPairs = allQAPairs.concat(aiQAPairs);
        console.log(`AI extraction added ${aiQAPairs.length} more Q&A pairs`);
      }
    }

    if (allQAPairs.length === 0) {
      throw new Error('No question-answer pairs could be extracted from the PDF content.');
    }

    // Create vector store using LangChain MemoryVectorStore
    const texts = allQAPairs.map(pair => `${pair.question} ${pair.answer}`);
    const metadatas = allQAPairs.map((pair, index) => ({
      question: pair.question,
      answer: pair.answer,
      confidence: pair.confidence,
      index
    }));

    console.log('Creating embeddings and vector store...');
    const vectorStore = await MemoryVectorStore.fromTexts(texts, metadatas, embeddings);
    console.log('Vector store created successfully');

    // Convert to knowledge base format
    const knowledgeChunks = allQAPairs.map(pair => ({
      title: pair.question,
      content: pair.answer,
      category: determineCategory(pair.question + ' ' + pair.answer),
      tags: ['langchain', 'pdf-extracted'],
      confidence: pair.confidence
    }));

    return new Response(
      JSON.stringify({
        success: true,
        chunks: knowledgeChunks,
        message: `Successfully processed PDF with LangChain: extracted ${knowledgeChunks.length} Q&A pairs`,
        extractedTextSample: documents[0].pageContent.substring(0, 500) + '...',
        processingMethod: 'langchain-full-stack',
        vectorStoreSize: texts.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in LangChain PDF processing:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to process PDF with LangChain',
        details: error.stack || 'Please ensure the PDF contains readable text with clear question-answer structure.'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
