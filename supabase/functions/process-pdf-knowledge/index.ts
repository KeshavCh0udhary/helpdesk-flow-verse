
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

    // Extract text from PDF using improved parsing
    const extractedText = await extractTextFromPDF(arrayBuffer);
    console.log(`Extracted text length: ${extractedText.length} characters`);
    console.log(`First 200 chars: ${extractedText.substring(0, 200)}`); // Debug output
    
    if (extractedText.length < 10) {
      throw new Error('Unable to extract meaningful text from PDF. Please ensure the PDF contains readable text.');
    }
    
    // Split content into logical chunks
    const chunks = await createKnowledgeChunks(extractedText);

    console.log(`Created ${chunks.length} chunks from PDF`);

    if (chunks.length === 0) {
      throw new Error('No knowledge chunks could be created from the PDF content.');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        chunks,
        message: `Successfully processed ${chunks.length} sections from PDF`,
        debugText: extractedText.substring(0, 500) // Include sample for debugging
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing PDF:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to process PDF',
        details: 'Please ensure the PDF contains readable text and is not corrupted.'
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
  
  try {
    // Primary extraction method: Enhanced PDF parsing
    const primaryText = await enhancedPDFExtraction(arrayBuffer);
    if (primaryText && primaryText.length > 50 && isValidText(primaryText)) {
      console.log('Primary extraction successful');
      return primaryText;
    }
  } catch (error) {
    console.log('Primary extraction failed:', error.message);
  }

  try {
    // Secondary extraction method: Pattern-based extraction
    const secondaryText = await patternBasedExtraction(arrayBuffer);
    if (secondaryText && secondaryText.length > 20 && isValidText(secondaryText)) {
      console.log('Secondary extraction successful');
      return secondaryText;
    }
  } catch (error) {
    console.log('Secondary extraction failed:', error.message);
  }

  try {
    // Tertiary extraction method: Simple text search
    const fallbackText = await simpleFallbackExtraction(arrayBuffer);
    if (fallbackText && fallbackText.length > 10 && isValidText(fallbackText)) {
      console.log('Fallback extraction successful');
      return fallbackText;
    }
  } catch (error) {
    console.log('Fallback extraction failed:', error.message);
  }

  throw new Error('Unable to extract readable text from PDF using any method');
}

// Add validation to check if extracted text is actually readable
function isValidText(text: string): boolean {
  if (!text || text.length < 10) return false;
  
  // Check for reasonable ratio of readable characters
  const readableChars = text.match(/[a-zA-Z0-9\s\.\,\!\?\:\;]/g);
  const readableRatio = readableChars ? readableChars.length / text.length : 0;
  
  // Should be at least 70% readable characters
  return readableRatio > 0.7;
}

async function enhancedPDFExtraction(arrayBuffer: ArrayBuffer): Promise<string> {
  const uint8Array = new Uint8Array(arrayBuffer);
  
  // Try UTF-8 first, then fallback to latin1
  let pdfString: string;
  try {
    pdfString = new TextDecoder('utf-8').decode(uint8Array);
  } catch {
    pdfString = new TextDecoder('latin1').decode(uint8Array);
  }
  
  console.log('Enhanced PDF extraction starting...');
  
  // Find all PDF objects
  const objects = extractPDFObjects(pdfString);
  console.log(`Found ${objects.length} PDF objects`);
  
  let extractedText = '';
  
  // Process each object that might contain text
  for (const obj of objects) {
    if (obj.type === 'stream' || obj.content.includes('stream')) {
      try {
        const text = await extractTextFromPDFObject(obj, uint8Array);
        if (text.trim() && isValidText(text)) {
          extractedText += text + ' ';
        }
      } catch (error) {
        console.log(`Failed to extract text from object ${obj.id}:`, error.message);
        continue;
      }
    }
  }
  
  return cleanExtractedText(extractedText);
}

function extractPDFObjects(pdfString: string): Array<{id: string, content: string, type: string}> {
  const objects = [];
  
  // Match PDF objects: "n n obj ... endobj"
  const objectRegex = /(\d+)\s+(\d+)\s+obj([\s\S]*?)endobj/g;
  let match;
  
  while ((match = objectRegex.exec(pdfString)) !== null) {
    const objectId = match[1];
    const content = match[3];
    
    // Determine object type
    let type = 'unknown';
    if (content.includes('/Type /Page')) {
      type = 'page';
    } else if (content.includes('stream')) {
      type = 'stream';
    } else if (content.includes('/Font')) {
      type = 'font';
    }
    
    objects.push({
      id: objectId,
      content: content.trim(),
      type
    });
  }
  
  return objects;
}

async function extractTextFromPDFObject(obj: any, pdfBytes: Uint8Array): Promise<string> {
  // Look for stream content boundaries
  const streamMatch = obj.content.match(/stream\s*([\s\S]*?)\s*endstream/);
  if (!streamMatch) {
    return '';
  }

  // Get the position of the stream in the original binary data
  const streamStartMarker = 'stream';
  const streamEndMarker = 'endstream';
  
  // Try both UTF-8 and latin1 decoding
  let pdfString: string;
  try {
    pdfString = new TextDecoder('utf-8').decode(pdfBytes);
  } catch {
    pdfString = new TextDecoder('latin1').decode(pdfBytes);
  }
  
  const objStart = pdfString.indexOf(obj.content);
  if (objStart === -1) return '';
  
  const streamStart = pdfString.indexOf(streamStartMarker, objStart) + streamStartMarker.length;
  const streamEnd = pdfString.indexOf(streamEndMarker, streamStart);
  
  if (streamStart === -1 || streamEnd === -1) return '';
  
  // Extract raw stream bytes
  const streamBytes = pdfBytes.slice(streamStart, streamEnd);
  
  // Try to decompress if needed
  let streamContent: string;
  if (obj.content.includes('/FlateDecode') || obj.content.includes('/Fl')) {
    try {
      streamContent = await decompressStream(streamBytes);
    } catch (error) {
      console.log('Decompression failed, using raw content');
      // Try both encodings for raw content
      try {
        streamContent = new TextDecoder('utf-8').decode(streamBytes);
      } catch {
        streamContent = new TextDecoder('latin1').decode(streamBytes);
      }
    }
  } else {
    // Try both encodings
    try {
      streamContent = new TextDecoder('utf-8').decode(streamBytes);
    } catch {
      streamContent = new TextDecoder('latin1').decode(streamBytes);
    }
  }
  
  // Extract text from the stream content
  return extractTextFromStreamContent(streamContent);
}

async function decompressStream(streamBytes: Uint8Array): Promise<string> {
  try {
    // Create a readable stream from the bytes
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(streamBytes);
        controller.close();
      }
    });
    
    // Try different decompression methods
    const decompressionMethods = ['deflate', 'gzip'];
    
    for (const method of decompressionMethods) {
      try {
        const decompressed = stream.pipeThrough(new DecompressionStream(method as any));
        const reader = decompressed.getReader();
        
        const chunks: Uint8Array[] = [];
        let done = false;
        
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            chunks.push(value);
          }
        }
        
        // Combine chunks
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        
        for (const chunk of chunks) {
          result.set(chunk, offset);
          offset += chunk.length;
        }
        
        // Try UTF-8 first, then latin1
        try {
          return new TextDecoder('utf-8').decode(result);
        } catch {
          return new TextDecoder('latin1').decode(result);
        }
      } catch (error) {
        console.log(`Decompression with ${method} failed:`, error.message);
        continue;
      }
    }
    
    throw new Error('All decompression methods failed');
  } catch (error) {
    throw new Error(`Decompression failed: ${error.message}`);
  }
}

function extractTextFromStreamContent(streamContent: string): string {
  let text = '';
  
  // Enhanced PDF text operators with better handling
  const textOperators = [
    { pattern: /\(((?:[^()]|\\[()])*)\)\s*Tj/g, name: 'Tj' },           // Show text
    { pattern: /\[((?:[^\[\]]|\\[\[\]])*)\]\s*TJ/g, name: 'TJ' },       // Show text with positioning
    { pattern: /\(((?:[^()]|\\[()])*)\)\s*'/g, name: "'" },             // Move and show text
    { pattern: /\(((?:[^()]|\\[()])*)\)\s*"/g, name: '"' },             // Set spacing and show text
  ];
  
  for (const operator of textOperators) {
    operator.pattern.lastIndex = 0; // Reset regex
    let match;
    
    while ((match = operator.pattern.exec(streamContent)) !== null) {
      let textContent = match[1];
      
      // Better handling of escape sequences and encoding
      textContent = decodeTextContent(textContent);
      
      if (textContent.trim().length > 0 && isValidText(textContent)) {
        text += textContent + ' ';
      }
    }
  }
  
  // Also look for text between BT/ET operators
  const btEtRegex = /BT\s*([\s\S]*?)\s*ET/g;
  let btMatch;
  
  while ((btMatch = btEtRegex.exec(streamContent)) !== null) {
    const textBlock = btMatch[1];
    
    for (const operator of textOperators) {
      operator.pattern.lastIndex = 0;
      let match;
      
      while ((match = operator.pattern.exec(textBlock)) !== null) {
        let textContent = decodeTextContent(match[1]);
        
        if (textContent.trim().length > 0 && isValidText(textContent)) {
          text += textContent + ' ';
        }
      }
    }
  }
  
  return text;
}

function decodeTextContent(content: string): string {
  if (!content) return '';
  
  try {
    // Handle common PDF escape sequences
    return content
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\b/g, '\b')
      .replace(/\\f/g, '\f')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\')
      .replace(/\\(\d{3})/g, (_, octal) => {
        try {
          const charCode = parseInt(octal, 8);
          return charCode > 31 && charCode < 127 ? String.fromCharCode(charCode) : '';
        } catch {
          return '';
        }
      })
      // Handle hex encoding
      .replace(/<([0-9A-Fa-f]+)>/g, (_, hex) => {
        try {
          let result = '';
          for (let i = 0; i < hex.length; i += 2) {
            const charCode = parseInt(hex.substr(i, 2), 16);
            if (charCode > 31 && charCode < 127) {
              result += String.fromCharCode(charCode);
            }
          }
          return result;
        } catch {
          return '';
        }
      });
  } catch (error) {
    console.log('Error decoding text content:', error);
    return content;
  }
}

async function patternBasedExtraction(arrayBuffer: ArrayBuffer): Promise<string> {
  console.log('Using pattern-based extraction...');
  
  const uint8Array = new Uint8Array(arrayBuffer);
  
  // Try both encodings
  let pdfString: string;
  try {
    pdfString = new TextDecoder('utf-8').decode(uint8Array);
  } catch {
    pdfString = new TextDecoder('latin1').decode(uint8Array);
  }
  
  const patterns = [
    /\(((?:[^()]|\\[()])*)\)\s*Tj/g,
    /\(((?:[^()]|\\[()])*)\)\s*'/g,
    /\[((?:[^\[\]]|\\[\[\]])*)\]\s*TJ/g,
    /\/T1_\d+\s+\d+\s+Tf\s*\(((?:[^()]|\\[()])*)\)/g,
  ];
  
  let text = '';
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(pdfString)) !== null) {
      const content = decodeTextContent(match[1]);
      
      if (content.trim().length > 2 && isValidText(content)) {
        text += content + ' ';
      }
    }
  }
  
  return cleanExtractedText(text);
}

async function simpleFallbackExtraction(arrayBuffer: ArrayBuffer): Promise<string> {
  console.log('Using simple fallback extraction...');
  
  const uint8Array = new Uint8Array(arrayBuffer);
  
  // Try both encodings
  let pdfString: string;
  try {
    pdfString = new TextDecoder('utf-8').decode(uint8Array);
  } catch {
    pdfString = new TextDecoder('latin1').decode(uint8Array);
  }
  
  // Very simple pattern matching for text within parentheses
  const simplePattern = /\(([^)]+)\)/g;
  let text = '';
  let match;
  
  while ((match = simplePattern.exec(pdfString)) !== null) {
    const content = decodeTextContent(match[1]);
    if (content.length > 3 && /[a-zA-Z]/.test(content) && isValidText(content)) {
      text += content + ' ';
    }
  }
  
  return cleanExtractedText(text);
}

function cleanExtractedText(text: string): string {
  if (!text) return '';
  
  return text
    .replace(/\s+/g, ' ')                    // Normalize whitespace
    .replace(/([.!?])\s*([A-Z])/g, '$1\n$2') // Add line breaks after sentences
    .replace(/(\d+\.)\s*([A-Z])/g, '$1\n$2') // Add line breaks after numbered items
    .replace(/[^\w\s\?\.\,\!\:\;\-\(\)'"]/g, ' ') // Replace non-printable characters with spaces
    .replace(/\s+/g, ' ')                    // Normalize whitespace again
    .trim();
}

async function createKnowledgeChunks(text: string): Promise<Array<{
  title: string;
  content: string;
  category: string;
  tags: string[];
}>> {
  const chunks = [];
  
  if (!text || text.trim().length === 0) {
    console.log('No text to process');
    return chunks;
  }
  
  // Validate that the text is readable before processing
  if (!isValidText(text)) {
    console.log('Text appears to be corrupted or unreadable');
    throw new Error('Extracted text appears to be corrupted. The PDF may contain non-text content or use unsupported encoding.');
  }
  
  console.log(`Processing text of length: ${text.length}`);
  
  // Normalize the text
  const normalizedText = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Enhanced Q&A patterns
  const patterns = [
    {
      regex: /(\d+)[\.\)]\s*Q\s*[:.]?\s*([^A]*?)A\s*[:.]?\s*([^0-9Q]*?)(?=\d+[\.\)]|$)/gi,
      type: 'numbered_qa'
    },
    {
      regex: /(\d+)[\.\)]\s*([^0-9]*?)(?=\d+[\.\)]|$)/gi,
      type: 'numbered'
    },
    {
      regex: /Q\s*[:.]?\s*([^A]*?)A\s*[:.]?\s*([^Q]*?)(?=Q\s*[:.]|$)/gi,
      type: 'qa_format'
    },
    {
      regex: /Question\s*[:.]?\s*([^A]*?)Answer\s*[:.]?\s*([^Q]*?)(?=Question|$)/gi,
      type: 'question_answer'
    },
    {
      regex: /([^.!?]*\?)\s*([^?]*?)(?=[^.!?]*\?|$)/gi,
      type: 'question_mark'
    }
  ];
  
  for (const pattern of patterns) {
    const matches = Array.from(normalizedText.matchAll(pattern.regex));
    console.log(`Pattern ${pattern.type}: found ${matches.length} matches`);
    
    if (matches.length > 0) {
      for (const match of matches) {
        let question = '';
        let answer = '';
        
        if (pattern.type === 'numbered_qa') {
          question = match[2]?.trim() || '';
          answer = match[3]?.trim() || '';
        } else if (pattern.type === 'numbered') {
          const content = match[2]?.trim() || '';
          const answerSplit = content.split(/(?:Answer|A\s*[:.]|answer\s*[:.])/i);
          if (answerSplit.length > 1) {
            question = answerSplit[0].trim();
            answer = answerSplit[1].trim();
          } else {
            question = content;
            answer = 'Please refer to the original document for the complete answer.';
          }
        } else if (pattern.type === 'qa_format' || pattern.type === 'question_answer') {
          question = match[1]?.trim() || '';
          answer = match[2]?.trim() || '';
        } else if (pattern.type === 'question_mark') {
          question = match[1]?.trim() || '';
          answer = match[2]?.trim() || 'Please refer to the original document for the answer.';
        }
        
        // Clean up question and answer
        question = cleanText(question);
        answer = cleanText(answer);
        
        // Only add if we have meaningful content and it's readable
        if (question.length > 10 && isValidText(question)) {
          const category = determineCategory(question + ' ' + answer);
          const tags = extractTags(question + ' ' + answer);
          
          chunks.push({
            title: question.length > 100 ? question.substring(0, 97) + '...' : question,
            content: answer || 'Please refer to the original document for the complete answer.',
            category,
            tags
          });
        }
      }
      
      // If we found good matches with this pattern, use them
      if (chunks.length > 0) {
        console.log(`Using pattern ${pattern.type} as primary extraction method`);
        break;
      }
    }
  }
  
  // Fallback: split by paragraphs if no Q&A patterns found
  if (chunks.length === 0) {
    console.log('No Q&A patterns found, splitting by paragraphs...');
    
    const paragraphs = normalizedText
      .split(/\n\s*\n/)
      .filter(p => p.trim().length > 50 && isValidText(p.trim()));
    
    for (let i = 0; i < Math.min(paragraphs.length, 10); i++) {
      const paragraph = cleanText(paragraphs[i]);
      if (paragraph.length > 20 && isValidText(paragraph)) {
        const category = determineCategory(paragraph);
        const tags = extractTags(paragraph);
        
        chunks.push({
          title: `Section ${i + 1}: ${paragraph.substring(0, 80)}${paragraph.length > 80 ? '...' : ''}`,
          content: paragraph,
          category,
          tags
        });
      }
    }
  }
  
  console.log(`Final result: Created ${chunks.length} chunks from extracted text`);
  return chunks;
}

function cleanText(text: string): string {
  if (!text) return '';
  
  return text
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s\?\.\,\!\:\;\-\(\)'"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function determineCategory(text: string): string {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('login') || lowerText.includes('browser') || lowerText.includes('password') || lowerText.includes('technical') || lowerText.includes('error')) {
    return 'Technical';
  } else if (lowerText.includes('ticket') || lowerText.includes('request') || lowerText.includes('status') || lowerText.includes('faq')) {
    return 'FAQ';
  } else if (lowerText.includes('billing') || lowerText.includes('payment') || lowerText.includes('cost')) {
    return 'Billing';
  } else if (lowerText.includes('troubleshoot') || lowerText.includes('problem') || lowerText.includes('issue')) {
    return 'Troubleshooting';
  }
  
  return 'General';
}

function extractTags(text: string): string[] {
  const commonTags = [
    'login', 'error', 'browser', 'troubleshooting', 'ticket', 'status', 
    'system', 'purpose', 'sso', 'authentication', 'cache', 'workflow',
    'management', 'tracking', 'chrome', 'firefox', 'safari', 'edge',
    'password', 'help', 'support', 'access', 'process', 'guide',
    'instructions', 'technical', 'issue', 'billing', 'payment',
    'request', 'resolution', 'account', 'user', 'admin'
  ];
  
  const lowerText = text.toLowerCase();
  return commonTags.filter(tag => lowerText.includes(tag));
}
