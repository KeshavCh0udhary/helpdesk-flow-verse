
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
    console.log(`Extracted text preview: ${extractedText.substring(0, 1000)}...`);
    
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
    
    // Convert to text using different encodings
    let text = '';
    
    // Try UTF-8 first
    try {
      const utf8Text = new TextDecoder('utf-8').decode(uint8Array);
      text = extractReadableText(utf8Text);
    } catch (e) {
      console.log('UTF-8 decoding failed, trying latin1');
    }
    
    // Fallback to latin1 if UTF-8 fails
    if (!text || text.length < 100) {
      const latin1Text = new TextDecoder('latin1').decode(uint8Array);
      text = extractReadableText(latin1Text);
    }
    
    console.log(`Final extracted text length: ${text.length} characters`);
    return text;
    
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    return '';
  }
}

function extractReadableText(pdfString: string): string {
  let extractedText = '';
  
  // Method 1: Extract text from PDF text objects
  const streamRegex = /stream\s*([\s\S]*?)\s*endstream/g;
  let streamMatch;
  
  while ((streamMatch = streamRegex.exec(pdfString)) !== null) {
    const streamContent = streamMatch[1];
    
    // Look for text commands in the stream
    const textPatterns = [
      /\((.*?)\)\s*Tj/g,  // Simple text showing
      /\[(.*?)\]\s*TJ/g,  // Array text showing
      /\((.*?)\)\s*'/g,   // Move and show text
      /\((.*?)\)\s*"/g,   // Move, set spacing and show text
    ];
    
    for (const pattern of textPatterns) {
      let match;
      while ((match = pattern.exec(streamContent)) !== null) {
        const textContent = match[1]
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\(.)/g, '$1'); // Remove escape characters
        
        if (textContent.trim().length > 0) {
          extractedText += textContent + '\n';
        }
      }
    }
  }
  
  // Method 2: Extract from BT...ET blocks (text objects)
  const textObjectRegex = /BT\s*([\s\S]*?)\s*ET/g;
  let textMatch;
  
  while ((textMatch = textObjectRegex.exec(pdfString)) !== null) {
    const textBlock = textMatch[1];
    
    // Extract text from parentheses
    const textInParens = /\((.*?)\)/g;
    let parenMatch;
    
    while ((parenMatch = textInParens.exec(textBlock)) !== null) {
      const text = parenMatch[1]
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\(.)/g, '$1');
      
      if (text.trim().length > 0) {
        extractedText += text + ' ';
      }
    }
  }
  
  // Method 3: Look for readable text patterns
  if (extractedText.length < 100) {
    console.log('Trying alternative text extraction...');
    
    // Find text that looks like readable content
    const readablePatterns = [
      /[A-Za-z]{3,}[^<>]*[.?!]/g,  // Sentences
      /\b\d+[\.\)]\s*[A-Za-z][^<>]*[.?!]/g,  // Numbered items
      /Q\s*[:.]?\s*[A-Za-z][^<>]*[?]/g,  // Questions
      /A\s*[:.]?\s*[A-Za-z][^<>]*[.!]/g,  // Answers
    ];
    
    for (const pattern of readablePatterns) {
      const matches = pdfString.match(pattern);
      if (matches) {
        extractedText += matches.join('\n') + '\n';
      }
    }
  }
  
  // Clean up the extracted text
  extractedText = extractedText
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .replace(/([.!?])\s*([A-Z])/g, '$1\n$2')  // Add line breaks after sentences
    .trim();
  
  return extractedText;
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
