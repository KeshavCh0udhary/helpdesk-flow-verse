
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const pdfFile = formData.get('pdf') as File;
    const userId = formData.get('userId') as string;

    if (!pdfFile) {
      throw new Error('No PDF file provided');
    }

    console.log(`Processing PDF: ${pdfFile.name} for user: ${userId}`);

    // Convert PDF file to array buffer for processing
    const arrayBuffer = await pdfFile.arrayBuffer();
    console.log(`PDF file size: ${arrayBuffer.byteLength} bytes`);

    // Extract text from PDF using multiple methods
    const extractedText = await extractTextFromPDF(arrayBuffer);
    console.log(`Extracted text length: ${extractedText.length} characters`);
    
    if (extractedText.length < 20) {
      throw new Error('Unable to extract meaningful text from PDF. The PDF may be image-based or encrypted.');
    }
    
    // Create knowledge chunks from extracted text
    const chunks = await createKnowledgeChunks(extractedText);
    console.log(`Created ${chunks.length} knowledge chunks from PDF`);

    if (chunks.length === 0) {
      throw new Error('No questions and answers could be extracted from the PDF content.');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        chunks,
        message: `Successfully extracted ${chunks.length} Q&A pairs from PDF`,
        extractedTextSample: extractedText.substring(0, 300) + '...'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing PDF:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to process PDF',
        details: 'Please ensure the PDF contains readable text in Q&A format.'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function extractTextFromPDF(arrayBuffer: ArrayBuffer): Promise<string> {
  console.log('Starting comprehensive PDF text extraction...');
  
  // Convert to Uint8Array for processing
  const uint8Array = new Uint8Array(arrayBuffer);
  
  // Try multiple text extraction approaches
  const extractionMethods = [
    () => extractUsingAdvancedParsing(uint8Array),
    () => extractUsingSimplePatterns(uint8Array),
    () => extractUsingRawTextSearch(uint8Array),
    () => extractUsingStreamAnalysis(uint8Array)
  ];

  for (let i = 0; i < extractionMethods.length; i++) {
    try {
      console.log(`Attempting extraction method ${i + 1}...`);
      const text = await extractionMethods[i]();
      
      if (text && text.length > 50 && isReadableText(text)) {
        console.log(`Method ${i + 1} successful - extracted ${text.length} characters`);
        console.log(`Sample: ${text.substring(0, 200)}...`);
        return cleanAndNormalizeText(text);
      }
    } catch (error) {
      console.log(`Method ${i + 1} failed:`, error.message);
      continue;
    }
  }

  throw new Error('All text extraction methods failed');
}

function isReadableText(text: string): boolean {
  if (!text || text.length < 20) return false;
  
  // Check for reasonable ratio of readable characters
  const readableChars = text.match(/[a-zA-Z0-9\s\.\,\!\?\:\;\-]/g);
  const readableRatio = readableChars ? readableChars.length / text.length : 0;
  
  // Check for common words to validate it's actual text
  const commonWords = ['the', 'and', 'or', 'is', 'are', 'was', 'were', 'what', 'how', 'why', 'when', 'where'];
  const lowerText = text.toLowerCase();
  const hasCommonWords = commonWords.some(word => lowerText.includes(word));
  
  return readableRatio > 0.6 && hasCommonWords;
}

async function extractUsingAdvancedParsing(uint8Array: Uint8Array): Promise<string> {
  console.log('Using advanced PDF parsing...');
  
  // Try different text decoders
  const decoders = [
    { name: 'UTF-8', decoder: new TextDecoder('utf-8') },
    { name: 'Latin1', decoder: new TextDecoder('latin1') },
    { name: 'UTF-16', decoder: new TextDecoder('utf-16') }
  ];
  
  for (const { name, decoder } of decoders) {
    try {
      const pdfString = decoder.decode(uint8Array);
      console.log(`Trying ${name} decoding...`);
      
      // Find and extract content streams
      const text = await extractFromContentStreams(pdfString, uint8Array);
      if (text && isReadableText(text)) {
        console.log(`${name} decoding successful`);
        return text;
      }
    } catch (error) {
      console.log(`${name} decoding failed:`, error.message);
      continue;
    }
  }
  
  throw new Error('Advanced parsing failed with all decoders');
}

async function extractFromContentStreams(pdfString: string, pdfBytes: Uint8Array): Promise<string> {
  let extractedText = '';
  
  // Find all stream objects that might contain text
  const streamRegex = /(\d+)\s+(\d+)\s+obj[\s\S]*?stream\s*([\s\S]*?)\s*endstream/g;
  let match;
  
  while ((match = streamRegex.exec(pdfString)) !== null) {
    try {
      const streamContent = match[3];
      
      // Try to extract text from this stream
      const text = extractTextFromStream(streamContent);
      if (text && isReadableText(text)) {
        extractedText += text + ' ';
      }
    } catch (error) {
      console.log('Stream processing error:', error.message);
      continue;
    }
  }
  
  return extractedText;
}

function extractTextFromStream(streamContent: string): string {
  let text = '';
  
  // PDF text showing operators
  const textPatterns = [
    /\(([^)]+)\)\s*Tj/g,      // Simple text showing
    /\(([^)]+)\)\s*'/g,       // Move to next line and show text
    /\(([^)]+)\)\s*"/g,       // Set word and character spacing and show text
    /\[([^\]]+)\]\s*TJ/g,     // Show text with individual glyph positioning
  ];
  
  for (const pattern of textPatterns) {
    let match;
    pattern.lastIndex = 0;
    
    while ((match = pattern.exec(streamContent)) !== null) {
      let textContent = match[1];
      
      // Decode escaped characters
      textContent = textContent
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')')
        .replace(/\\\\/g, '\\');
      
      if (textContent.trim().length > 1) {
        text += textContent + ' ';
      }
    }
  }
  
  return text;
}

async function extractUsingSimplePatterns(uint8Array: Uint8Array): Promise<string> {
  console.log('Using simple pattern extraction...');
  
  const pdfString = new TextDecoder('latin1').decode(uint8Array);
  let text = '';
  
  // Look for text within parentheses (common PDF text format)
  const simpleTextPattern = /\(([^)]{3,})\)/g;
  let match;
  
  while ((match = simpleTextPattern.exec(pdfString)) !== null) {
    const content = match[1];
    
    // Filter out obvious non-text content
    if (content.length > 2 && 
        !/^[0-9\s\.\-]+$/.test(content) && 
        /[a-zA-Z]/.test(content)) {
      text += content + ' ';
    }
  }
  
  return text;
}

async function extractUsingRawTextSearch(uint8Array: Uint8Array): Promise<string> {
  console.log('Using raw text search...');
  
  const pdfString = new TextDecoder('latin1').decode(uint8Array);
  let text = '';
  
  // Look for readable text sequences
  const wordPattern = /[A-Za-z]{3,}(?:\s+[A-Za-z0-9\.\?\!,]{1,}){2,}/g;
  let match;
  
  while ((match = wordPattern.exec(pdfString)) !== null) {
    const content = match[0];
    if (content.length > 10 && isReadableText(content)) {
      text += content + ' ';
    }
  }
  
  return text;
}

async function extractUsingStreamAnalysis(uint8Array: Uint8Array): Promise<string> {
  console.log('Using stream analysis...');
  
  const pdfString = new TextDecoder('utf-8', { fatal: false }).decode(uint8Array);
  let text = '';
  
  // Look for BT...ET (BeginText...EndText) blocks
  const textBlockPattern = /BT\s*([\s\S]*?)\s*ET/g;
  let match;
  
  while ((match = textBlockPattern.exec(pdfString)) !== null) {
    const textBlock = match[1];
    
    // Extract text from within the text block
    const extractedFromBlock = extractTextFromStream(textBlock);
    if (extractedFromBlock && isReadableText(extractedFromBlock)) {
      text += extractedFromBlock + ' ';
    }
  }
  
  return text;
}

function cleanAndNormalizeText(text: string): string {
  return text
    .replace(/\s+/g, ' ')                    // Normalize whitespace
    .replace(/\r\n/g, '\n')                  // Normalize line endings
    .replace(/\r/g, '\n')                    // Convert remaining \r to \n
    .replace(/\n\s*\n/g, '\n\n')            // Clean up multiple newlines
    .trim();
}

async function createKnowledgeChunks(text: string): Promise<Array<{
  title: string;
  content: string;
  category: string;
  tags: string[];
}>> {
  console.log('Creating knowledge chunks from extracted text...');
  
  if (!text || text.trim().length === 0) {
    throw new Error('No text available for processing');
  }
  
  console.log(`Processing ${text.length} characters of text`);
  console.log(`Text sample: ${text.substring(0, 200)}...`);
  
  const chunks = [];
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  
  // Enhanced Q&A extraction patterns
  const qaPatterns = [
    {
      name: 'Numbered Q&A',
      regex: /(\d+[\.\)]\s*)(?:Q(?:uestion)?[:\.]?\s*)?([^A\n]*?)(?:A(?:nswer)?[:\.]?\s*)([^0-9\n]*?)(?=\d+[\.\)]|$)/gi,
      extractQA: (match: RegExpMatchArray) => ({
        question: match[2]?.trim() || '',
        answer: match[3]?.trim() || ''
      })
    },
    {
      name: 'Q: A: Format',
      regex: /Q[:\.]?\s*([^A\n]*?)A[:\.]?\s*([^Q\n]*?)(?=Q[:\.]|$)/gi,
      extractQA: (match: RegExpMatchArray) => ({
        question: match[1]?.trim() || '',
        answer: match[2]?.trim() || ''
      })
    },
    {
      name: 'Question Answer Format',
      regex: /(?:Question|Q)[:\.]?\s*([^A\n]*?)(?:Answer|A)[:\.]?\s*([^\n]*?)(?=(?:Question|Q)[:\.]|$)/gi,
      extractQA: (match: RegExpMatchArray) => ({
        question: match[1]?.trim() || '',
        answer: match[2]?.trim() || ''
      })
    },
    {
      name: 'FAQ Style',
      regex: /([^?\n]*\?)\s*([^?\n]*?)(?=[^?\n]*\?|$)/gi,
      extractQA: (match: RegExpMatchArray) => ({
        question: match[1]?.trim() || '',
        answer: match[2]?.trim() || ''
      })
    }
  ];
  
  // Try each pattern to extract Q&A pairs
  for (const pattern of qaPatterns) {
    console.log(`Trying pattern: ${pattern.name}`);
    const matches = Array.from(normalizedText.matchAll(pattern.regex));
    console.log(`Found ${matches.length} matches with ${pattern.name}`);
    
    if (matches.length > 0) {
      for (const match of matches) {
        try {
          const { question, answer } = pattern.extractQA(match);
          
          if (question.length > 5 && isReadableText(question)) {
            const category = determineCategory(question + ' ' + answer);
            const tags = extractTags(question + ' ' + answer);
            
            chunks.push({
              title: question.length > 100 ? question.substring(0, 97) + '...' : question,
              content: answer || 'Please refer to the original document for the complete answer.',
              category,
              tags
            });
          }
        } catch (error) {
          console.log('Error processing match:', error.message);
          continue;
        }
      }
      
      if (chunks.length > 0) {
        console.log(`Successfully extracted ${chunks.length} Q&A pairs using ${pattern.name}`);
        break;
      }
    }
  }
  
  // Fallback: create chunks from paragraphs if no Q&A found
  if (chunks.length === 0) {
    console.log('No Q&A patterns found, creating chunks from paragraphs...');
    
    const paragraphs = normalizedText
      .split(/\n\s*\n/)
      .filter(p => p.trim().length > 30 && isReadableText(p));
    
    for (let i = 0; i < Math.min(paragraphs.length, 5); i++) {
      const paragraph = paragraphs[i].trim();
      if (paragraph.length > 20) {
        chunks.push({
          title: `Content Section ${i + 1}`,
          content: paragraph,
          category: determineCategory(paragraph),
          tags: extractTags(paragraph)
        });
      }
    }
  }
  
  console.log(`Final result: ${chunks.length} knowledge chunks created`);
  return chunks;
}

function determineCategory(text: string): string {
  const lowerText = text.toLowerCase();
  
  const categories = [
    { keywords: ['login', 'password', 'authentication', 'signin', 'signup'], category: 'Authentication' },
    { keywords: ['technical', 'error', 'bug', 'system', 'server'], category: 'Technical' },
    { keywords: ['billing', 'payment', 'cost', 'price', 'invoice'], category: 'Billing' },
    { keywords: ['support', 'help', 'assistance', 'contact'], category: 'Support' },
    { keywords: ['account', 'profile', 'settings', 'preferences'], category: 'Account' },
    { keywords: ['feature', 'functionality', 'capability'], category: 'Features' }
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
    'login', 'password', 'authentication', 'error', 'troubleshooting',
    'billing', 'payment', 'support', 'help', 'account', 'settings',
    'technical', 'system', 'feature', 'guide', 'instructions',
    'faq', 'question', 'answer', 'issue', 'problem', 'solution'
  ];
  
  const lowerText = text.toLowerCase();
  return commonTags.filter(tag => lowerText.includes(tag)).slice(0, 5);
}
