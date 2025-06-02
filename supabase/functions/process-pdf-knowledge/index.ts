
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
    
    // Split content into logical chunks
    const chunks = await createKnowledgeChunks(extractedText);

    console.log(`Extracted ${chunks.length} chunks from PDF`);

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
    // Convert ArrayBuffer to Uint8Array for text extraction
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Simple PDF text extraction - look for text between 'stream' and 'endstream'
    // This is a basic implementation; in production, you'd use a proper PDF parser
    let text = '';
    
    // Convert to string and look for text patterns
    const pdfString = new TextDecoder('latin1').decode(uint8Array);
    
    // Extract text using regex patterns for PDF text objects
    const textRegex = /BT\s*(.*?)\s*ET/gs;
    const matches = pdfString.match(textRegex);
    
    if (matches) {
      for (const match of matches) {
        // Extract actual text from PDF text objects
        const textLines = match.match(/\((.*?)\)/g);
        if (textLines) {
          for (const line of textLines) {
            const cleanText = line.replace(/[()]/g, '');
            if (cleanText.trim().length > 0) {
              text += cleanText + '\n';
            }
          }
        }
      }
    }
    
    // Fallback: if no text extracted with the above method, try simpler approach
    if (text.trim().length === 0) {
      console.log('Primary extraction failed, trying fallback method...');
      
      // Look for readable text patterns in the PDF
      const readableText = pdfString.match(/[A-Za-z0-9\s\?\.\,\!\:\;]+/g);
      if (readableText) {
        text = readableText
          .filter(t => t.trim().length > 10) // Filter out short fragments
          .join(' ')
          .replace(/\s+/g, ' '); // Normalize whitespace
      }
    }
    
    console.log(`Extracted text preview: ${text.substring(0, 500)}...`);
    return text;
    
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    // Return empty string if extraction fails
    return '';
  }
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
  
  // Normalize the text
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Try multiple Q&A patterns to capture all questions
  const patterns = [
    // Pattern 1: Q: ... A: ...
    /Q\s*:?\s*([^A]*?)A\s*:?\s*([^Q]*?)(?=Q\s*:?|$)/gi,
    // Pattern 2: Question ... Answer ...
    /Question\s*:?\s*([^A]*?)Answer\s*:?\s*([^Q]*?)(?=Question|$)/gi,
    // Pattern 3: Numbered questions (1. ... 2. ...)
    /(\d+)\.\s*([^0-9]*?)(?=\d+\.|$)/gi,
    // Pattern 4: Lines ending with question marks
    /([^.!?]*\?)\s*([^?]*?)(?=[^.!?]*\?|$)/gi
  ];
  
  let foundQuestions = false;
  
  for (const pattern of patterns) {
    const matches = Array.from(normalizedText.matchAll(pattern));
    
    if (matches.length > 0) {
      console.log(`Found ${matches.length} matches with pattern ${pattern.source}`);
      foundQuestions = true;
      
      for (const match of matches) {
        let question = '';
        let answer = '';
        
        if (pattern.source.includes('\\d+')) {
          // Numbered pattern
          question = match[2]?.trim() || '';
          answer = extractAnswerFromContext(normalizedText, question);
        } else {
          // Q&A patterns
          question = match[1]?.trim() || '';
          answer = match[2]?.trim() || '';
        }
        
        if (question.length > 10 && answer.length > 5) {
          // Clean up the question and answer
          question = cleanText(question);
          answer = cleanText(answer);
          
          // Determine category based on keywords
          const category = determineCategory(question + ' ' + answer);
          
          // Extract tags from question and answer content
          const tags = extractTags(question + ' ' + answer);
          
          chunks.push({
            title: question.length > 100 ? question.substring(0, 97) + '...' : question,
            content: answer,
            category,
            tags
          });
        }
      }
      
      // If we found good matches with this pattern, use them
      if (chunks.length > 0) {
        break;
      }
    }
  }
  
  // Fallback: if no Q&A patterns found, split by paragraphs and treat as content blocks
  if (!foundQuestions && chunks.length === 0) {
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
          title: paragraph.substring(0, 100) + (paragraph.length > 100 ? '...' : ''),
          content: paragraph,
          category,
          tags
        });
      }
    }
  }
  
  console.log(`Created ${chunks.length} chunks from extracted text`);
  return chunks;
}

function extractAnswerFromContext(text: string, question: string): string {
  // Find the question in the text and extract following content as answer
  const questionIndex = text.toLowerCase().indexOf(question.toLowerCase());
  if (questionIndex === -1) return '';
  
  const afterQuestion = text.substring(questionIndex + question.length);
  const nextQuestionMatch = afterQuestion.match(/\d+\./);
  
  if (nextQuestionMatch) {
    return afterQuestion.substring(0, nextQuestionMatch.index).trim();
  }
  
  return afterQuestion.substring(0, 500).trim(); // Limit to reasonable length
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[^\w\s\?\.\,\!\:\;\-\(\)]/g, '') // Remove special characters
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
