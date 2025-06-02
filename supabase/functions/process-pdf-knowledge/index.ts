
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

    // Extract text from PDF
    const extractedText = await extractTextFromPDF(arrayBuffer);
    console.log(`Extracted text length: ${extractedText.length} characters`);
    console.log(`Text sample: ${extractedText.substring(0, 500)}`);
    
    if (extractedText.length < 20) {
      throw new Error('Unable to extract meaningful text from PDF. The PDF may be image-based, encrypted, or in an unsupported format.');
    }
    
    // Create knowledge chunks from extracted text
    const chunks = await createKnowledgeChunks(extractedText);
    console.log(`Created ${chunks.length} knowledge chunks from PDF`);

    if (chunks.length === 0) {
      throw new Error('No questions and answers could be extracted from the PDF content. Please ensure the PDF contains clear Q&A sections.');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        chunks,
        message: `Successfully extracted ${chunks.length} Q&A pairs from PDF`,
        extractedTextSample: extractedText.substring(0, 500) + '...'
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
  console.log('Starting PDF text extraction...');
  
  // Convert to string using different encodings
  const uint8Array = new Uint8Array(arrayBuffer);
  let pdfContent = '';
  
  // Try UTF-8 first, then Latin-1 as fallback
  try {
    pdfContent = new TextDecoder('utf-8').decode(uint8Array);
  } catch {
    pdfContent = new TextDecoder('latin1').decode(uint8Array);
  }
  
  console.log('PDF content length:', pdfContent.length);
  
  // Method 1: Extract from content streams with proper decompression
  let extractedText = await extractFromContentStreams(pdfContent, uint8Array);
  if (extractedText && extractedText.length > 50) {
    console.log('Method 1 (content streams) successful');
    return cleanText(extractedText);
  }
  
  // Method 2: Extract text using simple patterns
  extractedText = extractUsingSimplePatterns(pdfContent);
  if (extractedText && extractedText.length > 50) {
    console.log('Method 2 (simple patterns) successful');
    return cleanText(extractedText);
  }
  
  // Method 3: Extract from text objects
  extractedText = extractFromTextObjects(pdfContent);
  if (extractedText && extractedText.length > 50) {
    console.log('Method 3 (text objects) successful');
    return cleanText(extractedText);
  }
  
  // Method 4: Brute force text extraction
  extractedText = bruteForceTextExtraction(pdfContent);
  if (extractedText && extractedText.length > 20) {
    console.log('Method 4 (brute force) successful');
    return cleanText(extractedText);
  }
  
  throw new Error('All text extraction methods failed. The PDF may be image-based or use unsupported encoding.');
}

async function extractFromContentStreams(pdfContent: string, pdfBytes: Uint8Array): Promise<string> {
  console.log('Extracting from content streams...');
  let extractedText = '';
  
  // Find all stream objects
  const streamRegex = /(\d+)\s+\d+\s+obj[\s\S]*?stream\s*([\s\S]*?)\s*endstream/g;
  let match;
  
  while ((match = streamRegex.exec(pdfContent)) !== null) {
    const streamData = match[2];
    
    // Check if it's a FlateDecode stream
    if (pdfContent.includes('/FlateDecode') || pdfContent.includes('/Fl')) {
      try {
        // Try to decompress the stream
        const decompressed = await attemptDecompression(streamData);
        if (decompressed) {
          const text = extractTextFromDecompressedStream(decompressed);
          if (text) extractedText += text + ' ';
        }
      } catch (error) {
        console.log('Decompression failed for stream:', error.message);
      }
    }
    
    // Also try direct text extraction from stream
    const directText = extractTextFromStream(streamData);
    if (directText) extractedText += directText + ' ';
  }
  
  return extractedText;
}

async function attemptDecompression(streamData: string): Promise<string | null> {
  try {
    // Remove any whitespace and convert to bytes
    const cleanData = streamData.replace(/\s/g, '');
    const bytes = new Uint8Array(cleanData.length);
    
    for (let i = 0; i < cleanData.length; i++) {
      bytes[i] = cleanData.charCodeAt(i);
    }
    
    // Try to decompress using CompressionStream (if available)
    const stream = new CompressionStream('deflate');
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();
    
    writer.write(bytes);
    writer.close();
    
    const chunks = [];
    let done = false;
    
    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) chunks.push(value);
    }
    
    const decompressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
    let offset = 0;
    chunks.forEach(chunk => {
      decompressed.set(chunk, offset);
      offset += chunk.length;
    });
    
    return new TextDecoder().decode(decompressed);
  } catch (error) {
    console.log('Decompression attempt failed:', error.message);
    return null;
  }
}

function extractTextFromDecompressedStream(decompressed: string): string {
  let text = '';
  
  // Look for text showing operators in the decompressed content
  const textPatterns = [
    /\(([^)]+)\)\s*Tj/g,
    /\(([^)]+)\)\s*'/g,
    /\(([^)]+)\)\s*"/g,
    /\[([^\]]+)\]\s*TJ/g,
  ];
  
  for (const pattern of textPatterns) {
    let match;
    while ((match = pattern.exec(decompressed)) !== null) {
      let content = match[1];
      content = content.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t');
      text += content + ' ';
    }
  }
  
  return text;
}

function extractTextFromStream(streamContent: string): string {
  let text = '';
  
  // PDF text showing operators
  const textPatterns = [
    /\(([^)]+)\)\s*Tj/g,
    /\(([^)]+)\)\s*'/g,
    /\(([^)]+)\)\s*"/g,
    /\[([^\]]+)\]\s*TJ/g,
  ];
  
  for (const pattern of textPatterns) {
    let match;
    while ((match = pattern.exec(streamContent)) !== null) {
      let content = match[1];
      // Decode common escape sequences
      content = content
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')')
        .replace(/\\\\/g, '\\');
      
      if (content.length > 1 && /[a-zA-Z]/.test(content)) {
        text += content + ' ';
      }
    }
  }
  
  return text;
}

function extractUsingSimplePatterns(pdfContent: string): string {
  console.log('Using simple pattern extraction...');
  let text = '';
  
  // Look for text within parentheses
  const textPattern = /\(([^)]{2,})\)/g;
  let match;
  
  while ((match = textPattern.exec(pdfContent)) !== null) {
    const content = match[1];
    
    // Filter out obvious non-text content
    if (content.length > 2 && 
        !/^[0-9\s\.\-]+$/.test(content) && 
        /[a-zA-Z]/.test(content) &&
        !content.includes('obj') &&
        !content.includes('endobj')) {
      text += content + ' ';
    }
  }
  
  return text;
}

function extractFromTextObjects(pdfContent: string): string {
  console.log('Extracting from text objects...');
  let text = '';
  
  // Look for BT...ET (BeginText...EndText) blocks
  const textBlockPattern = /BT\s*([\s\S]*?)\s*ET/g;
  let match;
  
  while ((match = textBlockPattern.exec(pdfContent)) !== null) {
    const textBlock = match[1];
    const extractedFromBlock = extractTextFromStream(textBlock);
    if (extractedFromBlock) {
      text += extractedFromBlock + ' ';
    }
  }
  
  return text;
}

function bruteForceTextExtraction(pdfContent: string): string {
  console.log('Using brute force text extraction...');
  let text = '';
  
  // Look for sequences that look like readable text
  const readablePattern = /[A-Za-z][A-Za-z0-9\s\.\?\!,]{10,}/g;
  let match;
  
  while ((match = readablePattern.exec(pdfContent)) !== null) {
    const content = match[0];
    if (isReadableText(content)) {
      text += content + ' ';
    }
  }
  
  return text;
}

function isReadableText(text: string): boolean {
  if (!text || text.length < 10) return false;
  
  // Check for reasonable ratio of readable characters
  const readableChars = text.match(/[a-zA-Z0-9\s\.\,\!\?\:\;\-]/g);
  const readableRatio = readableChars ? readableChars.length / text.length : 0;
  
  // Check for common words
  const commonWords = ['the', 'and', 'or', 'is', 'are', 'was', 'were', 'what', 'how', 'why', 'when', 'where', 'can', 'will', 'would', 'should'];
  const lowerText = text.toLowerCase();
  const hasCommonWords = commonWords.some(word => lowerText.includes(word));
  
  return readableRatio > 0.7 && hasCommonWords;
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n\s*\n/g, '\n\n')
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
  console.log(`Text sample: ${text.substring(0, 300)}...`);
  
  const chunks = [];
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  
  // Enhanced Q&A extraction patterns
  const qaPatterns = [
    {
      name: 'Question: Answer: format',
      regex: /(?:Question|Q):\s*([^A]*?)(?:Answer|A):\s*([^Q]*?)(?=(?:Question|Q):|$)/gi,
      extractQA: (match: RegExpMatchArray) => ({
        question: match[1]?.trim() || '',
        answer: match[2]?.trim() || ''
      })
    },
    {
      name: 'Q. A. format',
      regex: /Q\.\s*([^A]*?)A\.\s*([^Q]*?)(?=Q\.|$)/gi,
      extractQA: (match: RegExpMatchArray) => ({
        question: match[1]?.trim() || '',
        answer: match[2]?.trim() || ''
      })
    },
    {
      name: 'Numbered Q&A',
      regex: /(\d+[\.\)]\s*)(?:Q(?:uestion)?[:\.]?\s*)?([^A\n]*?)(?:A(?:nswer)?[:\.]?\s*)([^0-9\n]*?)(?=\d+[\.\)]|$)/gi,
      extractQA: (match: RegExpMatchArray) => ({
        question: match[2]?.trim() || '',
        answer: match[3]?.trim() || ''
      })
    },
    {
      name: 'FAQ Style with questions ending in ?',
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
          
          if (question.length > 5 && question.length < 200 && isReadableText(question)) {
            const cleanAnswer = answer.length > 500 ? answer.substring(0, 497) + '...' : answer;
            const category = determineCategory(question + ' ' + answer);
            const tags = extractTags(question + ' ' + answer);
            
            chunks.push({
              title: question.length > 100 ? question.substring(0, 97) + '...' : question,
              content: cleanAnswer || 'Please refer to the original document for the complete answer.',
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
  
  // Fallback: create chunks from structured content if no Q&A found
  if (chunks.length === 0) {
    console.log('No Q&A patterns found, trying paragraph-based extraction...');
    
    const paragraphs = normalizedText
      .split(/\n\s*\n/)
      .filter(p => p.trim().length > 50 && isReadableText(p));
    
    for (let i = 0; i < Math.min(paragraphs.length, 5); i++) {
      const paragraph = paragraphs[i].trim();
      if (paragraph.length > 30) {
        // Try to create question from first sentence
        const sentences = paragraph.split(/[.!?]/);
        const firstSentence = sentences[0]?.trim();
        const restOfContent = sentences.slice(1).join('.').trim();
        
        if (firstSentence && restOfContent) {
          chunks.push({
            title: firstSentence.length > 100 ? firstSentence.substring(0, 97) + '...' : firstSentence,
            content: restOfContent,
            category: determineCategory(paragraph),
            tags: extractTags(paragraph)
          });
        }
      }
    }
  }
  
  console.log(`Final result: ${chunks.length} knowledge chunks created`);
  return chunks;
}

function determineCategory(text: string): string {
  const lowerText = text.toLowerCase();
  
  const categories = [
    { keywords: ['login', 'password', 'authentication', 'signin', 'signup', 'access'], category: 'Authentication' },
    { keywords: ['technical', 'error', 'bug', 'system', 'server', 'database'], category: 'Technical' },
    { keywords: ['billing', 'payment', 'cost', 'price', 'invoice', 'subscription'], category: 'Billing' },
    { keywords: ['support', 'help', 'assistance', 'contact', 'service'], category: 'Support' },
    { keywords: ['account', 'profile', 'settings', 'preferences', 'user'], category: 'Account' },
    { keywords: ['feature', 'functionality', 'capability', 'tool'], category: 'Features' },
    { keywords: ['security', 'privacy', 'data', 'protection'], category: 'Security' },
    { keywords: ['installation', 'setup', 'configuration', 'install'], category: 'Setup' }
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
    'faq', 'question', 'answer', 'issue', 'problem', 'solution',
    'security', 'privacy', 'setup', 'installation', 'configuration'
  ];
  
  const lowerText = text.toLowerCase();
  return commonTags.filter(tag => lowerText.includes(tag)).slice(0, 5);
}
