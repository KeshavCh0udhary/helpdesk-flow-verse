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

    // Extract text from PDF using proper PDF parsing
    const extractedText = await extractTextFromPDF(arrayBuffer);
    console.log(`Extracted text length: ${extractedText.length} characters`);
    console.log(`Extracted text preview: ${extractedText.substring(0, 500)}...`);
    
    // Split content into logical chunks
    const chunks = await createKnowledgeChunks(extractedText);

    console.log(`Created ${chunks.length} chunks from PDF`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        chunks,
        message: `Successfully processed ${chunks.length} sections from PDF`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing PDF:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function extractTextFromPDF(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const uint8Array = new Uint8Array(arrayBuffer);
    const pdfString = new TextDecoder('latin1').decode(uint8Array);
    
    console.log('Starting proper PDF text extraction...');
    
    // Extract all PDF objects first
    const objects = extractPDFObjects(pdfString);
    console.log(`Found ${objects.length} PDF objects`);
    
    // Find and extract text from content streams
    let extractedText = '';
    for (const obj of objects) {
      const text = await extractTextFromObject(obj, pdfString);
      if (text.trim()) {
        extractedText += text + '\n';
      }
    }
    
    // Clean up the extracted text
    extractedText = cleanExtractedText(extractedText);
    
    console.log(`Final extracted text length: ${extractedText.length} characters`);
    return extractedText;
    
  } catch (error) {
    console.error('Error in PDF text extraction:', error);
    // Fallback to basic extraction if advanced parsing fails
    return fallbackTextExtraction(arrayBuffer);
  }
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

async function extractTextFromObject(obj: any, pdfString: string): Promise<string> {
  if (obj.type !== 'stream' && obj.type !== 'page') {
    return '';
  }
  
  // Look for stream content
  const streamMatch = obj.content.match(/stream\s*([\s\S]*?)\s*endstream/);
  if (!streamMatch) {
    return '';
  }
  
  let streamData = streamMatch[1];
  
  // Check for FlateDecode filter (most common compression)
  if (obj.content.includes('/FlateDecode') || obj.content.includes('/Fl')) {
    try {
      streamData = await decompressFlateDecode(streamData);
    } catch (e) {
      console.log('Failed to decompress stream, trying raw extraction');
    }
  }
  
  // Extract text from the (possibly decompressed) stream
  return extractTextFromStream(streamData);
}

async function decompressFlateDecode(compressedData: string): Promise<string> {
  try {
    // Convert the compressed string to Uint8Array
    const bytes = new Uint8Array(compressedData.length);
    for (let i = 0; i < compressedData.length; i++) {
      bytes[i] = compressedData.charCodeAt(i);
    }
    
    // Use native compression API (zlib/deflate)
    const decompressed = new DecompressionStream('deflate');
    const writer = decompressed.writable.getWriter();
    const reader = decompressed.readable.getReader();
    
    writer.write(bytes);
    writer.close();
    
    const chunks = [];
    let done = false;
    
    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        chunks.push(value);
      }
    }
    
    // Combine all chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    
    return new TextDecoder('latin1').decode(result);
  } catch (error) {
    console.error('Decompression failed:', error);
    throw error;
  }
}

function extractTextFromStream(streamContent: string): string {
  let text = '';
  
  // PDF text operators to look for
  const textOperators = [
    /\((.*?)\)\s*Tj/g,           // Show text
    /\[(.*?)\]\s*TJ/g,           // Show text with individual glyph positioning
    /\((.*?)\)\s*'/g,            // Move to next line and show text
    /\((.*?)\)\s*"/g,            // Set word and character spacing, move to next line and show text
  ];
  
  for (const operator of textOperators) {
    let match;
    operator.lastIndex = 0; // Reset regex
    
    while ((match = operator.exec(streamContent)) !== null) {
      let textContent = match[1];
      
      // Handle escape sequences - FIXED REGEX PATTERNS
      textContent = textContent
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\b/g, '\b')
        .replace(/\\f/g, '\f')
        .replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')')
        .replace(/\\\\/g, '\\')
        .replace(/\\(\d{3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)));
      
      if (textContent.trim().length > 0) {
        text += textContent + ' ';
      }
    }
  }
  
  // Look for text between BT (Begin Text) and ET (End Text) operators
  const btEtRegex = /BT\s*([\s\S]*?)\s*ET/g;
  let btMatch;
  
  while ((btMatch = btEtRegex.exec(streamContent)) !== null) {
    const textBlock = btMatch[1];
    
    // Extract text from this block
    const blockTextOperators = [
      /\((.*?)\)\s*Tj/g,
      /\[(.*?)\]\s*TJ/g,
    ];
    
    for (const operator of blockTextOperators) {
      let match;
      operator.lastIndex = 0;
      
      while ((match = operator.exec(textBlock)) !== null) {
        let textContent = match[1];
        textContent = textContent
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\(.)/g, '$1');
        
        if (textContent.trim().length > 0) {
          text += textContent + ' ';
        }
      }
    }
  }
  
  return text;
}

function cleanExtractedText(text: string): string {
  return text
    .replace(/\s+/g, ' ')                    // Normalize whitespace
    .replace(/([.!?])\s*([A-Z])/g, '$1\n$2') // Add line breaks after sentences
    .replace(/(\d+\.)\s*([A-Z])/g, '$1\n$2') // Add line breaks after numbered items
    .trim();
}

function fallbackTextExtraction(arrayBuffer: ArrayBuffer): string {
  console.log('Using fallback text extraction method...');
  
  const uint8Array = new Uint8Array(arrayBuffer);
  const pdfString = new TextDecoder('latin1').decode(uint8Array);
  
  // Simple pattern matching as fallback
  const patterns = [
    /\((.*?)\)\s*Tj/g,
    /\((.*?)\)\s*'/g,
    /\[(.*?)\]\s*TJ/g,
  ];
  
  let text = '';
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(pdfString)) !== null) {
      const content = match[1]
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\(.)/g, '$1');
      
      if (content.trim().length > 2) {
        text += content + ' ';
      }
    }
  }
  
  return text.replace(/\s+/g, ' ').trim();
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
  
  console.log(`Processing text of length: ${text.length}`);
  
  // Normalize the text
  const normalizedText = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Enhanced Q&A patterns to capture all questions
  const patterns = [
    // Pattern 1: Numbered questions with Q: A: format
    {
      regex: /(\d+)[\.\)]\s*Q\s*[:.]?\s*([^A]*?)A\s*[:.]?\s*([^0-9Q]*?)(?=\d+[\.\)]|$)/gi,
      type: 'numbered_qa'
    },
    // Pattern 2: Simple numbered questions
    {
      regex: /(\d+)[\.\)]\s*([^0-9]*?)(?=\d+[\.\)]|$)/gi,
      type: 'numbered'
    },
    // Pattern 3: Q: ... A: ... format
    {
      regex: /Q\s*[:.]?\s*([^A]*?)A\s*[:.]?\s*([^Q]*?)(?=Q\s*[:.:]|$)/gi,
      type: 'qa_format'
    },
    // Pattern 4: Question ... Answer ... format
    {
      regex: /Question\s*[:.]?\s*([^A]*?)Answer\s*[:.]?\s*([^Q]*?)(?=Question|$)/gi,
      type: 'question_answer'
    },
    // Pattern 5: Lines ending with question marks
    {
      regex: /([^.!?]*\?)\s*([^?]*?)(?=[^.!?]*\?|$)/gi,
      type: 'question_mark'
    }
  ];
  
  let totalMatches = 0;
  
  for (const pattern of patterns) {
    const matches = Array.from(normalizedText.matchAll(pattern.regex));
    console.log(`Pattern ${pattern.type}: found ${matches.length} matches`);
    
    if (matches.length > 0) {
      totalMatches += matches.length;
      
      for (const match of matches) {
        let question = '';
        let answer = '';
        
        if (pattern.type === 'numbered_qa') {
          question = match[2]?.trim() || '';
          answer = match[3]?.trim() || '';
        } else if (pattern.type === 'numbered') {
          const content = match[2]?.trim() || '';
          // Try to split on common answer indicators
          const answerSplit = content.split(/(?:Answer|A\s*[:.]|answer\s*[:.])/i);
          if (answerSplit.length > 1) {
            question = answerSplit[0].trim();
            answer = answerSplit[1].trim();
          } else {
            // If no answer found, treat as question with unknown answer
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
        
        // Only add if we have meaningful content
        if (question.length > 10) {
          const category = determineCategory(question + ' ' + answer);
          const tags = extractTags(question + ' ' + answer);
          
          chunks.push({
            title: question.length > 100 ? question.substring(0, 97) + '...' : question,
            content: answer || 'Please refer to the original document for the answer.',
            category,
            tags
          });
        }
      }
      
      // If we found good matches with this pattern, prefer it over others
      if (chunks.length > totalMatches * 0.8) {
        console.log(`Using pattern ${pattern.type} as primary extraction method`);
        break;
      }
    }
  }
  
  // Fallback: if no Q&A patterns found, split by paragraphs
  if (chunks.length === 0) {
    console.log('No Q&A patterns found, splitting by paragraphs...');
    
    const paragraphs = normalizedText
      .split(/\n\s*\n/)
      .filter(p => p.trim().length > 50);
    
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = cleanText(paragraphs[i]);
      if (paragraph.length > 20) {
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
    .replace(/[^\w\s\?\.\,\!\:\;\-\(\)'"]/g, '')
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
