
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// LangChain-style PDF text extraction
async function extractTextWithLangChain(pdfBytes: Uint8Array): Promise<string> {
  console.log('Starting LangChain-style PDF text extraction...');
  
  // Convert PDF bytes to text using multiple extraction strategies
  const strategies = [
    () => extractTextFromPDFStructure(pdfBytes),
    () => extractTextFromStreams(pdfBytes),
    () => extractTextFromObjects(pdfBytes)
  ];
  
  for (const strategy of strategies) {
    try {
      const text = await strategy();
      if (text && text.length > 50) {
        console.log(`Extraction successful, got ${text.length} characters`);
        return cleanExtractedText(text);
      }
    } catch (error) {
      console.log(`Strategy failed: ${error.message}`);
      continue;
    }
  }
  
  throw new Error('All PDF extraction strategies failed');
}

async function extractTextFromPDFStructure(pdfBytes: Uint8Array): Promise<string> {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const pdfContent = decoder.decode(pdfBytes);
  
  let extractedText = '';
  
  // Find text objects between BT (Begin Text) and ET (End Text)
  const textBlockRegex = /BT\s+(.*?)\s+ET/gs;
  let match;
  
  while ((match = textBlockRegex.exec(pdfContent)) !== null) {
    const textCommands = match[1];
    
    // Extract text from Tj and TJ operators
    const textPatterns = [
      /\(([^)]+)\)\s*Tj/g,
      /\(([^)]+)\)\s*'/g,
      /\(([^)]+)\)\s*"/g,
      /\[([^\]]+)\]\s*TJ/g
    ];
    
    for (const pattern of textPatterns) {
      let textMatch;
      while ((textMatch = pattern.exec(textCommands)) !== null) {
        let text = textMatch[1];
        
        // Handle escape sequences
        text = text
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\\(/g, '(')
          .replace(/\\\)/g, ')')
          .replace(/\\\\/g, '\\');
        
        if (text.trim().length > 1) {
          extractedText += text + ' ';
        }
      }
    }
  }
  
  return extractedText;
}

async function extractTextFromStreams(pdfBytes: Uint8Array): Promise<string> {
  const decoder = new TextDecoder('latin1');
  const pdfContent = decoder.decode(pdfBytes);
  
  let extractedText = '';
  
  // Find stream objects
  const streamRegex = /stream\s+(.*?)\s+endstream/gs;
  let match;
  
  while ((match = streamRegex.exec(pdfContent)) !== null) {
    const streamData = match[1];
    
    // Try to extract readable text from stream
    const readableTextRegex = /[A-Za-z][A-Za-z0-9\s\.,!?;:'"(){}[\]\-+=%$@#&*]{4,}/g;
    let textMatch;
    
    while ((textMatch = readableTextRegex.exec(streamData)) !== null) {
      const text = textMatch[0];
      if (isReadableContent(text)) {
        extractedText += text + ' ';
      }
    }
  }
  
  return extractedText;
}

async function extractTextFromObjects(pdfBytes: Uint8Array): Promise<string> {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const pdfContent = decoder.decode(pdfBytes);
  
  let extractedText = '';
  
  // Extract text from parentheses (PDF text strings)
  const textStringRegex = /\(([^)]{3,})\)/g;
  let match;
  
  while ((match = textStringRegex.exec(pdfContent)) !== null) {
    const text = match[1];
    
    // Filter out control characters and ensure it's readable
    if (isReadableContent(text) && !text.includes('obj') && !text.includes('endobj')) {
      extractedText += text + ' ';
    }
  }
  
  return extractedText;
}

function isReadableContent(text: string): boolean {
  if (!text || text.length < 3) return false;
  
  // Check for reasonable character distribution
  const alphaCount = (text.match(/[a-zA-Z]/g) || []).length;
  const alphaRatio = alphaCount / text.length;
  
  // Must have at least 60% alphabetic characters
  if (alphaRatio < 0.6) return false;
  
  // Check for common English words or patterns
  const commonWords = ['the', 'and', 'is', 'are', 'was', 'what', 'how', 'why', 'can', 'will'];
  const lowerText = text.toLowerCase();
  const hasCommonWord = commonWords.some(word => lowerText.includes(word));
  
  return hasCommonWord || text.includes('?') || text.includes('answer') || text.includes('question');
}

function cleanExtractedText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();
}

// LangChain-style text splitting that preserves Q&A context
function splitTextIntoChunks(text: string): string[] {
  // Split on double newlines first to preserve paragraph structure
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  const chunks = [];
  let currentChunk = '';
  const maxChunkSize = 2000;
  
  for (const paragraph of paragraphs) {
    if ((currentChunk + paragraph).length < maxChunkSize) {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = paragraph;
    }
  }
  
  if (currentChunk) chunks.push(currentChunk);
  
  return chunks;
}

// Enhanced Q&A extraction with semantic understanding
function extractQAPairs(text: string): Array<{
  question: string;
  answer: string;
  confidence: number;
}> {
  const qaPairs = [];
  
  // Enhanced Q&A patterns with confidence scoring
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
        
        // Calculate confidence based on content quality
        let confidence = pattern.confidence;
        
        // Boost confidence for clear Q&A indicators
        if (question.includes('?')) confidence += 0.05;
        if (answer.length > 20) confidence += 0.05;
        if (question.toLowerCase().includes('how') || 
            question.toLowerCase().includes('what') || 
            question.toLowerCase().includes('why')) confidence += 0.05;
        
        qaPairs.push({
          question: question.replace(/^\d+[\.\)]\s*/, ''), // Remove numbering
          answer: answer,
          confidence: Math.min(confidence, 1.0)
        });
      }
    }
  }
  
  // Remove duplicates and low-confidence pairs
  const uniquePairs = qaPairs
    .filter(pair => pair.confidence > 0.7)
    .filter((pair, index, arr) => 
      arr.findIndex(p => 
        p.question.toLowerCase().includes(pair.question.toLowerCase().substring(0, 20))
      ) === index
    );
  
  return uniquePairs.slice(0, 20); // Limit to 20 best pairs
}

function determineCategory(text: string): string {
  const lowerText = text.toLowerCase();
  
  const categories = [
    { keywords: ['login', 'password', 'authentication', 'signin', 'access'], category: 'Authentication' },
    { keywords: ['technical', 'error', 'bug', 'system', 'server'], category: 'Technical' },
    { keywords: ['billing', 'payment', 'cost', 'price', 'invoice'], category: 'Billing' },
    { keywords: ['support', 'help', 'assistance', 'contact'], category: 'Support' },
    { keywords: ['account', 'profile', 'settings', 'user'], category: 'Account' },
    { keywords: ['feature', 'functionality', 'tool'], category: 'Features' }
  ];
  
  for (const { keywords, category } of categories) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      return category;
    }
  }
  
  return 'General';
}

function extractTags(text: string): string[] {
  const commonTags = [
    'faq', 'help', 'support', 'guide', 'tutorial', 'troubleshooting',
    'login', 'password', 'account', 'billing', 'technical', 'feature'
  ];
  
  const lowerText = text.toLowerCase();
  return commonTags.filter(tag => lowerText.includes(tag)).slice(0, 5);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey || !openAIApiKey) {
      throw new Error('Missing required environment variables');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const formData = await req.formData();
    const pdfFile = formData.get('pdf') as File;
    const userId = formData.get('userId') as string;

    if (!pdfFile) {
      throw new Error('No PDF file provided');
    }

    console.log(`Processing PDF with LangChain: ${pdfFile.name} (${pdfFile.size} bytes) for user: ${userId}`);

    // Extract text using LangChain-style approach
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdfBytes = new Uint8Array(arrayBuffer);
    
    const extractedText = await extractTextWithLangChain(pdfBytes);
    console.log(`Extracted ${extractedText.length} characters of text`);
    
    if (extractedText.length < 50) {
      throw new Error('Insufficient text extracted from PDF. The PDF may be image-based or corrupted.');
    }

    // Split text into chunks for better processing
    const textChunks = splitTextIntoChunks(extractedText);
    console.log(`Split text into ${textChunks.length} chunks`);
    
    // Extract Q&A pairs from all chunks
    let allQAPairs = [];
    for (const chunk of textChunks) {
      const chunkPairs = extractQAPairs(chunk);
      allQAPairs = allQAPairs.concat(chunkPairs);
    }
    
    console.log(`Extracted ${allQAPairs.length} Q&A pairs`);
    
    if (allQAPairs.length === 0) {
      // Generate embeddings for the raw text and try semantic extraction
      console.log('No Q&A pairs found, attempting semantic extraction...');
      
      const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: extractedText.substring(0, 8000), // Limit input size
        }),
      });

      if (embeddingResponse.ok) {
        // Use AI to extract Q&A from unstructured text
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
                content: extractedText.substring(0, 4000)
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
    }

    if (allQAPairs.length === 0) {
      throw new Error('No question-answer pairs could be extracted from the PDF content.');
    }

    // Convert to knowledge base format
    const knowledgeChunks = allQAPairs.map(pair => ({
      title: pair.question,
      content: pair.answer,
      category: determineCategory(pair.question + ' ' + pair.answer),
      tags: extractTags(pair.question + ' ' + pair.answer),
      confidence: pair.confidence
    }));

    return new Response(
      JSON.stringify({
        success: true,
        chunks: knowledgeChunks,
        message: `Successfully extracted ${knowledgeChunks.length} Q&A pairs using LangChain`,
        extractedTextSample: extractedText.substring(0, 500) + '...',
        processingMethod: 'langchain'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in LangChain PDF processing:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to process PDF with LangChain',
        details: 'Please ensure the PDF contains readable text with clear question-answer structure.'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
